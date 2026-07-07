/**
 * The party-panel **presenter** (#249): the pure, Phaser-free formatter that turns a
 * projected {@link PartyRosterView} into the ordered display strings the Menu scene's
 * Party panel renders. Data in, strings out — it owns the panel's *wording and order*
 * (one compact stat line per roster member, then the roster-wide bench-build lines),
 * never any Phaser object. The {@link import("./party-panel").PartyPanel} is a thin
 * renderer over these strings, so the whole panel copy is unit-testable headless.
 *
 * The per-member line always carries the acceptance-criteria minimum — name and HP/AP
 * — plus the level and (when carried) the equipped shard. The build lines surface the
 * live bench build the save holds ("learned/learning spell per the bench Cinder
 * progress", the bench shards, the stat augments) only when it exists, so a fresh run
 * shows a clean roster with no empty "Build:" scaffolding.
 * @module ui/party-roster
 */
import {
  type PartyBuildView,
  type PartyMemberView,
} from "../logic/party-roster";
import { type Stats } from "../logic/combat/types";

/** The marker prefixing a member's equipped shard on its stat line. */
const SHARD_MARK = "◈";

/**
 * Format one roster member's compact stat line: name, level, HP, AP, and — when the
 * member carries one — the equipped shard. Always includes name + HP/AP (the
 * acceptance-criteria minimum), so every member reads as a real, inspectable character.
 * @param member - The projected member.
 * @returns The member's compact stat line.
 */
export function partyMemberLine(member: PartyMemberView): string {
  const head = `${member.name}  L${member.level}  HP${member.hp} AP${member.ap}`;
  return member.shard !== null ? `${head}  ${SHARD_MARK}${member.shard}` : head;
}

/**
 * Format the roster-wide bench-build lines from the projected build — the learned /
 * in-progress spells (the Cinder progress), the bench-equipped shards, and the stat
 * augments — each line emitted only when that slice has content, so a fresh run adds
 * no empty scaffolding. Returned in a stable order (spells, shards, augments).
 * @param build - The projected bench build.
 * @returns The bench-build display lines (possibly empty).
 */
export function partyBuildLines(build: PartyBuildView): readonly string[] {
  const spells = [
    ...build.learning.map(spell => `${spell.name} ${spell.pct}%`),
    ...build.learned.map(name => `${name} ✓`),
  ];
  const augments = (Object.keys(build.statBonuses) as (keyof Stats)[]).map(
    axis => `+${build.statBonuses[axis]} ${axis.toUpperCase()}`
  );
  return [
    ...(spells.length > 0 ? [`Spells: ${spells.join(", ")}`] : []),
    ...(build.benchShards.length > 0
      ? [`Bench shards: ${build.benchShards.join(", ")}`]
      : []),
    ...(augments.length > 0 ? [`Augments: ${augments.join(", ")}`] : []),
  ];
}
