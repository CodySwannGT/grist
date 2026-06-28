/**
 * The deterministic ATB combat core: build a battle from the typed CP-1.0
 * content ({@link startBattle}) and advance it with a pure reducer
 * ({@link step}). A `tick` fills every ATB gauge proportionally to SPD and ticks
 * each combatant's status DoTs (Rendering); an acting kind delegates to the
 * effect resolver ({@link resolveTurn}) — spending the actor's ready turn and
 * threading the seeded RNG. The reducer mutates nothing and reads nothing
 * ambient — no Phaser, no `Math.random` / `Date.now` — so the same
 * `(state, action, seed)` always produces the same next state.
 * @module logic/combat/engine
 */
import { ENEMIES, type EncounterDef, type PartyMemberDef } from "../../content";
import { tickStatuses } from "./effects";
import { isResolved, resolveOutcome } from "./outcome";
import { resolveTurn } from "./resolve";
import { regenAp } from "./resource";
import {
  ActionKinds,
  BattlePhases,
  type BattleAction,
  type BattleState,
  type Combatant,
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
    spent: false,
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
 * Advance every combatant's ATB gauge by `SPD × fillPerSpd`, clamped to `ready`,
 * regenerate one turn's Anima (AP, clamped to max), tick each combatant's status
 * DoTs (Rendering), bump the tick counter, and append a tick event.
 * Deterministic — the fill, the AP regen, and the DoT depend only on stored
 * state, never on the RNG.
 * @param state - The battle state.
 * @returns The state after one ATB tick.
 */
function applyTick(state: BattleState): BattleState {
  const tick = state.tick + 1;
  const advance = (combatant: Combatant): Combatant =>
    regenAp(
      tickStatuses({
        ...combatant,
        atb: Math.min(
          combatant.atb + combatant.stats.spd * AtbTuning.fillPerSpd,
          AtbTuning.ready
        ),
      })
    );
  return {
    ...state,
    tick,
    party: state.party.map(advance),
    enemies: state.enemies.map(advance),
    log: [...state.log, { tick, kind: ActionKinds.tick }],
  };
}

/**
 * The pure battle reducer: apply one {@link BattleAction} and return the next
 * {@link BattleState}, mutating nothing and reading nothing ambient. A `tick`
 * advances every ATB gauge by `SPD × fillPerSpd` and ticks status DoTs; an
 * acting kind delegates to {@link resolveTurn}, which spends the actor's turn
 * (gauge → 0), threads the seeded RNG, and applies the action's effect. After
 * the action lands, {@link resolveOutcome} flips the battle to `won`/`lost` when
 * the last enemy or the last party member falls — including a kill dealt by a
 * Rendering DoT on a `tick`. A battle already resolved is terminal: every further
 * action (including a `tick`) is rejected and the state returned unchanged, so
 * the outcome is stable. Same `(state, action, seed)` → same next state, always.
 * @param state - The current battle state (never mutated).
 * @param action - The action to apply.
 * @returns The next battle state.
 */
export function step(state: BattleState, action: BattleAction): BattleState {
  if (isResolved(state)) {
    return state;
  }
  const next =
    action.kind === ActionKinds.tick
      ? applyTick(state)
      : resolveTurn(state, action);
  return resolveOutcome(next);
}
