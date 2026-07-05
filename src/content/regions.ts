/**
 * The typed **region-authoring template** (#133) — the region-as-data scaffolding
 * built once and reused for every region (PRD #43 FR1/FR3, Scope-IN 1). A region
 * declares its identity, both world-state variants (Act I *Reach* + Act II
 * *Ashfall*), and per-variant content (key locations, encounter tables, authored
 * side-stories) plus exactly one Bound-site reference. New regions are added by
 * authoring a {@link RegionDef} — never by editing engine code.
 *
 * Both-states is the thesis: each region carries its content as a
 * {@link WorldStateResolver}-shaped `{ reach, ashfall }` pair (the framework
 * shipped by #134, `logic/world`), so the same authored map reads as two states
 * and {@link resolveRegionVariant} surfaces the live variant the instant the
 * Reckoning flips the flag — with no per-call-site branching. A region missing
 * either variant fails {@link validateRegion} (AC scenario 2).
 *
 * Follows the existing typed-table idiom of `enemies.ts` / `encounters.ts` /
 * `bounds.ts` / `map.ts`: a mapped type binds each entry's `id` to its table key,
 * encounter references are {@link EncounterId}s so an undefined id is a compile
 * error, and the Bound-site is a single {@link BoundId} so the "exactly one"
 * cardinality is type-enforced. Pure data — ZERO Phaser imports (FR9), no I/O, no
 * RNG (`Math.random` / `Date.now` are lint-banned in game code; this module reads
 * nothing ambient and is a total function of its inputs).
 *
 * Per-region *content* (full location/encounter/side-story rosters) is authored as
 * each increment is built (living docs, decision 0003); this module ships the
 * template plus a single canonical example region (`marrow`) as the "a new region
 * is added by authoring data" proof.
 * @module content/regions
 */
import {
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "../logic/world";
import { BoundIds, type BoundId } from "./bounds";
import { EncounterIds, type EncounterId } from "./encounters";

/**
 * A region's per-world-state visual/narrative tone. `verdant` is the Act I *Reach*
 * read of the map; `ashen` is its Act II *Ashfall* read after the Reckoning. A
 * thin enum so authored content names the same vocabulary the world-state demo
 * resolver (`uat/world-state-cell`) uses.
 */
export type RegionTone = "verdant" | "ashen";

/**
 * A named place within a region a variant surfaces (a landmark / hub / point of
 * interest). The Field scene that *renders* a location is out of scope; this is
 * the data it consumes.
 */
export interface RegionLocation {
  readonly id: string;
  readonly name: string;
}

/**
 * An authored side-story beat anchored to a region variant — the optional content
 * a variant offers beyond its critical path. The narrative runtime that *plays* a
 * side-story is out of scope; this is the authored data.
 */
export interface RegionSideStory {
  readonly id: string;
  readonly name: string;
}

/**
 * One world-state *variant* of a region: how the region reads in a single state
 * (`reach` or `ashfall`). Carries the variant's display name, its tone, its key
 * locations, the encounter table the variant rolls on (typed {@link EncounterId}s
 * so an undefined id is a compile error), and its authored side-stories. A region
 * declares one of these per state; the `boundSite` and `id` live on the region,
 * not the variant, because they are world-state-invariant.
 */
export interface RegionVariant {
  readonly name: string;
  readonly tone: RegionTone;
  readonly keyLocations: readonly RegionLocation[];
  readonly encounters: readonly EncounterId[];
  readonly sideStories: readonly RegionSideStory[];
}

/**
 * A region's both-states content: the {@link WorldStateResolver}-shaped
 * `{ reach, ashfall }` pair of variants the region resolves through the live
 * world-state flag. Reusing the resolver shape from `logic/world` means a region
 * reads through the flag with the same machinery encounters and economy use, and
 * makes "both variants present" a structural property of the type (a missing
 * variant is both a compile error on a literal and a runtime
 * {@link validateRegion} failure on data forced past the compiler).
 */
export type RegionStates = WorldStateResolver<RegionVariant>;

/**
 * A region definition — the region-as-data template. `id` is the region's stable
 * key (a free-form string: a *new* region is authored with its own id, never by
 * widening an engine-side union — that is the "added by authoring data, not code"
 * thesis); `boundSite` is the single Bound shard sited in the region (**at most
 * one**, type-enforced as a lone {@link BoundId}) and is **optional** — a region
 * that cages no Bound omits it (Story #128: upper Vanta's Crown "consumes, it
 * doesn't hold", so its anchor is the Ch.5 keystone, not a Bound site); `states`
 * carries both world-state variants. Everything is authored data: a new region is a
 * new `RegionDef`, no engine-code edit (AC scenario 1). Ids of regions registered in
 * {@link REGIONS} are additionally captured by the {@link RegionId} literal union for
 * table reads.
 */
export interface RegionDef {
  readonly id: string;
  /**
   * The single Bound shard sited in the region, or `undefined` when the region
   * cages none. Optional so a keystone-anchored region (upper Vanta, #128) is
   * expressible: the per-region Bound-site template
   * ({@link import("../logic/region/bound-site")}) is simply never opened for a
   * region without one, and consumers that fold the site (the requiem-hall Ch.4
   * gate, the region-cell digest) treat its absence explicitly rather than
   * dereferencing a phantom shard.
   */
  readonly boundSite?: BoundId;
  readonly states: RegionStates;
}

/** Canonical ids of the regions registered in {@link REGIONS}. */
export const RegionIds = {
  marrow: "marrow",
  roots: "roots",
  upperVanta: "upper-vanta",
  sylvemarch: "sylvemarch",
  holtspire: "holtspire",
} as const;

/** A registered region id (the literal-union of every {@link REGIONS} key). */
export type RegionId = (typeof RegionIds)[keyof typeof RegionIds];

/**
 * The region table. The mapped type binds each entry's `id` to its table key, so
 * the key and the `id` can never drift — the same idiom `ENEMIES` / `ENCOUNTERS` /
 * `BOUNDS` / `MARROW_MAP` use. The `marrow` region is the canonical example: the
 * Marrow descent authored against the template in both world-states (the verdant
 * Reach and the ashen Ashfall), siting the Marrow Bound shard.
 */
export const REGIONS: {
  readonly [K in RegionId]: RegionDef & { readonly id: K };
} = {
  marrow: {
    id: RegionIds.marrow,
    boundSite: BoundIds.marrowBound,
    states: {
      reach: {
        name: "The Marrow Reach",
        tone: "verdant",
        keyLocations: [
          { id: "warren-street", name: "Warren Street" },
          { id: "the-drip", name: "The Drip" },
        ],
        encounters: [EncounterIds.warrenStreet, EncounterIds.theDrip],
        sideStories: [{ id: "the-salvage-cache", name: "The Salvage Cache" }],
      },
      ashfall: {
        name: "The Marrow Ashfall",
        tone: "ashen",
        keyLocations: [
          { id: "warren-street", name: "Warren Street (ashen)" },
          { id: "the-cage", name: "The Cage" },
        ],
        encounters: [EncounterIds.theDrip, EncounterIds.theCage],
        sideStories: [{ id: "the-salvage-cache", name: "The Hollow Cache" }],
      },
    },
  },
  // The Roots / the Deep (#143): the buried pre-Sundering ruins beneath the corpse
  // — pooled wild Weave, old things lingering, the fantasy heart under the city
  // (wiki/design/regions.md). Sites Velith, the Deep-bound (the ancient near-free
  // power that remembers the Choir). Authored against the shipped template in BOTH
  // world-states: the verdant Reach (a last bright place, the Weave still pooled)
  // and the ashen Ashfall (the Weave guttering but not dead — a less-total decay
  // than other regions, still warped/desaturated). Reach and Ashfall draw DIFFERENT
  // encounter tables so the region reads observably differently across the
  // Reckoning. The Sidhe requiem-hall set-piece itself is #145 (out of scope here);
  // this authors it as a key location only.
  roots: {
    id: RegionIds.roots,
    boundSite: BoundIds.velithDeepbound,
    states: {
      reach: {
        name: "The Roots Reach",
        tone: "verdant",
        keyLocations: [
          { id: "drowned-old-kingdom", name: "The Drowned Old Kingdom" },
          { id: "sidhe-requiem-hall", name: "The Sidhe Requiem-Hall" },
        ],
        encounters: [EncounterIds.drownedKingdom, EncounterIds.requiemHall],
        sideStories: [
          { id: "the-choir-that-remembers", name: "The Choir That Remembers" },
        ],
      },
      ashfall: {
        name: "The Roots Ashfall",
        tone: "ashen",
        keyLocations: [
          {
            id: "drowned-old-kingdom",
            name: "The Drowned Old Kingdom (guttering)",
          },
          {
            id: "sidhe-requiem-hall",
            name: "The Sidhe Requiem-Hall (dimmed)",
          },
        ],
        encounters: [EncounterIds.requiemHall, EncounterIds.deepAudit],
        sideStories: [
          { id: "the-choir-that-remembers", name: "The Choir Gone Quiet" },
        ],
      },
    },
  },
  // Upper Vanta — the Crown + the Tiers (#128), the FIRST of Story #121's serial
  // Act I regions and the one that carries the Ch.5 keystone the others depend on.
  // Authored against the shipped template (framework #119, CLOSED) in BOTH
  // world-states, wiki-authoritative (`wiki/design/regions.md` — Vanta the vertical
  // hub; `wiki/narrative/main-quest.md` — Ch.5 the keystone):
  //   • The Crown — corporate spires on Aurel's skull (Concord Hall; House Mourne's
  //     refinery-spire; the Founding plaza); gold light, cold order.
  //   • The Tiers — the working city (Tobi's workshop; the grand market; Quill
  //     media-halls).
  // Unlike every other Act I region, upper Vanta cages NO Bound — "the Crown
  // consumes, it doesn't hold" (regions.md) — so `boundSite` is omitted and its lone
  // anchor is the Ch.5 keystone at the Mourne refinery-spire (the Act I climax
  // set-piece where Mr. Sallow triggers the Reckoning), modeled in
  // `logic/region/keystone`. Reach and Ashfall draw DIFFERENT encounter tables so
  // the region reads observably differently across the Reckoning: the Reach is gold
  // and orderly, the Ashfall half-collapsed and grey (the Crown bunkered/fled, the
  // Tiers shuttered and scavenger-run). Detailed stat blocks / palettes / dialogue
  // are living docs (decision 0003), out of scope; this authors the region identity,
  // key locations, per-region encounters, side-stories, and both variants.
  "upper-vanta": {
    id: RegionIds.upperVanta,
    // No boundSite — the Crown holds no Bound; the anchor is the Ch.5 keystone.
    states: {
      reach: {
        name: "Upper Vanta — the Crown & the Tiers",
        tone: "verdant",
        keyLocations: [
          { id: "concord-hall", name: "The Concord Hall" },
          {
            id: "mourne-refinery-spire",
            name: "House Mourne's Refinery-Spire",
          },
          { id: "founding-plaza", name: "The Founding Plaza" },
          { id: "tobis-workshop", name: "Tobi's Workshop" },
          { id: "grand-market", name: "The Grand Market" },
          { id: "quill-media-halls", name: "The Quill Media-Halls" },
        ],
        encounters: [EncounterIds.tiersMarket, EncounterIds.crownConcord],
        sideStories: [
          { id: "the-founding-holiday", name: "The Founding Holiday" },
          { id: "tobis-commission", name: "Tobi's Commission" },
        ],
      },
      ashfall: {
        name: "Upper Vanta — the Grey Crown & the Shuttered Tiers",
        tone: "ashen",
        keyLocations: [
          { id: "concord-hall", name: "The Concord Hall (bunkered)" },
          {
            id: "mourne-refinery-spire",
            name: "House Mourne's Refinery-Spire (the keystone struck)",
          },
          { id: "founding-plaza", name: "The Founding Plaza (ash-fallen)" },
          { id: "tobis-workshop", name: "Tobi's Workshop (shuttered)" },
          { id: "grand-market", name: "The Grand Market (scavenger-run)" },
          {
            id: "quill-media-halls",
            name: "The Quill Media-Halls (a few stubborn lights)",
          },
        ],
        encounters: [EncounterIds.crownConcord, EncounterIds.mourneRefinery],
        sideStories: [
          { id: "the-founding-holiday", name: "The Founding, Mourned" },
          { id: "tobis-commission", name: "Tobi's Last Commission" },
        ],
      },
    },
  },
  // The Sylvemarch (#129): the surviving forest, the Green Mother's march — a living
  // Deep place where the Weave still breathes, home to the Sidhe enclave (Maren's
  // people) and the brightest palette in the game (wiki/design/regions.md —
  // Sylvemarch). Sites Sylvath, the Green Wyrm (Bloom), the region's one Bound and a
  // major free-vs-wield decision (a great caged wyrm). Authored against the shipped
  // template in BOTH world-states: the verdant Reach (the brightest, most alive place
  // in Act I) and the ashen Ashfall (the forest greying and dying fast — by design
  // the most painful transformation). Reach and Ashfall draw DIFFERENT encounter
  // tables so the region reads observably differently across the Reckoning: the Reach
  // walks the Sidhe enclave and the Weave-spring; the Ashfall replaces the enclave
  // with the greying march as the living Weave guts out. The Sylvath Bound-site
  // free-vs-wield interaction reuses the shipped Bound-site template (#135) + Phase-2
  // kit (#69); this authors the region identity, key locations, per-region
  // encounters, side-stories, and both variants (stat blocks are living docs, 0003).
  sylvemarch: {
    id: RegionIds.sylvemarch,
    boundSite: BoundIds.sylvath,
    states: {
      reach: {
        name: "The Sylvemarch Reach",
        tone: "verdant",
        keyLocations: [
          { id: "sidhe-enclave", name: "The Sidhe Enclave" },
          { id: "weave-spring", name: "The Weave-Spring" },
          { id: "sundering-ruins", name: "The Overgrown Ruins" },
        ],
        encounters: [EncounterIds.sylvanEnclave, EncounterIds.weaveSpring],
        sideStories: [
          { id: "the-green-mothers-march", name: "The Green Mother's March" },
        ],
      },
      ashfall: {
        name: "The Sylvemarch Ashfall",
        tone: "ashen",
        keyLocations: [
          { id: "sidhe-enclave", name: "The Sidhe Enclave (fled)" },
          { id: "weave-spring", name: "The Weave-Spring (guttering)" },
          { id: "sundering-ruins", name: "The Overgrown Ruins (bared)" },
        ],
        encounters: [EncounterIds.weaveSpring, EncounterIds.greyingMarch],
        sideStories: [
          { id: "the-green-mothers-march", name: "The Green Mother, Mourned" },
        ],
      },
    },
  },
  // Holtspire (#130): the Anvil-city — a rival industrial city-state ruled by House
  // Caldecott, all foundries, frames, and smoke, and Caldecott's resentment of House
  // Mourne (wiki/design/regions.md — Holtspire, the Anvil-city). Sites Korrholt, the
  // Anvil-Heart (Iron), the region's one Bound: a power harnessed OPENLY as the city
  // reactor — the atrocity industrialized, so the free-vs-wield choice is at its
  // starkest. Authored against the shipped template in BOTH world-states: the verdant
  // Reach (the loud, working anvil-city; Halcyon's old frame-yards still turning) and
  // the ashen Ashfall (the foundries cold and silent, Caldecott a warlord remnant).
  // Reach and Ashfall draw DIFFERENT encounter tables so the region reads observably
  // differently across the Reckoning: the Reach works the great foundry and the
  // frame-yards; the Ashfall replaces the foundry with the black-market ripper row as
  // the warlord's economy takes over. The Korrholt Bound-site free-vs-wield interaction
  // reuses the shipped Bound-site template (#135) + Phase-2 kit (#69); this authors the
  // region identity, key locations, per-region encounters, side-stories, and both
  // variants (stat blocks / palettes / dialogue are living docs, decision 0003).
  holtspire: {
    id: RegionIds.holtspire,
    boundSite: BoundIds.korrholt,
    states: {
      reach: {
        name: "The Holtspire Reach — the Working Anvil-City",
        tone: "verdant",
        keyLocations: [
          { id: "the-great-foundry", name: "The Great Foundry" },
          { id: "the-frame-yards", name: "The Frame-Yards" },
          { id: "ripper-row", name: "The Black-Market Ripper Row" },
          { id: "the-anvil-heart", name: "Korrholt, the Anvil-Heart" },
        ],
        encounters: [EncounterIds.theGreatFoundry, EncounterIds.frameYards],
        sideStories: [
          { id: "caldecotts-resentment", name: "Caldecott's Resentment" },
        ],
      },
      ashfall: {
        name: "The Holtspire Ashfall — the Cold Foundries",
        tone: "ashen",
        keyLocations: [
          {
            id: "the-great-foundry",
            name: "The Great Foundry (cold and silent)",
          },
          { id: "the-frame-yards", name: "The Frame-Yards (rusting)" },
          { id: "ripper-row", name: "The Ripper Row (a warlord's market)" },
          { id: "the-anvil-heart", name: "Korrholt, the Anvil-Heart (banked)" },
        ],
        encounters: [EncounterIds.frameYards, EncounterIds.ripperRow],
        sideStories: [
          {
            id: "caldecotts-resentment",
            name: "Caldecott, the Warlord Remnant",
          },
        ],
      },
    },
  },
};

/**
 * Resolve a region's live {@link RegionVariant} *through* the world-state flag —
 * the region read seam. Returns the `reach` variant in Act I and the `ashfall`
 * variant in Act II, so the same authored region surfaces a different variant the
 * instant the Reckoning flips the flag, with no per-call-site branching. Pure —
 * delegates the selection to {@link resolveByWorldState}; the seed never enters.
 * @param region - The region to read.
 * @param state - The current world-state.
 * @returns The region's variant for `state`.
 */
export function resolveRegionVariant(
  region: RegionDef,
  state: WorldState
): RegionVariant {
  return resolveByWorldState(state, region.states);
}

/**
 * Whether a single variant is structurally complete: a non-blank name, at least
 * one key location, a non-empty encounter table. A blank/empty variant is an
 * authoring slip the {@link validateRegion} surfaces as a named error. Pure.
 * @param variant - The variant to inspect (may be absent on data forced past the compiler).
 * @param state - The world-state label the variant occupies (for error messages).
 * @returns The list of error strings for the variant ([] when valid).
 */
function variantErrors(
  variant: RegionVariant | undefined,
  state: WorldState
): readonly string[] {
  if (variant === undefined) {
    return [`region is missing its ${state} variant`];
  }
  // Build the error list as data (no mutation): each check contributes its
  // message or nothing, and the empty entries are filtered out.
  return [
    variant.name.trim() === "" ? `${state} variant has a blank name` : "",
    variant.keyLocations.length === 0
      ? `${state} variant declares no key locations`
      : "",
    variant.encounters.length === 0
      ? `${state} variant has an empty encounter table`
      : "",
  ].filter(message => message !== "");
}

/**
 * Validate a region against the both-states schema (AC scenario 2). Returns the
 * list of authoring errors — empty when the region is complete. A region missing
 * *either* world-state variant fails; so does a variant with a blank name, no key
 * locations, or an empty encounter table. The two variants are validated under
 * their state labels so the error names which one is wrong. Pure: reads only its
 * input, allocates a fresh array, mutates nothing.
 * @param region - The region to validate (the type is the happy path; this guards data forced past it).
 * @returns The list of error strings ([] when the region is valid).
 */
export function validateRegion(region: RegionDef): readonly string[] {
  const states = region.states as Partial<RegionStates> | undefined;
  return [
    ...variantErrors(states?.reach, "reach"),
    ...variantErrors(states?.ashfall, "ashfall"),
  ];
}

/**
 * Whether a region is complete — both world-state variants present and each
 * structurally valid (the boolean read of {@link validateRegion}). The predicate
 * the framework's load path gates on. Pure.
 * @param region - The region to check.
 * @returns True when the region passes both-states validation.
 */
export function isCompleteRegion(region: RegionDef): boolean {
  return validateRegion(region).length === 0;
}

/**
 * Author a region from plain data — the data-only authoring seam (AC scenario 1).
 * A thin identity-shaped constructor that returns its input typed as a
 * {@link RegionDef}, so a new region is declared as data and flows through the
 * same {@link resolveRegionVariant} / {@link validateRegion} framework the table
 * uses, with no engine wiring. Authoring a region never edits engine code; it
 * calls this (or adds an entry to {@link REGIONS}). Pure.
 * @param region - The region data to author.
 * @returns The authored region, typed as a RegionDef.
 */
export function authorRegion(region: RegionDef): RegionDef {
  return region;
}
