/**
 * The **Act II reunion-quest catalog** as content-as-data (#140, PRD #43 — FR8 /
 * AC6). Act II is the FFVI "World of Ruin" beat: scattered by the Reckoning, the
 * player reassembles the secondary roster through **open, nonlinear reunion quests**
 * (`wiki/narrative/main-quest.md` Ch.7 — "Gathering the lost"). Each reunion is a
 * self-contained story that recruits one companion, and each is **optional/missable**
 * — the finale scales to the party you bring (`wiki/design/quest-design.md` — "Act II
 * reunion quests … each a self-contained story, each missable; who you find shapes the
 * finale").
 *
 * This module is the *authored data*: the four reunions (Quietus, Brother Asch,
 * Calliope "Cal" Quill, the Shrike) as a typed table, one entry per companion, each
 * naming the {@link PartyMemberId} it recruits, the Ashfall region where it is found,
 * and its environmental hook ("found, not pushed" — `wiki/design/quest-design.md`).
 * The *rules* (Ashfall-gating, nonlinear complete/bypass, the missable seal, the
 * roster-join, the determinism digest) live in `logic/party/reunion` — reunion quests
 * are authored zones/nodes on the reusable region-production framework, NOT a new
 * engine system. Adding or re-tuning a reunion is a data edit here; no engine change.
 *
 * Pure data + pure authoring/validation seams (mirroring `content/regions`): zero
 * Phaser, no I/O, no RNG. Every companion an entry recruits resolves to a defined
 * {@link PARTY} member, so a dangling roster reference is a compile error.
 * @module content/reunions
 */
import { PartyMemberIds, type PartyMemberId } from "./party";
import { RegionIds, type RegionId } from "./regions";

/**
 * Canonical reunion-quest ids — one per Act II secondary-roster companion. Reference
 * the keyed values rather than inline strings so a typo is a compile error and the
 * ordering has one source.
 */
export const ReunionIds = {
  quietus: "quietus",
  asch: "asch",
  cal: "cal",
  shrike: "shrike",
} as const;

/** A reunion-quest id (the literal-union of every {@link ReunionIds} value). */
export type ReunionId = (typeof ReunionIds)[keyof typeof ReunionIds];

/**
 * One authored reunion quest: the companion it recruits (a defined
 * {@link PartyMemberId}), the self-contained story's `name`, the Ashfall `region` it
 * is found in, and its environmental `hook` (the "found, not pushed" discovery beat).
 * Referenced by id so the reunion never embeds a live party object — the roster-join
 * resolves the companion by id through the {@link PARTY} table.
 */
export interface ReunionQuestDef {
  /** The reunion id (matches the table key). */
  readonly id: ReunionId;
  /** The party member this reunion recruits (a defined {@link PartyMemberId}). */
  readonly companion: PartyMemberId;
  /** The self-contained reunion story's display name. */
  readonly name: string;
  /** The Ashfall region the reunion is found in. */
  readonly region: RegionId;
  /** The environmental/overheard hook that surfaces the reunion (markers optional). */
  readonly hook: string;
}

/**
 * The **canonical order** the reunions append their companions to the roster in — a
 * stable, authored sequence so the projected active party reads the same for the same
 * set of completed reunions, regardless of the order the player actually completed
 * them in. Nonlinearity is a *play* property (any reunion in any order); the roster
 * projection is deterministic (this fixed order), so the digest and the save never
 * depend on completion order. Quietus leads — Ch.7 introduces "Q" first
 * (`wiki/narrative/main-quest.md`).
 */
export const REUNION_ORDER: readonly ReunionId[] = [
  ReunionIds.quietus,
  ReunionIds.asch,
  ReunionIds.cal,
  ReunionIds.shrike,
];

/**
 * The Act II reunion catalog. The mapped type binds each entry's `id` to its table
 * key, so the key and the `id` can never drift. Each entry recruits a distinct
 * secondary-roster companion authored in `content/party.ts`. Pure data — no Phaser.
 */
export const REUNIONS: {
  readonly [K in ReunionId]: ReunionQuestDef & { readonly id: K };
} = {
  quietus: {
    id: ReunionIds.quietus,
    companion: PartyMemberIds.quietus,
    name: "The Ghost in the Vault",
    // Q wakes inside a House Quill server-vault; the Wrack is the drowned industrial
    // sink where a Quill data-vault would have gone dark (`wiki/design/regions.md`).
    region: RegionIds.wrack,
    hook: "A dead screen in a flooded server-vault still whispers your name.",
  },
  asch: {
    id: ReunionIds.asch,
    companion: PartyMemberIds.asch,
    name: "The Fuelless Enclave",
    // The Ashfast enclave renounced grist; the Cinderfen's burned wetlands read as
    // the ascetic hinterland an enclave would withdraw to.
    region: RegionIds.cinderfen,
    hook: "Smoke with no grist-glow rises from a shuttered enclave in the fen.",
  },
  cal: {
    id: ReunionIds.cal,
    companion: PartyMemberIds.cal,
    name: "The Long Odds",
    // Cal flies the airship and bets on saving the world; Holtspire's high country
    // is where a disowned Quill pilot would hole up over a card table.
    region: RegionIds.holtspire,
    hook: "A rigged card game in a Holtspire tavern is one player short.",
  },
  shrike: {
    id: ReunionIds.shrike,
    companion: PartyMemberIds.shrike,
    name: "A Blade for Hire",
    // The Shrike works for whoever pays and travels with a single hound; the
    // Sylvemarch's contested marches are contract country.
    region: RegionIds.sylvemarch,
    hook: "A hound waits by a fresh contract nailed to a marchland post.",
  },
};

/**
 * Whether a reunion-quest definition is well-formed: a non-empty name/hook, a
 * companion that resolves to a defined {@link PartyMemberId}, and a region that
 * resolves to a defined {@link RegionId}. Pure and total — the content gate asserts
 * it on each authored reunion so a dangling companion/region is caught headless.
 * @param reunion - The candidate reunion definition.
 * @returns True when the reunion is structurally complete and its references resolve.
 */
export function isCompleteReunion(reunion: ReunionQuestDef): boolean {
  const companions = new Set<string>(Object.values(PartyMemberIds));
  const regions = new Set<string>(Object.values(RegionIds));
  return (
    reunion.name.length > 0 &&
    reunion.hook.length > 0 &&
    companions.has(reunion.companion) &&
    regions.has(reunion.region)
  );
}

/**
 * The data-only authoring seam for a reunion quest — the identity pass-through the
 * catalog is built through (mirrors `authorRegion`), so an authored reunion carries
 * no behavior, only shape. Pure.
 * @param reunion - The reunion definition to author.
 * @returns The same reunion definition, unchanged.
 */
export function authorReunion(reunion: ReunionQuestDef): ReunionQuestDef {
  return reunion;
}
