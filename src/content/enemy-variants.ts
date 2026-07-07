/**
 * The **Ashfall enemy-variant table** (`ASHFALL_ENEMY_VARIANTS`, #141, PRD #43 FR6)
 * — the per-base-enemy warped (Act II) reads the Reckoning drains every recurring
 * Act I foe into. Where the region schema (`enemy-families`, #138) authors the
 * warp per *family-per-region*, this table authors it per **base {@link EnemyId}**:
 * the seam the encounter tables read through, so an Ashfall encounter that lists the
 * same base enemies as its Reach counterpart nonetheless resolves **drained,
 * Gloom-touched variants** the instant the world turns (`open-world.md` "the same
 * bestiary, mourned"; `bestiary.md` "Ashfall variants").
 *
 * A variant is authored as pure DATA against {@link AshfallEnemyVariant}: a
 * drained-palette marker (the desaturated visual key the warped form renders under —
 * the marker is data; the desaturation render pass is out of scope), a warped stat
 * block distinct from (and, per the escalation motif, heavier than) its Reach base, a
 * per-element weakness/affinity map that gains a **Gloom** read, and a non-empty list
 * of new **entropy/Gloom attacks** (≥1 is required — the warped read that defines the
 * variant, mirroring {@link import("./enemies").AshfallVariant}). First-pass stats
 * (decision 0003): the *ratios* are the design; the constants tune against the
 * prototype.
 *
 * Variants resolve **through the live world-state flag** (`logic/world`, #134) with
 * {@link resolveEncounterEnemy}: the base {@link EnemyDef} (from {@link ENEMIES})
 * before the Reckoning, the warped variant after — the same `{ reach, ashfall }`
 * read-seam regions / families / economy use, so the encounter path never
 * re-implements the flip and never branches on the flag by hand. The "leaner
 * rewards" half of the harsher Act II economy is orthogonal: it is applied as a
 * world-state multiplier over these loot values in `content/economy`, not baked into
 * each variant's `lootGrist`, so the two dials stay independently tunable.
 *
 * Following the typed-table idiom of `enemies.ts` / `enemy-families.ts`: a mapped
 * type binds each entry's `baseId` to its table key (a drifted key is a compile
 * error), the key space is the closed {@link EnemyId} union, and the table is
 * `Partial` so a base enemy that never appears in an Ashfall encounter (e.g. the
 * Reach-only Halcyon chase boss) simply omits a variant. Pure data — ZERO Phaser
 * imports (FR9), no I/O, no RNG (`Math.random` / `Date.now` are lint-banned in game
 * code); every function here is a total function of its inputs.
 * @module content/enemy-variants
 */
import { Elements, type ElementId, type Stats } from "../logic/combat/types";
import {
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "../logic/world";
import {
  ENEMIES,
  EnemyIds,
  type AshfallAttack,
  type EnemyDef,
  type EnemyId,
} from "./enemies";
import { type EncounterDef } from "./encounters";

/**
 * The drained-palette markers the warped variants render under (the desaturated
 * visual keys — the marker is data; the desaturation render pass is out of scope).
 * Named so the vocabulary is written once and shared: `ash` for the Marrow/Vanta
 * ash-fall, `deep` for the drowned Roots/Deep.
 */
const DrainedPalettes = {
  ash: "ash-drained",
  deep: "deep-drained",
} as const;

/**
 * A single base enemy's warped **Ashfall variant** — the Act II read the Reckoning
 * drains it into (#141). `baseId` is the {@link EnemyId} this variant warps (bound
 * to its table key by the mapped type); `name` is the warped display name;
 * `drainedPalette` is the drained-palette marker; `stats` / `elements` / `lootGrist`
 * are the variant's own combat block (distinct from the base); `gloomAttacks` is the
 * non-empty list of new entropy/Gloom attacks the variant gains (≥1 Gloom attack
 * required, enforced by {@link validateAshfallVariant}). Reuses {@link AshfallAttack}
 * and the drained-palette convention from the family schema so the encounter seam and
 * the family seam speak the same warped vocabulary.
 */
export interface AshfallEnemyVariant {
  readonly baseId: EnemyId;
  readonly name: string;
  readonly drainedPalette: string;
  readonly stats: Stats;
  readonly elements: Partial<Record<ElementId, number>>;
  readonly lootGrist: number;
  readonly gloomAttacks: readonly AshfallAttack[];
}

/**
 * The Ashfall enemy-variant table. The mapped type binds each entry's `baseId` to
 * its table key, so the key and the `baseId` can never drift — the same idiom
 * `ENEMIES` / `ENEMY_FAMILIES` use. `Partial` because a base enemy that never rolls
 * in an Ashfall encounter table (the Reach-only Halcyon chase boss) authors no
 * variant. Every recurring Act II foe — the Marrow gangs, the render-constructs, the
 * Ashling, the House enforcers, and the drowned/wraith/Auditor Deep roster — gains a
 * drained, Gloom-touched read. First-pass stats (decision 0003).
 */
export const ASHFALL_ENEMY_VARIANTS: {
  readonly [K in EnemyId]?: AshfallEnemyVariant & { readonly baseId: K };
} = {
  "marrow-scrapper": {
    baseId: EnemyIds.marrowScrapper,
    name: "Ashen scrapper",
    drainedPalette: DrainedPalettes.ash,
    stats: { hp: 48, ap: 0, pow: 30, foc: 4, def: 4, wrd: 3, spd: 9, lck: 2 },
    elements: { gloom: 1.5 },
    lootGrist: 6,
    gloomAttacks: [
      {
        id: "entropy-scour",
        name: "Entropy Scour",
        element: Elements.gloom,
        power: 12,
      },
    ],
  },
  "render-construct": {
    baseId: EnemyIds.renderConstruct,
    name: 'Render-construct "Vesper" (unmade)',
    drainedPalette: DrainedPalettes.ash,
    stats: { hp: 130, ap: 6, pow: 26, foc: 13, def: 8, wrd: 7, spd: 8, lck: 4 },
    elements: { flux: 1.5, gloom: 1.5 },
    lootGrist: 10,
    gloomAttacks: [
      {
        id: "gloom-render",
        name: "Gloom Render",
        element: Elements.gloom,
        power: 14,
      },
    ],
  },
  "the-ashling": {
    baseId: EnemyIds.theAshling,
    name: "The Ashling, guttering",
    drainedPalette: DrainedPalettes.ash,
    stats: {
      hp: 420,
      ap: 20,
      pow: 44,
      foc: 21,
      def: 14,
      wrd: 13,
      spd: 14,
      lck: 8,
    },
    elements: { flux: 1.5, gloom: 1 },
    lootGrist: 20,
    gloomAttacks: [
      {
        id: "unmaking-ash",
        name: "Unmaking Ash",
        element: Elements.gloom,
        power: 22,
      },
    ],
  },
  "house-enforcer": {
    baseId: EnemyIds.houseEnforcer,
    name: "House Mourne remnant",
    drainedPalette: DrainedPalettes.ash,
    stats: { hp: 30, ap: 0, pow: 16, foc: 3, def: 2, wrd: 2, spd: 6, lck: 2 },
    elements: { gloom: 1.5 },
    lootGrist: 4,
    gloomAttacks: [
      {
        id: "entropy-strike",
        name: "Entropy Strike",
        element: Elements.gloom,
        power: 10,
      },
    ],
  },
  "drowned-husk": {
    baseId: EnemyIds.drownedHusk,
    name: "Drowned husk (dimmed)",
    drainedPalette: DrainedPalettes.deep,
    stats: { hp: 60, ap: 0, pow: 22, foc: 6, def: 5, wrd: 4, spd: 5, lck: 2 },
    elements: { flux: 1.5, gloom: 1.5 },
    lootGrist: 9,
    gloomAttacks: [
      {
        id: "drowning-gloom",
        name: "Drowning Gloom",
        element: Elements.gloom,
        power: 14,
      },
    ],
  },
  "requiem-wraith": {
    baseId: EnemyIds.requiemWraith,
    name: "Requiem wraith (unquiet)",
    drainedPalette: DrainedPalettes.deep,
    stats: { hp: 74, ap: 6, pow: 26, foc: 14, def: 6, wrd: 9, spd: 9, lck: 4 },
    elements: { flux: 0.5, gloom: 1 },
    lootGrist: 12,
    gloomAttacks: [
      {
        id: "requiem-gloom",
        name: "Requiem Gloom",
        element: Elements.gloom,
        power: 15,
      },
    ],
  },
  "deep-auditor": {
    baseId: EnemyIds.deepAuditor,
    name: "Deep Auditor (Reckoning-warped)",
    drainedPalette: DrainedPalettes.deep,
    stats: {
      hp: 110,
      ap: 16,
      pow: 33,
      foc: 18,
      def: 11,
      wrd: 14,
      spd: 9,
      lck: 7,
    },
    // Warped: the Auditor stops resisting Gloom and starts wielding it.
    elements: { gloom: 1 },
    lootGrist: 18,
    gloomAttacks: [
      {
        id: "entropy-verdict",
        name: "Entropy Verdict",
        element: Elements.gloom,
        power: 20,
      },
    ],
  },
};

/**
 * A base enemy resolved through the live world-state flag: the flat combat read the
 * encounter path consumes, unified across both states so a caller reads one shape.
 * `ref` is the content id (the base {@link EnemyId} — the variant overlays the base,
 * it does not mint a new battler ref, since the drained-palette render is out of
 * scope and the base art is what renders); `isAshfall` distinguishes the warped read;
 * `drainedPalette` / `gloomAttacks` are populated only in the Ashfall read.
 */
export interface ResolvedEncounterEnemy {
  readonly ref: EnemyId;
  readonly baseId: EnemyId;
  readonly name: string;
  readonly isAshfall: boolean;
  readonly stats: Stats;
  readonly elements: Partial<Record<ElementId, number>>;
  readonly lootGrist: number;
  readonly drainedPalette: string | null;
  readonly gloomAttacks: readonly AshfallAttack[];
}

/**
 * Whether a base enemy authors an Ashfall variant. Pure.
 * @param baseId - The base enemy id.
 * @returns True when {@link ASHFALL_ENEMY_VARIANTS} holds a variant for `baseId`.
 */
export function hasAshfallVariant(baseId: EnemyId): boolean {
  return ASHFALL_ENEMY_VARIANTS[baseId] !== undefined;
}

/**
 * The Ashfall variant authored for a base enemy, or null when it has none (a
 * Reach-only foe). Pure.
 * @param baseId - The base enemy id.
 * @returns The variant, or null.
 */
export function resolveAshfallVariant(
  baseId: EnemyId
): AshfallEnemyVariant | null {
  return ASHFALL_ENEMY_VARIANTS[baseId] ?? null;
}

/**
 * Resolve one encounter enemy *through* the world-state flag — the encounter read
 * seam (#141 AC scenario). Returns the base {@link EnemyDef} read before the
 * Reckoning and its warped Ashfall variant after (drained palette + Gloom attack),
 * so the SAME base enemy an encounter lists surfaces a different, harsher read the
 * instant the flag flips, with no per-call-site branching. A base enemy with no
 * authored variant reads its base block in *both* states (a safe Reach fallback).
 * Pure — delegates the selection to {@link resolveByWorldState}; the seed never
 * enters.
 * @param baseId - The base enemy id the encounter lists.
 * @param state - The current world-state.
 * @returns The flat resolved enemy for `state`.
 */
export function resolveEncounterEnemy(
  baseId: EnemyId,
  state: WorldState
): ResolvedEncounterEnemy {
  const base: EnemyDef = ENEMIES[baseId];
  const variant = resolveAshfallVariant(baseId);
  const reach: ResolvedEncounterEnemy = {
    ref: baseId,
    baseId,
    name: base.name,
    isAshfall: false,
    stats: base.stats,
    elements: base.elements,
    lootGrist: base.lootGrist,
    drainedPalette: null,
    gloomAttacks: [],
  };
  // No variant ⇒ the base read serves both states (never warps).
  if (variant === null) {
    const resolver: WorldStateResolver<ResolvedEncounterEnemy> = {
      reach,
      ashfall: reach,
    };
    return resolveByWorldState(state, resolver);
  }
  const ashfall: ResolvedEncounterEnemy = {
    ref: baseId,
    baseId,
    name: variant.name,
    isAshfall: true,
    stats: variant.stats,
    elements: variant.elements,
    lootGrist: variant.lootGrist,
    drainedPalette: variant.drainedPalette,
    gloomAttacks: variant.gloomAttacks,
  };
  return resolveByWorldState(state, { reach, ashfall });
}

/**
 * Resolve every enemy in an encounter through the world-state flag — the Reach
 * lineup before the Reckoning, the warped Ashfall lineup after. Pure; positionally
 * aligned to `encounter.enemies`.
 * @param encounter - The encounter whose enemy lineup to resolve.
 * @param state - The current world-state.
 * @returns The resolved lineup for `state`.
 */
export function resolveEncounterEnemies(
  encounter: EncounterDef,
  state: WorldState
): readonly ResolvedEncounterEnemy[] {
  return encounter.enemies.map(enemyId =>
    resolveEncounterEnemy(enemyId, state)
  );
}

/**
 * Validate one Ashfall variant against the warped-read schema (#141 AC scenario 2):
 * a non-blank drained-palette marker and at least one entropy/Gloom attack — the
 * warped read that defines the variant, mirroring the family-schema check. A variant
 * with a blank palette or no Gloom attack is an authoring slip surfaced as a named
 * error. Pure: reads only its input, allocates a fresh array, mutates nothing.
 * @param variant - The variant to inspect (the type is the happy path; this guards data forced past it).
 * @returns The list of error strings ([] when the variant is valid).
 */
export function validateAshfallVariant(
  variant: Partial<AshfallEnemyVariant> | undefined
): readonly string[] {
  if (variant === undefined || variant === null) {
    return ["ashfall variant is missing"];
  }
  const label =
    typeof variant.baseId === "string" ? variant.baseId : "<unknown>";
  const paletteError =
    typeof variant.drainedPalette !== "string" ||
    variant.drainedPalette.trim() === ""
      ? `ashfall variant '${label}' has a blank drained-palette marker`
      : "";
  const attacks = variant.gloomAttacks;
  if (!Array.isArray(attacks)) {
    return [
      paletteError,
      `ashfall variant '${label}' has no entropy/Gloom attack`,
    ].filter(message => message !== "");
  }
  const hasGloomAttack = attacks.some(a => a?.element === Elements.gloom);
  return [
    paletteError,
    !hasGloomAttack
      ? `ashfall variant '${label}' has no entropy/Gloom attack`
      : "",
  ].filter(message => message !== "");
}

/**
 * Validate the whole {@link ASHFALL_ENEMY_VARIANTS} table: every authored variant
 * complete, and every entry's `baseId` matching its table key (no drift). The
 * boolean read the load path gates on is {@link isCompleteAshfallVariantTable}.
 * Pure.
 * @returns One error per malformed / mis-keyed variant ([] when the table is valid).
 */
export function ashfallVariantTableErrors(): readonly string[] {
  return Object.entries(ASHFALL_ENEMY_VARIANTS).flatMap(([key, variant]) => {
    const keyError =
      variant !== undefined && variant.baseId !== key
        ? `ashfall variant keyed '${key}' declares a different baseId '${variant.baseId}'`
        : "";
    return [keyError, ...validateAshfallVariant(variant)].filter(
      message => message !== ""
    );
  });
}

/**
 * Whether the Ashfall variant table is complete — every authored variant valid and
 * correctly keyed (the boolean read of {@link ashfallVariantTableErrors}). Pure.
 * @returns True when the table passes validation.
 */
export function isCompleteAshfallVariantTable(): boolean {
  return ashfallVariantTableErrors().length === 0;
}
