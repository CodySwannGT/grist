/**
 * The pure build-hydration helper (#116) — the single place a persisted character
 * {@link import("../save/types").SavedBuild build}'s bench stat augments are folded
 * onto a base {@link Stats} block to produce the **effective** combat stats a battle
 * fields. The save layer persists the build as data ({@link import("../save/types").SavedBuild});
 * this is the consumer that turns that stored growth into the stats the deterministic
 * sim actually uses when a later battle is entered — so "growth persists into a later
 * battle" (the #116 AC) is a real code path, not just a round-tripped DTO.
 *
 * Pure and engine-free: data in, data out. No Phaser, no RNG, no I/O. Mirrors the
 * private `mergeStatBonuses` summing in `logic/run-state` (repeated axes add), but
 * folds a partial delta onto a *full* stat block rather than onto another partial.
 * @module logic/build/apply
 */
import { type Stats } from "../combat/types";

/**
 * Apply a build's partial stat-bonus delta onto a full base {@link Stats} block,
 * returning the effective combat stats. Each axis present in `bonuses` is summed
 * onto the matching base axis (an absent axis is unchanged), so a `{ spd: +5 }`
 * augment fields a combatant whose SPD is `base.spd + 5`. Pure — returns a fresh
 * stat block, never mutating either input.
 * @param base - The member's level-3 starting (base) stat block.
 * @param bonuses - The build's accumulated bench stat augments (a partial delta).
 * @returns The effective stat block with the bonuses folded in.
 */
export function applyStatBonuses(base: Stats, bonuses: Partial<Stats>): Stats {
  return (Object.keys(base) as (keyof Stats)[]).reduce<Stats>(
    (effective, axis) => ({
      ...effective,
      [axis]: base[axis] + (bonuses[axis] ?? 0),
    }),
    base
  );
}
