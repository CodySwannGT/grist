/**
 * The pure **party-roster projection** (#249) — the Phaser-free transform the pause
 * menu's **Party** panel renders. It turns a persisted {@link CurrentSave} into the
 * ordered {@link PartyRosterView} the panel and its `__VERIFY__` twin both read:
 * every active roster member with its name, level, and core stats (from the
 * authoritative {@link PARTY} table), the shard it carries, and its signature kit,
 * plus the roster-wide **bench build** state the save already holds (the learned /
 * in-progress spells the Cinder progress rides, the bench-equipped shards, and the
 * bench stat augments).
 *
 * It surfaces only what the DATA already carries — it invents no new system. Per
 * member the stat block is the member's own `PartyMemberDef`; the *live build* (the
 * learning progression, the bench shards, the stat augments) is a single run-wide
 * slice in the save (`save.build` / `save.learning` / `save.learned`), so it is
 * projected once as {@link PartyRosterView.build} ("where it exists") rather than
 * fabricated per member. The roster falls back to the Phase-1 starting party
 * (`[wren, tobi]`) when the save carries no roster the runtime recognizes — the same
 * guard {@link import("./save-run").runStateFromSave} uses so the panel never renders
 * empty for a fresh run whose `save.party` is `[]`.
 *
 * Zero Phaser, no I/O, no RNG — a total function of the save — so the panel stays a
 * thin renderer and the whole projection is unit-testable headless. Portrait/faceset
 * resolution is a UI concern and lives in the panel, not here, so this module stays
 * free of any asset coupling.
 * @module logic/party-roster
 */
import { PARTY, PartyMemberIds, type PartyMemberId } from "../content/party";
import { BOUNDS, type BoundId } from "../content/bounds";
import { SPELLS, type SpellId } from "../content/spells";
import { type Stats } from "./combat/types";
import {
  type CurrentSave,
  type SavedLearning,
  type SavedPartyMember,
} from "./save/types";

/**
 * The Phase-1 starting party (Wren + Tobi), in join order — the fallback roster when
 * a save carries none the runtime knows (a fresh run persists `party: []`). Mirrors
 * `run-state`'s starting roster so the panel and the run agree on the base party.
 */
const STARTING_ROSTER: readonly PartyMemberId[] = [
  PartyMemberIds.wren,
  PartyMemberIds.tobi,
];

/** The set of valid {@link PartyMemberId}s, for filtering a save's roster ids. */
const PARTY_IDS: ReadonlySet<string> = new Set(Object.values(PartyMemberIds));

/**
 * One in-progress spell unlock projected for display: the spell's display name and
 * its whole-percent progress in [0, 100].
 */
export interface PartySpellProgress {
  /** The spell's display name (e.g. "Cinder"). */
  readonly name: string;
  /** The unlock progress as a whole percent in [0, 100]. */
  readonly pct: number;
}

/**
 * The roster-wide **bench build** the save already holds — the "live build state
 * where it exists" the panel surfaces once for the party rather than per member (it
 * is a single run-wide slice, not a per-member field). Empty arrays / object when the
 * run has grown no build yet.
 */
export interface PartyBuildView {
  /** The fully-learned spells' display names, in saved order. */
  readonly learned: readonly string[];
  /** The in-progress spells (name + percent) — the Cinder progress rides here. */
  readonly learning: readonly PartySpellProgress[];
  /** The bench-equipped shards' display names, in equip order. */
  readonly benchShards: readonly string[];
  /** The permanent bench stat augments (a partial {@link Stats} delta). */
  readonly statBonuses: Partial<Stats>;
}

/**
 * A read-only, scene-agnostic snapshot of one roster member — the shape the Party
 * panel renders and its `__VERIFY__` twin asserts on. Carries the member id, name,
 * level, HP/AP (the acceptance-criteria minimum), the full 8-axis stat block (for the
 * detail line), the equipped shard's display name (or null), and the signature kit.
 */
export interface PartyMemberView {
  /** The party-member id (resolves to a `content/party` entry). */
  readonly id: PartyMemberId;
  /** The member's display name. */
  readonly name: string;
  /** The member's level. */
  readonly level: number;
  /** The member's base HP (from its `PartyMemberDef`). */
  readonly hp: number;
  /** The member's base AP (from its `PartyMemberDef`). */
  readonly ap: number;
  /** The member's full 8-axis base stat block. */
  readonly stats: Stats;
  /** The equipped shard's display name, or null when the member carries none. */
  readonly shard: string | null;
  /** The member's hand-authored signature actions. */
  readonly signature: readonly string[];
}

/**
 * The projected party panel view: the ordered roster (each member with its stats +
 * shard + signature), the member count, and the roster-wide bench build.
 */
export interface PartyRosterView {
  /** The active roster, in join order. */
  readonly members: readonly PartyMemberView[];
  /** The number of members in the roster (`members.length`). */
  readonly count: number;
  /** The roster-wide bench build (learning / bench shards / augments). */
  readonly build: PartyBuildView;
}

/**
 * Resolve the active roster ids from a persisted party, keeping only the recognized
 * {@link PartyMemberId}s in join order and falling back to the Phase-1 starting party
 * when none are known (a fresh run persists an empty party). Mirrors
 * `runStateFromSave`'s roster guard so the panel never renders empty.
 * @param party - The persisted party members.
 * @returns The active roster ids, in join order.
 */
function rosterIds(
  party: readonly SavedPartyMember[]
): readonly PartyMemberId[] {
  const known = party
    .map(member => member.id)
    .filter((id): id is PartyMemberId => PARTY_IDS.has(id));
  return known.length > 0 ? known : STARTING_ROSTER;
}

/**
 * Resolve a shard id to its display name, or null when the id is absent or foreign.
 * @param shard - The equipped-shard id, or undefined.
 * @returns The shard's display name, or null.
 */
function shardName(shard: string | undefined): string | null {
  if (shard === undefined) {
    return null;
  }
  return BOUNDS[shard as BoundId]?.name ?? null;
}

/**
 * Resolve a spell id to its display name, falling back to the raw id for a spell not
 * in the castable {@link SPELLS} table (e.g. a Bind action).
 * @param spell - The spell id.
 * @returns The spell's display name.
 */
function spellName(spell: string): string {
  return SPELLS[spell as SpellId]?.name ?? spell;
}

/**
 * Project one roster member into its view, reading the authoritative stat block from
 * {@link PARTY} and overlaying the persisted level + equipped shard when the save
 * carries an entry for it (a fallback-roster member has no saved entry, so its level
 * and shard come from the table).
 * @param id - The roster member id.
 * @param saved - The member's persisted entry, or undefined for a fallback member.
 * @returns The member view.
 */
function memberView(
  id: PartyMemberId,
  saved: SavedPartyMember | undefined
): PartyMemberView {
  const def = PARTY[id];
  const shard = saved !== undefined ? saved.shard : def.shard;
  return {
    id,
    name: def.name,
    level: saved?.level ?? def.level,
    hp: def.baseStats.hp,
    ap: def.baseStats.ap,
    stats: def.baseStats,
    shard: shardName(shard),
    signature: def.signatureKit,
  };
}

/**
 * Project an in-progress unlock into its display shape (name + whole percent).
 * @param entry - The persisted in-progress unlock.
 * @returns The projected spell progress.
 */
function learningView(entry: SavedLearning): PartySpellProgress {
  return {
    name: spellName(entry.spell),
    pct: Math.round(entry.progress * 100),
  };
}

/**
 * Project the roster-wide bench build from the save's build + learning slices.
 * @param save - The persisted save.
 * @returns The bench-build view.
 */
function buildView(save: CurrentSave): PartyBuildView {
  return {
    learned: save.learned.map(spellName),
    learning: save.learning.map(learningView),
    benchShards: save.build.equippedShards
      .map(id => shardName(id))
      .filter((name): name is string => name !== null),
    statBonuses: save.build.statBonuses,
  };
}

/**
 * Project a persisted {@link CurrentSave} into the Party panel view (#249): the active
 * roster (each member with its stats, shard, and signature) plus the roster-wide bench
 * build. The roster falls back to the Phase-1 starting party when the save carries none
 * the runtime knows, so a fresh run (whose `save.party` is `[]`) still lists Wren + Tobi.
 * Pure and total — a bad/foreign id is dropped rather than trusted, so a corrupt save
 * projects to a safe roster rather than throwing.
 * @param save - The persisted save to project.
 * @returns The Party panel view.
 */
export function projectPartyRoster(save: CurrentSave): PartyRosterView {
  const saved = new Map<string, SavedPartyMember>(
    save.party.map(member => [member.id, member])
  );
  const members = rosterIds(save.party).map(id =>
    memberView(id, saved.get(id))
  );
  return { members, count: members.length, build: buildView(save) };
}
