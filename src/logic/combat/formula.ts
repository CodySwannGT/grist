/**
 * Pure combat math: the first-pass damage / heal / DoT formulas and the
 * element, crit, variance, and pressure modifiers from the
 * [combat-spec](../../../wiki/design/combat-spec.md). Every function here is a
 * total function of explicit numeric inputs — it reads no battle state, threads
 * no RNG, and reads nothing ambient (no `Math.random` / `Date.now`), so the
 * reducer can call it with seeded rolls and stay deterministic. All constants
 * are first-pass targets tuned in Phase 1; the *shapes* are the contract.
 * @module logic/combat/formula
 */
import { type ElementId } from "./types";

/**
 * First-pass tuning for the combat-rules layer (combat-spec). Damage uses
 * `attackerStat × skillPower`, mitigated by `100 / (100 + defStat)`, then scaled
 * by element / crit / variance / pressure modifiers. Pressure accrues from
 * weakness hits and landed statuses; at `breakThreshold` the target is Broken
 * and every subsequent hit is scaled by `brokenPressureMod` (≥ ×2). Rendering's
 * per-tick DoT is `FOC × power × renderingDotCoefficient`.
 */
export const CombatTuning = {
  /** Skill power of a basic physical Strike (so a Strike's base is just POW). */
  strikePower: 1,
  /** Damage multiplier on a critical hit. */
  critMultiplier: 1.5,
  /** Crit chance gained per point of LCK. */
  critPerLck: 0.01,
  /** Hard cap on crit chance regardless of LCK. */
  critCap: 0.5,
  /** Lower bound of the damage variance band. */
  varianceMin: 0.95,
  /** Width of the variance band (`varianceMin + roll × varianceSpread`). */
  varianceSpread: 0.1,
  /** Element multiplier for a normal (un-listed) element. */
  neutralElement: 1,
  /** Damage multiplier applied to a Broken target (≥ ×2 per combat-spec). */
  brokenPressureMod: 2,
  /** Pressure at which a target Breaks and Severance is enabled. */
  breakThreshold: 50,
  /** Pressure gained by hitting an elemental weakness. */
  pressureOnWeakness: 30,
  /** Pressure gained by landing a status (e.g. Rendering). */
  pressureOnStatus: 30,
  /** Default Rendering duration in turns. */
  renderingTurns: 3,
  /** Coefficient turning `FOC × power` into a Rendering per-tick DoT. */
  renderingDotCoefficient: 0.1,
} as const;

const MITIGATION_BASE = 100;

/** Inputs to {@link computeDamage} — every modifier resolved by the caller. */
interface DamageInput {
  /** POW (physical) or FOC (Craft) of the attacker. */
  readonly attackerStat: number;
  /** Skill/spell power (Strike uses {@link CombatTuning.strikePower}). */
  readonly skillPower: number;
  /** DEF (physical) or WRD (Craft) of the defender. */
  readonly defStat: number;
  /** Element multiplier (0 immune / 0.5 resist / 1 neutral / 1.5 weak). */
  readonly elementMod: number;
  /** Crit multiplier (1 or {@link CombatTuning.critMultiplier}). */
  readonly critMod: number;
  /** Variance multiplier from a seeded roll ({@link varianceFromRoll}). */
  readonly variance: number;
  /** Pressure multiplier (1, or {@link CombatTuning.brokenPressureMod}). */
  readonly pressureMod: number;
}

/** Inputs to {@link computeHeal} — FOC-based, no DEF mitigation. */
interface HealInput {
  /** FOC of the healer. */
  readonly foc: number;
  /** Heal spell power. */
  readonly power: number;
  /** Variance multiplier from a seeded roll. */
  readonly variance: number;
}

/** Inputs to {@link computeRenderingTick} — FOC-based DoT, no variance. */
interface RenderingInput {
  /** FOC of the caster, captured at application time. */
  readonly foc: number;
  /** Power of the Rendering source spell. */
  readonly power: number;
}

/**
 * The combat-spec damage formula:
 * `round(attackerStat × skillPower × (100 / (100 + defStat)) × elementMod ×
 * critMod × variance × pressureMod)`, floored at 0. Pure — the caller supplies
 * every modifier (element, crit, variance, pressure) so the result is fully
 * determined by its inputs.
 * @param input - The resolved damage inputs.
 * @returns The non-negative, integer HP loss to apply.
 */
export function computeDamage(input: DamageInput): number {
  const base = input.attackerStat * input.skillPower;
  const mitigated =
    base * (MITIGATION_BASE / (MITIGATION_BASE + input.defStat));
  const final =
    mitigated *
    input.elementMod *
    input.critMod *
    input.variance *
    input.pressureMod;
  return Math.max(0, Math.round(final));
}

/**
 * The heal formula — the damage shape reused FOC-based with no DEF mitigation,
 * element, crit, or pressure: `round(FOC × power × variance)`, floored at 0.
 * @param input - The resolved heal inputs.
 * @returns The non-negative, integer HP to restore.
 */
export function computeHeal(input: HealInput): number {
  return Math.max(0, Math.round(input.foc * input.power * input.variance));
}

/**
 * The Rendering per-tick DoT — the heal/DoT shape with a slow-burn coefficient:
 * `max(1, round(FOC × power × renderingDotCoefficient))`. Variance-free so each
 * tick is a fixed, RNG-free amount captured when the status lands.
 * @param input - The caster FOC and source-spell power.
 * @returns The per-tick HP loss (at least 1).
 */
export function computeRenderingTick(input: RenderingInput): number {
  return Math.max(
    1,
    Math.round(input.foc * input.power * CombatTuning.renderingDotCoefficient)
  );
}

/**
 * The element multiplier for `element` against a target's element table: the
 * listed value, or {@link CombatTuning.neutralElement} when the element is not
 * listed (a normal, ×1 matchup).
 * @param elements - The target's per-element multiplier table.
 * @param element - The attacking element.
 * @returns The element multiplier (0 / 0.5 / 1 / 1.5).
 */
export function elementMultiplier(
  elements: Partial<Record<ElementId, number>>,
  element: ElementId
): number {
  return elements[element] ?? CombatTuning.neutralElement;
}

/**
 * Map a seeded roll in `[0, 1)` to the damage variance band
 * `[varianceMin, varianceMin + varianceSpread)`.
 * @param roll - A seeded float in `[0, 1)`.
 * @returns The variance multiplier.
 */
export function varianceFromRoll(roll: number): number {
  return CombatTuning.varianceMin + roll * CombatTuning.varianceSpread;
}

/**
 * The crit chance for a given LCK: `LCK × critPerLck`, capped at `critCap`.
 * @param lck - The attacker's LCK stat.
 * @returns A crit probability in `[0, critCap]`.
 */
function critChanceFromLck(lck: number): number {
  return Math.min(lck * CombatTuning.critPerLck, CombatTuning.critCap);
}

/**
 * Whether a seeded roll lands a crit for the given LCK.
 * @param lck - The attacker's LCK stat.
 * @param roll - A seeded float in `[0, 1)`.
 * @returns True when the roll is under the LCK-derived crit chance.
 */
export function isCrit(lck: number, roll: number): boolean {
  return roll < critChanceFromLck(lck);
}

/**
 * The crit multiplier for a crit decision: {@link CombatTuning.critMultiplier}
 * on a crit, otherwise 1.
 * @param crit - Whether the hit crit.
 * @returns The crit multiplier.
 */
export function critMod(crit: boolean): number {
  return crit ? CombatTuning.critMultiplier : 1;
}

/**
 * The pressure (damage) multiplier for a target: `brokenPressureMod` when the
 * target is Broken (Severance window), otherwise 1.
 * @param broken - Whether the target is Broken.
 * @returns The pressure multiplier.
 */
export function pressureMod(broken: boolean): number {
  return broken ? CombatTuning.brokenPressureMod : 1;
}

/**
 * The non-neutral element multiplier signals a weakness when above neutral.
 * @param mod - An element multiplier.
 * @returns True when the matchup is a weakness (> ×1).
 */
export function isWeakness(mod: number): boolean {
  return mod > CombatTuning.neutralElement;
}
