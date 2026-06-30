/**
 * Enemy definitions for the vertical slice ("The Bound in the Marrow") as a typed
 * TS-module table. HP, per-element weakness multipliers, and loot-grist are
 * authoritative from the vertical-slice-build; the remaining stats are first-pass
 * placeholders scaled to each enemy's role. Pure data — no Phaser.
 *
 * This module also ships the **enemy-family + Ashfall-variant stat-block schema**
 * (#138, PRD #43 FR6): the typed scaffolding by which every region declares its
 * enemies as data and reuses them across both world-states. An
 * {@link EnemyFamilyDef} tags one of the eight families ({@link EnemyFamilies}),
 * carries a {@link RegionStatBlock} per region it appears in, and authors an
 * {@link AshfallVariant} per region — a drained-palette marker plus the
 * entropy/Gloom attack hooks the Reckoning warps it with. The variant resolves
 * through the existing world-state flag (`logic/world`, #134) with
 * {@link resolveFamilyStatBlock}: the Reach stat block before the Reckoning, the
 * warped Ashfall block after — the same `{ reach, ashfall }` read-seam regions
 * and economy use, so the schema never re-implements the flip.
 *
 * Following the typed-table idiom of `regions.ts` / `encounters.ts` /
 * `bounds.ts`: a mapped type binds each family entry's `id` to its table key (an
 * undefined id is a compile error), and the eight family tags are a closed union
 * so an unknown tag fails both at compile time and in {@link validateEnemyFamily}.
 * Pure data — ZERO Phaser imports (FR9), no I/O, no RNG (`Math.random` /
 * `Date.now` are lint-banned in game code; this module reads nothing ambient and
 * is a total function of its inputs).
 *
 * The schema is the framework, not the content (per #138 Out of Scope, decision
 * 0003): a single canonical example family (`marrow-gang`) is authored here as the
 * "a family is added by authoring data" proof — the full per-region bestiary and
 * final v1 slot counts are authored as each region increment is built.
 * @module content/enemies
 */
import {
  Elements,
  Statuses,
  type ElementId,
  type StatusId,
  type Stats,
} from "../logic/combat/types";
import {
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "../logic/world";
import { BoundIds, type BoundId } from "./bounds";

/**
 * An enemy definition. `elements` maps an element to its damage multiplier
 * (1.5 = weak, 0.5 = resist, 0 = immune); an omitted element is normal (×1).
 * `ai` is the behavior-profile id the sim will dispatch on; `lootGrist` is the
 * grist awarded on defeat.
 *
 * Slice-only fields (#79): `element` is the enemy's *own* element (distinct from
 * the `elements` weakness map); `teaches` lists the status mechanics the fight
 * is the on-ramp for (e.g. Vesper teaches Rendering); `breakGatedPhase1` marks a
 * boss whose phase-1 damage window is gated behind a Break; `shardReward` is the
 * Bound shard dropped on defeat. All are optional so the Phase-1 trash enemies
 * stay shape-compatible.
 */
export interface EnemyDef {
  readonly id: EnemyId;
  readonly name: string;
  readonly stats: Stats;
  readonly elements: Partial<Record<ElementId, number>>;
  readonly ai: string;
  readonly lootGrist: number;
  readonly element?: ElementId;
  readonly teaches?: readonly StatusId[];
  readonly breakGatedPhase1?: boolean;
  readonly shardReward?: BoundId;
}

/** Canonical enemy ids. */
export const EnemyIds = {
  marrowScrapper: "marrow-scrapper",
  renderConstruct: "render-construct",
  theAshling: "the-ashling",
  houseEnforcer: "house-enforcer",
  drownedHusk: "drowned-husk",
  requiemWraith: "requiem-wraith",
  deepAuditor: "deep-auditor",
  halcyonKnight: "halcyon-knight",
} as const;

/** An enemy id (the literal-union of every defined enemy key). */
export type EnemyId = (typeof EnemyIds)[keyof typeof EnemyIds];

/**
 * The enemy AI behavior-profile ids the sim dispatches on. Authored as a const
 * map (the project's no-magic-strings idiom) so each profile id is written once
 * and shared across enemies — notably `breakBoss`, the Break-gated boss profile
 * (Pressure→Break→Severance) reused by every slice/region boss.
 */
const EnemyAi = {
  tempo: "tempo",
  renderPressure: "render-pressure",
  breakBoss: "break-boss",
} as const;

/**
 * The slice enemy roster. The mapped type binds each entry's `id` to its table
 * key, so the key and the `id` can never drift. Non-HP stats are first-pass.
 */
export const ENEMIES: {
  readonly [K in EnemyId]: EnemyDef & { readonly id: K };
} = {
  "marrow-scrapper": {
    id: EnemyIds.marrowScrapper,
    name: "Marrow scrapper",
    stats: { hp: 40, ap: 0, pow: 8, foc: 0, def: 4, wrd: 2, spd: 8, lck: 2 },
    elements: {},
    ai: EnemyAi.tempo,
    lootGrist: 6,
  },
  "render-construct": {
    id: EnemyIds.renderConstruct,
    name: 'Render-construct "Vesper"',
    stats: { hp: 70, ap: 6, pow: 6, foc: 10, def: 8, wrd: 6, spd: 7, lck: 4 },
    elements: { flux: 1.5 },
    ai: EnemyAi.renderPressure,
    lootGrist: 10,
    teaches: [Statuses.rendering],
  },
  "the-ashling": {
    id: EnemyIds.theAshling,
    name: "The Ashling",
    stats: {
      hp: 220,
      ap: 20,
      pow: 16,
      foc: 18,
      def: 14,
      wrd: 12,
      spd: 10,
      lck: 8,
    },
    elements: { flux: 1.5 },
    ai: EnemyAi.breakBoss,
    lootGrist: 20,
    element: Elements.ash,
    breakGatedPhase1: true,
    shardReward: BoundIds.marrowBound,
  },
  "house-enforcer": {
    id: EnemyIds.houseEnforcer,
    name: "House Mourne enforcer",
    // The Ch.1 "drop goes wrong" ambusher (#105): House muscle sent to recover
    // Sable. Deliberately the weakest enemy in the slice — lower HP than the
    // Phase-1 scrapper (HP40) and unarmored — so the first, tutorialized ATB
    // skirmish is reliably winnable for a fresh party and the deterministic
    // autoWin driver clears it under a fixed seed. First-pass non-HP stats.
    stats: { hp: 24, ap: 0, pow: 6, foc: 0, def: 2, wrd: 1, spd: 7, lck: 2 },
    elements: {},
    ai: EnemyAi.tempo,
    lootGrist: 4,
  },
  // ── The Roots / the Deep roster (#143) ────────────────────────────────────
  // First-pass stats (tuning deferred, decision 0003). These ride the buried
  // pre-Sundering ruins: the hollowed dead of the drowned old kingdom, the Sidhe
  // requiem-hall's lingering things, and the cold Auditors that audit the Deep.
  "drowned-husk": {
    id: EnemyIds.drownedHusk,
    name: "Drowned husk",
    stats: { hp: 52, ap: 0, pow: 9, foc: 2, def: 5, wrd: 3, spd: 5, lck: 2 },
    elements: { flux: 1.5 },
    ai: EnemyAi.tempo,
    lootGrist: 8,
  },
  "requiem-wraith": {
    id: EnemyIds.requiemWraith,
    name: "Requiem wraith",
    stats: { hp: 64, ap: 6, pow: 7, foc: 11, def: 6, wrd: 8, spd: 9, lck: 4 },
    elements: { flux: 0.5 },
    ai: EnemyAi.renderPressure,
    lootGrist: 11,
  },
  "deep-auditor": {
    id: EnemyIds.deepAuditor,
    name: "Deep Auditor",
    stats: {
      hp: 90,
      ap: 12,
      pow: 10,
      foc: 14,
      def: 10,
      wrd: 12,
      spd: 8,
      lck: 6,
    },
    elements: { gloom: 0.5 },
    ai: EnemyAi.breakBoss,
    lootGrist: 16,
  },
  // ── The Halcyon frame-knight — the Ch.2 chase boss (#109, Story #96 / PD-3.5,
  // PRD #42 FR3 + AC5) ───────────────────────────────────────────────────────
  // The enemy frame-knight Halcyon pilots at the climax of the Ch.2 chase — the
  // boss form, DISTINCT from the out-of-scope `halcyon` playable defector
  // (`content/party`). Authored as DATA reusing the shipped Phase-2 boss core:
  // the `break-boss` AI profile + `breakGatedPhase1` gate the phase-1 damage
  // window behind a Break (Pressure→Break→Severance), and the shared grist pool
  // funds the costed Bind that presses the Break faster — the live "spend grist
  // to win faster?" tension. NO sim changes: only a new stat block. The climax
  // of the run, so its lone block out-survives the slice Ashling boss (HP220) to
  // top the escalation ladder. First-pass non-HP stats (tuning deferred,
  // decision 0003).
  "halcyon-knight": {
    id: EnemyIds.halcyonKnight,
    name: "Halcyon, the frame-knight",
    stats: {
      hp: 300,
      ap: 24,
      pow: 18,
      foc: 16,
      def: 16,
      wrd: 14,
      spd: 12,
      lck: 8,
    },
    elements: { flux: 1.5 },
    ai: EnemyAi.breakBoss,
    lootGrist: 24,
    element: Elements.ash,
    breakGatedPhase1: true,
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Enemy-family + Ashfall-variant stat-block schema (#138, PRD #43 FR6)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The eight enemy families of Grist (PRD #43 FR6) as a closed keyed enum. A
 * family is the highest-level grouping a per-region stat block is authored under;
 * an entry tagged with anything outside this union is a compile error on a literal
 * and a {@link validateEnemyFamily} failure on data forced past the compiler. Use
 * the keyed values (e.g. `EnemyFamilies.frames`) rather than inline strings so a
 * typo is caught and there is one source of truth — the same idiom `Elements` /
 * `Statuses` use.
 */
export const EnemyFamilies = {
  /** Marrow gangs — the under-city scrappers of the Reach. */
  marrowGangs: "marrow-gangs",
  /** House enforcers — the standing muscle of the great Houses. */
  houseEnforcers: "house-enforcers",
  /** Frames — piloted exo-rigs. */
  frames: "frames",
  /** Vesper constructs — the render-pressure automata. */
  vesperConstructs: "vesper-constructs",
  /** Quill drones — the swarming surveyors. */
  quillDrones: "quill-drones",
  /** Rendered husks — the hollowed remains of the Rendering. */
  renderedHusks: "rendered-husks",
  /** Ashland horrors — the native terrors of the ash wastes. */
  ashlandHorrors: "ashland-horrors",
  /** The Auditors — the cold arbiters of the Reckoning. */
  auditors: "auditors",
} as const;

/** An enemy-family tag (the closed literal-union of the eight families). */
export type EnemyFamily = (typeof EnemyFamilies)[keyof typeof EnemyFamilies];

/** The set of valid family tags, for the runtime {@link validateEnemyFamily} guard. */
const ENEMY_FAMILY_VALUES: ReadonlySet<string> = new Set<string>(
  Object.values(EnemyFamilies)
);

/**
 * Whether a value is one of the eight defined enemy-family tags. The runtime
 * counterpart of the {@link EnemyFamily} compile-time union: a tag forced past the
 * compiler (e.g. authored content with a typo'd family) is caught here. Pure.
 * @param tag - The candidate family tag.
 * @returns True when `tag` is a defined family.
 */
export function isEnemyFamily(tag: string): tag is EnemyFamily {
  return ENEMY_FAMILY_VALUES.has(tag);
}

/**
 * A single warped attack a family gains in its Ashfall variant — the entropy/Gloom
 * hooks the Reckoning grants (PRD #43 FR6). `id` is the attack's stable key;
 * `name` is its display name; `element` is the (typed {@link ElementId}) damage
 * element — `gloom` for the void/entropy attacks that define the warped read.
 * `power` is the first-pass magnitude (final tuning is authoring-time, deferred).
 * Pure data; the runtime that *resolves* an attack into combat is elsewhere.
 */
export interface AshfallAttack {
  readonly id: string;
  readonly name: string;
  readonly element: ElementId;
  readonly power: number;
}

/**
 * A family's per-region **Reach** stat block — the base (Act I) read of the family
 * in one region. `region` is the region key the block is authored for (a free-form
 * string id matching a `content/regions` region, kept loose so a family is added
 * by authoring data, not by widening an engine union); `stats` is the combat
 * {@link Stats} block; `elements` is the per-element weakness multiplier map
 * (same convention as {@link EnemyDef}); `lootGrist` is the grist on defeat. This
 * is the pre-Reckoning value the {@link AshfallVariant} warps.
 */
export interface RegionStatBlock {
  readonly region: string;
  readonly stats: Stats;
  readonly elements: Partial<Record<ElementId, number>>;
  readonly lootGrist: number;
}

/**
 * A family's per-region **Ashfall** variant — the warped (Act II) read after the
 * Reckoning fires (PRD #43 FR6). `drainedPalette` is the drained-palette marker
 * (the desaturated visual key the warped form renders under — the schema carries
 * the marker; the desaturation render pass is out of scope). `stats` /
 * `elements` / `lootGrist` are the variant's own combat block, distinct from the
 * Reach block. `attacks` is the non-empty list of new entropy/Gloom attacks the
 * variant gains — at least one Gloom attack is required for a valid variant
 * (AC scenario 2), enforced by {@link validateEnemyFamily}.
 */
export interface AshfallVariant {
  readonly drainedPalette: string;
  readonly stats: Stats;
  readonly elements: Partial<Record<ElementId, number>>;
  readonly lootGrist: number;
  readonly attacks: readonly AshfallAttack[];
}

/**
 * A family's both-states content for a single region: the
 * {@link WorldStateResolver}-shaped `{ reach, ashfall }` pair the family resolves
 * through the live world-state flag. Reusing the resolver shape from `logic/world`
 * (#134) means a family reads through the flag with the same machinery regions and
 * economy use, and makes "both reads present" a structural property of the type
 * (a missing read is a compile error on a literal and a {@link validateEnemyFamily}
 * failure on data forced past the compiler).
 */
export interface FamilyRegionStates {
  /** The base Reach (Act I) stat block, read before the Reckoning. */
  readonly reach: RegionStatBlock;
  /** The warped Ashfall (Act II) variant, read after the Reckoning. */
  readonly ashfall: AshfallVariant;
}

/**
 * One region the family appears in, with both world-state reads. `region` is the
 * region key (mirrors {@link RegionStatBlock.region} for direct iteration); `reach`
 * is the base stat block; `ashfall` is the warped variant. Authored once per region
 * a family inhabits; {@link resolveFamilyStatBlock} selects the live read.
 */
export interface FamilyRegionEntry extends FamilyRegionStates {
  readonly region: string;
}

/**
 * An enemy-family definition — the family-as-data template (#138). `id` is the
 * family's stable key (a member of the closed {@link EnemyFamily} union, so an
 * unknown tag is a compile error); `name` is its display name; `regions` is the
 * non-empty list of per-region {@link FamilyRegionEntry} blocks, each carrying both
 * a Reach stat block and an Ashfall variant. Everything is authored data: a family
 * is a new {@link EnemyFamilyDef}, no engine-code edit. Ids of families registered
 * in {@link ENEMY_FAMILIES} are additionally captured by the
 * {@link RegisteredFamilyId} literal union for table reads.
 */
export interface EnemyFamilyDef {
  readonly id: EnemyFamily;
  readonly name: string;
  readonly regions: readonly FamilyRegionEntry[];
}

/**
 * Resolve a family's live stat block for a region *through* the world-state flag —
 * the family read seam (AC scenario 2). Returns the region's {@link RegionStatBlock}
 * (Reach) before the Reckoning and its {@link AshfallVariant} after, so the same
 * authored family surfaces a different block the instant the Reckoning flips the
 * flag, with no per-call-site branching. Returns null when the family has no entry
 * for `region`. Pure — delegates the selection to {@link resolveByWorldState}; the
 * seed never enters.
 * @param family - The family to read.
 * @param region - The region key to read the block for.
 * @param state - The current world-state.
 * @returns The family's Reach block in reach / Ashfall variant in ashfall for `region`, or null.
 */
export function resolveFamilyStatBlock(
  family: EnemyFamilyDef,
  region: string,
  state: WorldState
): RegionStatBlock | AshfallVariant | null {
  const entry = family.regions.find(r => r.region === region);
  if (entry === undefined) {
    return null;
  }
  // The resolver's two arms hold different types (Reach block vs. Ashfall
  // variant), so read through the flag against their common union — the same
  // `{ reach, ashfall }` selection regions use, widened to the per-state shapes.
  const resolver: WorldStateResolver<RegionStatBlock | AshfallVariant> = {
    reach: entry.reach,
    ashfall: entry.ashfall,
  };
  return resolveByWorldState(state, resolver);
}

/**
 * Whether a single Ashfall variant is structurally complete: a non-blank
 * drained-palette marker and at least one Gloom/entropy attack distinct from the
 * Reach block (AC scenario 2). A variant with a blank palette or no new attack is
 * an authoring slip {@link validateEnemyFamily} surfaces as a named error. Pure.
 * @param variant - The Ashfall variant to inspect (may be absent on data forced past the compiler).
 * @param region - The region label the variant occupies (for error messages).
 * @returns The list of error strings for the variant ([] when valid).
 */
function ashfallVariantErrors(
  variant: Partial<AshfallVariant> | undefined,
  region: string
): readonly string[] {
  if (variant === undefined || variant === null) {
    return [`family region '${region}' is missing its ashfall variant`];
  }
  // Guard each field against coerced data forced past the compiler: a malformed
  // variant (e.g. `ashfall: {}`) must yield authoring errors, never throw on
  // `.trim()` / `.some()` against a non-string / non-array.
  const paletteError =
    typeof variant.drainedPalette !== "string" ||
    variant.drainedPalette.trim() === ""
      ? `family region '${region}' ashfall variant has a blank drained-palette marker`
      : "";
  const attacks = variant.attacks;
  if (!Array.isArray(attacks)) {
    return [
      paletteError,
      `family region '${region}' ashfall variant has no new attacks`,
      `family region '${region}' ashfall variant has no entropy/Gloom attack`,
    ].filter(message => message !== "");
  }
  const hasGloomAttack = attacks.some(a => a?.element === Elements.gloom);
  return [
    paletteError,
    attacks.length === 0
      ? `family region '${region}' ashfall variant has no new attacks`
      : "",
    !hasGloomAttack
      ? `family region '${region}' ashfall variant has no entropy/Gloom attack`
      : "",
  ].filter(message => message !== "");
}

/**
 * Validate a region entry against the both-states schema: a non-blank region key,
 * a present Reach block, and a complete Ashfall variant. Pure.
 * @param entry - The region entry to validate (the type is the happy path; this guards data forced past it).
 * @returns The list of error strings ([] when the entry is valid).
 */
function regionEntryErrors(entry: FamilyRegionEntry): readonly string[] {
  const reach = entry.reach as RegionStatBlock | undefined;
  const region = typeof entry.region === "string" ? entry.region : "";
  return [
    region.trim() === ""
      ? "family has a region entry with a blank region key"
      : "",
    reach === undefined
      ? `family region '${region}' is missing its reach stat block`
      : "",
    // The Reach block's own region key must match its enclosing entry, or a
    // resolve/encounter lookup would read a block tagged for a different region.
    reach !== undefined && reach.region !== region
      ? `family region '${region}' reach stat block is tagged for a different region '${reach.region}'`
      : "",
    ...ashfallVariantErrors(entry.ashfall, region),
  ].filter(message => message !== "");
}

/**
 * Validate an enemy family against the family schema (AC scenarios 1 & 2). Returns
 * the list of authoring errors — empty when the family is complete. A family with
 * an unknown tag, no regions, or a region entry missing its Reach block or a valid
 * Ashfall variant (blank palette / no Gloom attack) fails. Pure: reads only its
 * input, allocates a fresh array, mutates nothing.
 * @param family - The family to validate (the type is the happy path; this guards data forced past it).
 * @returns The list of error strings ([] when the family is valid).
 */
export function validateEnemyFamily(family: EnemyFamilyDef): readonly string[] {
  // Only treat `regions` as iterable when it is genuinely an array — a coerced
  // shape (e.g. `regions: {}`) must produce an authoring error, not throw on
  // `.flatMap()`.
  const regions = Array.isArray(family.regions)
    ? (family.regions as readonly FamilyRegionEntry[])
    : undefined;
  const tagError = !isEnemyFamily(family.id)
    ? `family has an unknown family tag '${family.id}'`
    : "";
  const noRegionsError =
    regions === undefined || regions.length === 0
      ? "family declares no per-region stat blocks"
      : "";
  const regionErrors = (regions ?? []).flatMap(regionEntryErrors);
  const duplicateErrors = duplicateRegionErrors(regions ?? []);
  return [tagError, noRegionsError, ...regionErrors, ...duplicateErrors].filter(
    message => message !== ""
  );
}

/**
 * The errors for any region key that appears in more than one entry. A duplicate
 * region would let one entry silently shadow another under {@link find}-based
 * resolution, so the schema rejects it. Each duplicated key is reported once. Pure.
 * @param regions - The family's region entries.
 * @returns One error per duplicated region key ([] when all keys are unique).
 */
function duplicateRegionErrors(
  regions: readonly FamilyRegionEntry[]
): readonly string[] {
  // Pure (no mutation): tally each non-blank region key, then report the ones
  // that appear more than once, each exactly once.
  const keys = regions
    .map(entry => (typeof entry.region === "string" ? entry.region : ""))
    .filter(region => region !== "");
  const counts = keys.reduce<Readonly<Record<string, number>>>(
    (acc, region) => ({ ...acc, [region]: (acc[region] ?? 0) + 1 }),
    {}
  );
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([region]) => `family declares duplicate region entry '${region}'`);
}

/**
 * Whether a family is complete — a known tag, at least one region, and every
 * region entry carrying a Reach block and a valid Ashfall variant (the boolean
 * read of {@link validateEnemyFamily}). The predicate the framework's load path
 * gates on. Pure.
 * @param family - The family to check.
 * @returns True when the family passes schema validation.
 */
export function isCompleteEnemyFamily(family: EnemyFamilyDef): boolean {
  return validateEnemyFamily(family).length === 0;
}

/**
 * Author an enemy family from plain data — the data-only authoring seam (AC
 * scenario 1). A thin identity-shaped constructor that returns its input typed as
 * an {@link EnemyFamilyDef}, so a new family is declared as data and flows through
 * the same {@link resolveFamilyStatBlock} / {@link validateEnemyFamily} framework
 * the table uses, with no engine wiring. Authoring a family never edits engine
 * code; it calls this (or adds an entry to {@link ENEMY_FAMILIES}). Pure.
 * @param family - The family data to author.
 * @returns The authored family, typed as an EnemyFamilyDef.
 */
export function authorEnemyFamily(family: EnemyFamilyDef): EnemyFamilyDef {
  return family;
}
