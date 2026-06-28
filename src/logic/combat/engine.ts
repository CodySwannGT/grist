/**
 * The deterministic ATB combat core: build a battle from the typed CP-1.0
 * content ({@link startBattle}) and advance it with a pure reducer
 * ({@link step}). A `tick` fills every ATB gauge proportionally to SPD; an
 * acting kind spends the actor's ready turn and consumes one seeded roll from
 * the RNG stream threaded through `BattleState`. The reducer mutates nothing and
 * reads nothing ambient — no Phaser, no `Math.random` / `Date.now` — so the same
 * `(state, action, seed)` always produces the same next state.
 * @module logic/combat/engine
 */
import { ENEMIES, type EncounterDef, type PartyMemberDef } from "../../content";
import { rngStep } from "../rng";
import {
  ActionKinds,
  BattlePhases,
  BattleSides,
  type BattleAction,
  type BattleEvent,
  type BattleState,
  type Combatant,
  type CombatantRef,
  type Stats,
} from "./types";

/**
 * ATB tuning (combat-spec "ATB timing"). A gauge fills 0 → `ready`; the per-tick
 * gain is `SPD × fillPerSpd`, so fill is exactly proportional to SPD, and acting
 * resets it to 0. First-pass `k` (`fillPerSpd`) — tuned in Phase 1.
 */
export const AtbTuning = {
  ready: 100,
  fillPerSpd: 1,
} as const;

/**
 * Build a fresh in-battle combatant from a content stat block: full HP / AP, an
 * empty ATB gauge, no statuses, no pressure, not broken.
 * @param ref - The content id this combatant was built from.
 * @param stats - The combatant's base stat block.
 * @returns The initial {@link Combatant} runtime state.
 */
function buildCombatant(ref: string, stats: Stats): Combatant {
  return {
    ref,
    stats,
    hp: stats.hp,
    ap: stats.ap,
    atb: 0,
    statuses: [],
    pressure: 0,
    broken: false,
  };
}

/**
 * Build the initial {@link BattleState} from the typed CP-1.0 content and a
 * numeric seed. Party combatants come from each member's `baseStats`; enemy
 * combatants resolve from the encounter's typed enemy ids via the ENEMIES table.
 * The seed initializes the threaded RNG (matching `new Rng(seed)`), so the
 * battle is reproducible. Pure — returns fresh state and reads nothing ambient.
 * @param party - The party member definitions to field.
 * @param encounter - The encounter whose enemy lineup to resolve.
 * @param seed - The 32-bit battle seed.
 * @returns The initial battle state, in the `select` phase.
 */
export function startBattle(
  party: readonly PartyMemberDef[],
  encounter: EncounterDef,
  seed: number
): BattleState {
  return {
    party: party.map(member => buildCombatant(member.id, member.baseStats)),
    enemies: encounter.enemies.map(enemyId =>
      buildCombatant(enemyId, ENEMIES[enemyId].stats)
    ),
    grist: 0,
    seed: seed >>> 0,
    rngState: seed >>> 0,
    tick: 0,
    phase: BattlePhases.select,
    log: [],
  };
}

/**
 * The combatant a ref points at, or null when the index is out of range.
 * @param state - The battle state.
 * @param ref - The combatant ref.
 * @returns The combatant, or null.
 */
export function combatantAt(
  state: BattleState,
  ref: CombatantRef
): Combatant | null {
  const side = ref.side === BattleSides.party ? state.party : state.enemies;
  return side[ref.index] ?? null;
}

/**
 * Return a copy of a side's combatant array with the combatant at `index` reset
 * to a 0 ATB gauge. Mutates nothing.
 * @param side - The side's combatant array.
 * @param index - The combatant index to reset.
 * @returns A new array with that combatant's gauge cleared.
 */
function resetGauge(
  side: readonly Combatant[],
  index: number
): readonly Combatant[] {
  return side.map((combatant, i) =>
    i === index ? { ...combatant, atb: 0 } : combatant
  );
}

/**
 * Advance every combatant's ATB gauge by `SPD × fillPerSpd`, clamped to `ready`,
 * bump the tick counter, and append a tick event. Deterministic — the fill
 * depends only on SPD, never on the RNG.
 * @param state - The battle state.
 * @returns The state after one ATB tick.
 */
function applyTick(state: BattleState): BattleState {
  const tick = state.tick + 1;
  const fill = (combatant: Combatant): Combatant => ({
    ...combatant,
    atb: Math.min(
      combatant.atb + combatant.stats.spd * AtbTuning.fillPerSpd,
      AtbTuning.ready
    ),
  });
  return {
    ...state,
    tick,
    party: state.party.map(fill),
    enemies: state.enemies.map(fill),
    log: [...state.log, { tick, kind: ActionKinds.tick }],
  };
}

/**
 * Resolve a combatant spending its turn: reset the actor's ATB gauge to 0 and
 * consume one seeded roll (the variance the action's later effect will use),
 * advancing the threaded RNG and logging the event. An actor-less or
 * out-of-range action is a no-op, so the reducer stays total. Effect resolution
 * itself (damage / heal / resource spend) is delegated to later sub-tasks.
 * @param state - The battle state.
 * @param action - An acting (non-tick) action.
 * @returns The state after the actor's turn is spent.
 */
function applyTurn(state: BattleState, action: BattleAction): BattleState {
  const actor = action.actor;
  if (!actor || !combatantAt(state, actor)) {
    return state;
  }
  const stepped = rngStep(state.rngState);
  const onParty = actor.side === BattleSides.party;
  const event: BattleEvent = {
    tick: state.tick,
    kind: action.kind,
    actor,
    ...(action.target ? { target: action.target } : {}),
    roll: stepped.value,
  };
  return {
    ...state,
    rngState: stepped.state,
    party: onParty ? resetGauge(state.party, actor.index) : state.party,
    enemies: onParty ? state.enemies : resetGauge(state.enemies, actor.index),
    log: [...state.log, event],
  };
}

/**
 * The pure battle reducer: apply one {@link BattleAction} and return the next
 * {@link BattleState}, mutating nothing and reading nothing ambient. A `tick`
 * advances every ATB gauge by `SPD × fillPerSpd`; an acting kind spends the
 * actor's ready turn (gauge → 0) and consumes one seeded roll. Same
 * `(state, action, seed)` → same next state, always.
 * @param state - The current battle state (never mutated).
 * @param action - The action to apply.
 * @returns The next battle state.
 */
export function step(state: BattleState, action: BattleAction): BattleState {
  return action.kind === ActionKinds.tick
    ? applyTick(state)
    : applyTurn(state, action);
}
