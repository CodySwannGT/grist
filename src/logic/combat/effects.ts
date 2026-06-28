/**
 * Pure status / pressure / loot state transforms for the combat-rules layer:
 * applying and ticking the Rendering damage-over-time, accruing Pressure into
 * the Broken state, exposing the Severance window, and resolving loot — denied
 * for a corpse a Rendering tick killed ("spent"). These are RNG-free functions
 * over a single {@link Combatant}; the engine maps them across a side each ATB
 * tick and the resolver composes them when an action lands. No Phaser, no I/O.
 * @module logic/combat/effects
 */
import { ENEMIES, type EnemyId } from "../../content";
import { CombatTuning } from "./formula";
import { Statuses, type Combatant, type CombatantStatus } from "./types";

/**
 * Attach (or refresh) the Rendering DoT on a combatant, carrying the per-tick
 * `power` so each future tick subtracts a fixed amount. An existing Rendering
 * status is replaced (re-application refreshes duration and magnitude); other
 * statuses are preserved.
 * @param combatant - The target combatant.
 * @param power - The per-tick DoT magnitude (from {@link computeRenderingTick}).
 * @param turns - How many turns the DoT lasts.
 * @returns The combatant with the Rendering status applied.
 */
export function applyRendering(
  combatant: Combatant,
  power: number,
  turns: number
): Combatant {
  const others = combatant.statuses.filter(
    status => status.id !== Statuses.rendering
  );
  const rendering: CombatantStatus = {
    id: Statuses.rendering,
    turns,
    power,
  };
  return { ...combatant, statuses: [...others, rendering] };
}

/**
 * Apply one turn's worth of status ticks to a combatant: subtract the Rendering
 * DoT from HP (floored at 0), decrement every status timer, and drop the ones
 * that expire. If the DoT lands the killing blow (HP was above 0 and reaches 0
 * from this tick), mark the corpse `spent` so its loot is denied. RNG-free, so
 * an ATB `tick` stays deterministic.
 * @param combatant - The combatant to tick.
 * @returns The combatant after this tick's DoT and timer decrements.
 */
export function tickStatuses(combatant: Combatant): Combatant {
  const dot = renderingDot(combatant);
  const hp = Math.max(0, combatant.hp - dot);
  const spent = combatant.spent || (dot > 0 && combatant.hp > 0 && hp === 0);
  const statuses = combatant.statuses
    .map(status => ({ ...status, turns: status.turns - 1 }))
    .filter(status => status.turns > 0);
  return { ...combatant, hp, spent, statuses };
}

/**
 * The Rendering per-tick magnitude currently riding on a combatant, or 0 when
 * it carries no Rendering status.
 * @param combatant - The combatant to inspect.
 * @returns The per-tick DoT, or 0.
 */
function renderingDot(combatant: Combatant): number {
  const rendering = combatant.statuses.find(
    status => status.id === Statuses.rendering
  );
  return rendering?.power ?? 0;
}

/**
 * Add Pressure to a combatant and flip it to Broken once Pressure reaches
 * {@link CombatTuning.breakThreshold}. Broken is monotonic — once set it stays
 * set even if Pressure is later read as higher.
 * @param combatant - The combatant accruing Pressure.
 * @param amount - The Pressure to add.
 * @returns The combatant with updated Pressure and Broken flag.
 */
export function addPressure(combatant: Combatant, amount: number): Combatant {
  const pressure = combatant.pressure + amount;
  const broken = combatant.broken || pressure >= CombatTuning.breakThreshold;
  return { ...combatant, pressure, broken };
}

/**
 * Whether the Severance finisher is available against a combatant — true once
 * it is Broken.
 * @param combatant - The combatant to inspect.
 * @returns True when Severance is enabled.
 */
export function severanceAvailable(combatant: Combatant): boolean {
  return combatant.broken;
}

/**
 * The grist loot a defeated combatant yields: its enemy table value, or 0 when
 * the corpse is `spent` (a Rendering-kill), when the ref is not an enemy (a
 * party member), or when the ref is unknown.
 * @param combatant - The (defeated) combatant.
 * @returns The grist granted on defeat.
 */
export function lootGristFor(combatant: Combatant): number {
  if (combatant.spent) {
    return 0;
  }
  return ENEMIES[combatant.ref as EnemyId]?.lootGrist ?? 0;
}
