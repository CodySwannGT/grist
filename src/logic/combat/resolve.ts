/**
 * The combat-rules effect resolver: turns an acting {@link BattleAction} into
 * its next {@link BattleState}. It threads the seeded RNG through `BattleState`
 * (one variance roll, one crit roll), computes the hit with the combat-spec
 * formula, applies damage / Rendering / Pressure to the target, and resets the
 * actor's ATB gauge — mutating nothing and reading nothing ambient, so the same
 * `(state, action, seed)` always yields the same next state. The engine's `step`
 * delegates every non-`tick` action here; a `tick` (status DoT) stays RNG-free.
 * @module logic/combat/resolve
 */
import { SPELLS, type SpellDef } from "../../content";
import { rngStep } from "../rng";
import { addPressure, applyRendering } from "./effects";
import {
  CombatTuning,
  computeDamage,
  computeRenderingTick,
  critMod,
  elementMultiplier,
  isCrit,
  isWeakness,
  pressureMod,
  varianceFromRoll,
} from "./formula";
import { combatantAt } from "./select";
import { targetElements } from "./target";
import {
  ActionKinds,
  BattleSides,
  Statuses,
  type BattleAction,
  type BattleEvent,
  type BattleState,
  type Combatant,
  type CombatantRef,
  type ElementId,
  type StatusId,
} from "./types";

/** The resolved attack shape derived from an action's kind + spell id. */
interface AttackProfile {
  /** POW (Strike) or FOC (Craft) of the actor. */
  readonly attackerStat: number;
  /** Skill/spell power. */
  readonly skillPower: number;
  /** Which defender stat mitigates the hit. */
  readonly defKind: "def" | "wrd";
  /** The attacking element, or null for a physical (neutral) Strike. */
  readonly element: ElementId | null;
  /** A status the hit lands on a surviving target, or null. */
  readonly status: StatusId | null;
  /** The actor's FOC, captured for the Rendering DoT magnitude. */
  readonly casterFoc: number;
}

/** A side pair after a combatant-targeted update. */
interface Sides {
  readonly party: readonly Combatant[];
  readonly enemies: readonly Combatant[];
}

/** A resolved hit: the damage to apply and the element multiplier that scaled it. */
interface Hit {
  readonly damage: number;
  readonly elementMod: number;
}

/** The actor and target refs a resolved turn addresses. */
interface TurnRefs {
  readonly actorRef: CombatantRef;
  readonly targetRef: CombatantRef;
}

/** The two seeded rolls one acting turn consumes, plus the successor state. */
interface Rolls {
  readonly varianceRoll: number;
  readonly critRoll: number;
  readonly state: number;
}

/**
 * Look up a castable spell by id, or null when the id is absent/unknown.
 * @param id - The action's spell id.
 * @returns The spell definition, or null.
 */
function spellById(id: string | undefined): SpellDef | null {
  if (id === undefined) {
    return null;
  }
  return (SPELLS as Record<string, SpellDef>)[id] ?? null;
}

/**
 * Derive the attack profile from an action's kind and spell id. Only `strike`
 * (physical) and a `craft` naming a defined spell produce a damaging profile;
 * every other kind returns null (the turn is spent without an effect).
 * @param action - The acting action.
 * @param actor - The acting combatant.
 * @returns The attack profile, or null when the action lands no effect.
 */
function attackProfile(
  action: BattleAction,
  actor: Combatant
): AttackProfile | null {
  if (action.kind === ActionKinds.strike) {
    return {
      attackerStat: actor.stats.pow,
      skillPower: CombatTuning.strikePower,
      defKind: "def",
      element: null,
      status: null,
      casterFoc: actor.stats.foc,
    };
  }
  if (action.kind === ActionKinds.craft) {
    const spell = spellById(action.id);
    return spell ? craftProfile(actor, spell) : null;
  }
  return null;
}

/**
 * The attack profile for casting a defined spell.
 * @param actor - The casting combatant.
 * @param spell - The spell being cast.
 * @returns The Craft attack profile.
 */
function craftProfile(actor: Combatant, spell: SpellDef): AttackProfile {
  return {
    attackerStat: actor.stats.foc,
    skillPower: spell.power,
    defKind: "wrd",
    element: spell.element,
    status: spell.status ?? null,
    casterFoc: actor.stats.foc,
  };
}

/**
 * Consume the two seeded rolls an acting turn uses: a variance roll (logged) and
 * a crit roll.
 * @param state - The current RNG state.
 * @returns The variance roll, crit roll, and successor RNG state.
 */
function consumeRolls(state: number): Rolls {
  const variance = rngStep(state);
  const crit = rngStep(variance.state);
  return {
    varianceRoll: variance.value,
    critRoll: crit.value,
    state: crit.state,
  };
}

/**
 * Replace a side's combatant at `ref` via a mapper, leaving the other side and
 * the rest untouched (structural sharing).
 * @param sides - The current side pair.
 * @param ref - Which combatant to update.
 * @param fn - The combatant mapper.
 * @returns The updated side pair.
 */
function updateAt(
  sides: Sides,
  ref: CombatantRef,
  fn: (combatant: Combatant) => Combatant
): Sides {
  const map = (side: readonly Combatant[]): readonly Combatant[] =>
    side.map((combatant, i) => (i === ref.index ? fn(combatant) : combatant));
  return ref.side === BattleSides.party
    ? { party: map(sides.party), enemies: sides.enemies }
    : { party: sides.party, enemies: map(sides.enemies) };
}

/**
 * Compute the damage a profiled hit deals to a target, with element, crit, and
 * pressure modifiers resolved.
 * @param target - The target combatant.
 * @param profile - The attack profile.
 * @param variance - The variance multiplier.
 * @param crit - Whether the hit crit.
 * @returns The damage and the element multiplier used.
 */
function computeHit(
  target: Combatant,
  profile: AttackProfile,
  variance: number,
  crit: boolean
): Hit {
  const elementMod =
    profile.element === null
      ? CombatTuning.neutralElement
      : elementMultiplier(targetElements(target), profile.element);
  const defStat =
    profile.defKind === "def" ? target.stats.def : target.stats.wrd;
  const damage = computeDamage({
    attackerStat: profile.attackerStat,
    skillPower: profile.skillPower,
    defStat,
    elementMod,
    critMod: critMod(crit),
    variance,
    pressureMod: pressureMod(target.broken),
  });
  return { damage, elementMod };
}

/**
 * Apply a resolved hit to the target combatant: subtract damage, land Rendering
 * on a survivor, and accrue Pressure from a weakness hit and/or a landed status.
 * @param target - The target combatant.
 * @param profile - The attack profile.
 * @param hit - The computed damage and element multiplier.
 * @returns The updated target combatant.
 */
function applyHit(
  target: Combatant,
  profile: AttackProfile,
  hit: Hit
): Combatant {
  const hp = Math.max(0, target.hp - hit.damage);
  const landsStatus = profile.status === Statuses.rendering && hp > 0;
  const rendered = landsStatus
    ? applyRendering(
        { ...target, hp },
        computeRenderingTick({
          foc: profile.casterFoc,
          power: profile.skillPower,
        }),
        CombatTuning.renderingTurns
      )
    : { ...target, hp };
  const pressureGain =
    (isWeakness(hit.elementMod) ? CombatTuning.pressureOnWeakness : 0) +
    (landsStatus ? CombatTuning.pressureOnStatus : 0);
  return pressureGain > 0 ? addPressure(rendered, pressureGain) : rendered;
}

/**
 * Spend the actor's turn without landing an effect (no target, or a non-damaging
 * kind): reset the actor's ATB gauge and consume one seeded roll, logging it.
 * @param state - The battle state.
 * @param action - The acting action.
 * @param actorRef - The actor's ref.
 * @returns The next battle state.
 */
function spendTurn(
  state: BattleState,
  action: BattleAction,
  actorRef: CombatantRef
): BattleState {
  const stepped = rngStep(state.rngState);
  const sides = updateAt(
    { party: state.party, enemies: state.enemies },
    actorRef,
    c => ({
      ...c,
      atb: 0,
    })
  );
  const event: BattleEvent = {
    tick: state.tick,
    kind: action.kind,
    actor: actorRef,
    ...(action.target ? { target: action.target } : {}),
    roll: stepped.value,
  };
  return {
    ...state,
    rngState: stepped.state,
    party: sides.party,
    enemies: sides.enemies,
    log: [...state.log, event],
  };
}

/**
 * Resolve a damaging turn: roll variance + crit, compute and apply the hit to
 * the target, reset the actor's gauge, and log the event with the damage dealt.
 * @param state - The battle state.
 * @param action - The acting action.
 * @param refs - The actor and target refs.
 * @param actor - The acting combatant.
 * @param target - The target combatant.
 * @param profile - The resolved attack profile.
 * @returns The next battle state.
 */
function resolveHit(
  state: BattleState,
  action: BattleAction,
  refs: TurnRefs,
  actor: Combatant,
  target: Combatant,
  profile: AttackProfile
): BattleState {
  const rolls = consumeRolls(state.rngState);
  const variance = varianceFromRoll(rolls.varianceRoll);
  const crit = isCrit(actor.stats.lck, rolls.critRoll);
  const hit = computeHit(target, profile, variance, crit);
  // Log the HP actually lost, not the raw formula result: applyHit clamps a
  // lethal hit at the target's remaining HP, so an overkill must not over-report.
  const appliedDamage = Math.min(target.hp, hit.damage);
  const hitSides = updateAt(
    { party: state.party, enemies: state.enemies },
    refs.targetRef,
    () => applyHit(target, profile, hit)
  );
  const sides = updateAt(hitSides, refs.actorRef, c => ({ ...c, atb: 0 }));
  const event: BattleEvent = {
    tick: state.tick,
    kind: action.kind,
    actor: refs.actorRef,
    target: refs.targetRef,
    roll: rolls.varianceRoll,
    damage: appliedDamage,
  };
  return {
    ...state,
    rngState: rolls.state,
    party: sides.party,
    enemies: sides.enemies,
    log: [...state.log, event],
  };
}

/**
 * Resolve one acting (non-`tick`) action into the next battle state. An
 * actor-less or out-of-range action is a no-op (the reducer stays total); an
 * action with no target or a non-damaging kind spends the turn without effect;
 * a damaging strike/craft against a valid target resolves the full hit.
 * @param state - The battle state.
 * @param action - The acting action.
 * @returns The next battle state.
 */
export function resolveTurn(
  state: BattleState,
  action: BattleAction
): BattleState {
  const actorRef = action.actor;
  if (!actorRef) {
    return state;
  }
  const actor = combatantAt(state, actorRef);
  if (!actor) {
    return state;
  }
  const profile = attackProfile(action, actor);
  const targetRef = action.target;
  const target = targetRef ? combatantAt(state, targetRef) : null;
  if (!profile || !targetRef || !target) {
    return spendTurn(state, action, actorRef);
  }
  return resolveHit(
    state,
    action,
    { actorRef, targetRef },
    actor,
    target,
    profile
  );
}
