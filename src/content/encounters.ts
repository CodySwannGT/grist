/**
 * Encounter definitions for the Marrow descent (the three slice rooms) as a typed
 * TS-module table. Each encounter's `enemies` list is a {@link EnemyId}[] so an
 * encounter can only reference defined enemies — referencing an undefined id is a
 * compile error. Pure data — no Phaser.
 * @module content/encounters
 */
import { ENEMIES, EnemyIds, type EnemyId } from "./enemies";

/** Battle backdrop ids (one per authored battle scene). */
export const Backdrops = {
  marrow: "marrow",
} as const;

/** A backdrop id. */
export type BackdropId = (typeof Backdrops)[keyof typeof Backdrops];

/**
 * An encounter definition: the typed enemy lineup plus the backdrop the Battle
 * scene loads. The party is supplied separately at battle start.
 */
export interface EncounterDef {
  readonly id: EncounterId;
  readonly enemies: readonly EnemyId[];
  readonly backdrop: BackdropId;
}

/** Canonical encounter ids (the slice's three rooms + the Ch.1 tutorial ambush). */
export const EncounterIds = {
  warrenStreet: "warren-street",
  theDrip: "the-drip",
  theCage: "the-cage",
  tutorialAmbush: "tutorial-ambush",
  drownedKingdom: "drowned-kingdom",
  requiemHall: "requiem-hall",
  deepAudit: "deep-audit",
  halcyonChase: "halcyon-chase",
  // ── Upper Vanta — the Crown + the Tiers (#128) ──────────────────────────────
  crownConcord: "crown-concord",
  mourneRefinery: "mourne-refinery",
  tiersMarket: "tiers-market",
  // ── Sylvemarch — the surviving forest (#129) ────────────────────────────────
  sylvanEnclave: "sylvan-enclave",
  weaveSpring: "weave-spring",
  greyingMarch: "greying-march",
  // ── Holtspire — the Anvil-city (#130) ───────────────────────────────────────
  theGreatFoundry: "the-great-foundry",
  frameYards: "frame-yards",
  ripperRow: "ripper-row",
} as const;

/** An encounter id (the literal-union of every defined encounter key). */
export type EncounterId = (typeof EncounterIds)[keyof typeof EncounterIds];

/**
 * The slice encounters: Warren Street (a lone scrapper), The Drip (scrapper +
 * render-construct — teaches Rendering/Break), and The Cage (the Ashling boss).
 * The mapped type binds each entry's `id` to its table key, so the key and the
 * `id` can never drift.
 */
export const ENCOUNTERS: {
  readonly [K in EncounterId]: EncounterDef & { readonly id: K };
} = {
  "warren-street": {
    id: EncounterIds.warrenStreet,
    enemies: [EnemyIds.marrowScrapper],
    backdrop: Backdrops.marrow,
  },
  "the-drip": {
    id: EncounterIds.theDrip,
    enemies: [EnemyIds.marrowScrapper, EnemyIds.renderConstruct],
    backdrop: Backdrops.marrow,
  },
  "the-cage": {
    id: EncounterIds.theCage,
    enemies: [EnemyIds.theAshling],
    backdrop: Backdrops.marrow,
  },
  // The Ch.1 "drop goes wrong" ambush (#105 AC2/AC3): a single weak House-Mourne
  // enforcer — the first tutorialized ATB fight, launched immediately after the
  // Sable reveal. One weak enemy keeps the deterministic autoWin win reliable.
  "tutorial-ambush": {
    id: EncounterIds.tutorialAmbush,
    enemies: [EnemyIds.houseEnforcer],
    backdrop: Backdrops.marrow,
  },
  // ── The Roots / the Deep encounters (#143) ────────────────────────────────
  // The buried-ruins encounter rooms. The backdrop reuses the shared `marrow`
  // placeholder (per-region art is out of scope; the Region scene resolves the
  // shared `region-backdrop` texture at boot). The Reach and Ashfall variant
  // encounter tables (authored in `content/regions`) draw DIFFERENT subsets of
  // these so the region reads observably differently across the Reckoning.
  "drowned-kingdom": {
    id: EncounterIds.drownedKingdom,
    enemies: [EnemyIds.drownedHusk],
    backdrop: Backdrops.marrow,
  },
  "requiem-hall": {
    id: EncounterIds.requiemHall,
    enemies: [EnemyIds.drownedHusk, EnemyIds.requiemWraith],
    backdrop: Backdrops.marrow,
  },
  "deep-audit": {
    id: EncounterIds.deepAudit,
    enemies: [EnemyIds.requiemWraith, EnemyIds.deepAuditor],
    backdrop: Backdrops.marrow,
  },
  // ── The Halcyon chase — the Ch.2 climax boss (#109, Story #96) ──────────────
  // A solo-boss encounter against the Halcyon frame-knight (the boss form,
  // distinct from the out-of-scope `halcyon` playable defector). Reuses the
  // shared `marrow` backdrop placeholder (per-region art is out of scope). The
  // lone boss block (difficulty 364) tops the escalation ladder as the strictly
  // hardest fight of the run — the end-of-Ch.2 climax. NO sim changes: the fight
  // plays on the reused Phase-2 ATB core (Pressure→Break→Severance), and the
  // shared grist pool funds the costed Bind that presses the Break — the live
  // "spend grist to win faster?" tension.
  "halcyon-chase": {
    id: EncounterIds.halcyonChase,
    enemies: [EnemyIds.halcyonKnight],
    backdrop: Backdrops.marrow,
  },
  // ── Upper Vanta encounters (#128) ───────────────────────────────────────────
  // The Crown + the Tiers rooms. Per decision 0003, new enemy families / stat
  // blocks are authored at authoring time and are OUT OF SCOPE here; these
  // encounters compose EXISTING enemies (House Concord enforcers hold the Crown's
  // cold order; render-constructs are the refinery's automated arbiters; the deep
  // auditor arbitrates House Mourne's refinery-spire). The backdrop reuses the
  // shared `marrow` placeholder (per-region art is out of scope; the Region scene
  // resolves the shared `region-backdrop` texture at boot). The Reach and Ashfall
  // variant tables (authored in `content/regions`) draw DIFFERENT subsets so upper
  // Vanta reads observably differently across the Reckoning.
  "crown-concord": {
    id: EncounterIds.crownConcord,
    enemies: [EnemyIds.houseEnforcer],
    backdrop: Backdrops.marrow,
  },
  "mourne-refinery": {
    id: EncounterIds.mourneRefinery,
    enemies: [EnemyIds.houseEnforcer, EnemyIds.deepAuditor],
    backdrop: Backdrops.marrow,
  },
  "tiers-market": {
    id: EncounterIds.tiersMarket,
    enemies: [EnemyIds.marrowScrapper, EnemyIds.renderConstruct],
    backdrop: Backdrops.marrow,
  },
  // ── Sylvemarch encounters (#129) ────────────────────────────────────────────
  // The Sidhe enclave, the Weave-spring, and the greying march. Per decision 0003,
  // new enemy families / stat blocks are authored at authoring time and are OUT OF
  // SCOPE here; these encounters compose EXISTING enemies (the enclave's wild
  // scavengers; the Weave-spring's render-touched wardens; the greying-march's
  // hollowed dead as the forest dies). The backdrop reuses the shared `marrow`
  // placeholder (per-region art is out of scope; the Region scene resolves the
  // shared `region-backdrop` texture at boot). The Reach and Ashfall variant tables
  // (authored in `content/regions`) draw DIFFERENT subsets so the Sylvemarch reads
  // observably differently across the Reckoning — verdant and alive in the Reach,
  // greying and dying in the Ashfall (by design its most painful transformation).
  "sylvan-enclave": {
    id: EncounterIds.sylvanEnclave,
    enemies: [EnemyIds.marrowScrapper],
    backdrop: Backdrops.marrow,
  },
  "weave-spring": {
    id: EncounterIds.weaveSpring,
    enemies: [EnemyIds.marrowScrapper, EnemyIds.renderConstruct],
    backdrop: Backdrops.marrow,
  },
  "greying-march": {
    id: EncounterIds.greyingMarch,
    enemies: [EnemyIds.drownedHusk, EnemyIds.requiemWraith],
    backdrop: Backdrops.marrow,
  },
  // ── Holtspire encounters (#130) ─────────────────────────────────────────────
  // The great foundry, the frame-yards (Halcyon's old life), and the black-market
  // ripper row. Per decision 0003, new enemy families / stat blocks are authored at
  // authoring time and are OUT OF SCOPE here; these encounters compose EXISTING
  // enemies (the foundry's automated frame-constructs under Caldecott muscle; the
  // frame-yards' scavenged derelict frames; the ripper-row's black-market enforcers
  // audited by a House Mourne arbiter). The backdrop reuses the shared `marrow`
  // placeholder (per-region art is out of scope; the Region scene resolves the
  // shared `region-backdrop` texture at boot until #200). The Reach and Ashfall
  // variant tables (authored in `content/regions`) draw DIFFERENT subsets so the
  // Anvil-city reads observably differently across the Reckoning — loud and working
  // in the Reach, cold and warlord-run in the Ashfall.
  "the-great-foundry": {
    id: EncounterIds.theGreatFoundry,
    enemies: [EnemyIds.renderConstruct, EnemyIds.houseEnforcer],
    backdrop: Backdrops.marrow,
  },
  "frame-yards": {
    id: EncounterIds.frameYards,
    enemies: [EnemyIds.marrowScrapper, EnemyIds.renderConstruct],
    backdrop: Backdrops.marrow,
  },
  "ripper-row": {
    id: EncounterIds.ripperRow,
    enemies: [EnemyIds.houseEnforcer, EnemyIds.deepAuditor],
    backdrop: Backdrops.marrow,
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Phase-3 escalation ladder (#108)
// ───────────────────────────────────────────────────────────────────────────
//
// The Phase-3 run reuses the Phase-2 ATB sim verbatim — there is NO new combat
// engine and NO combat-math change here. "Escalation" is a CONTENT-side ordering
// derived purely from each encounter's existing enemy stat blocks: a total
// function over the static {@link ENEMIES} table. The ladder is just an ordered
// list of existing {@link EncounterId}s; the sim plays each one unchanged.

/**
 * A pure difficulty score for an encounter, derived from its lineup's EXISTING
 * stat blocks. Sums, over every enemy, the offensive+survivability aggregate
 * `hp + pow + foc + def + wrd` (HP and DEF/WRD = how long the enemy survives the
 * party's output; POW/FOC = how hard it hits back). SPD/LCK/AP are deliberately
 * excluded: SPD only reorders ATB turns (not lethality), LCK is variance, and AP
 * is the enemy's own resource pool — none change how *dangerous* a lineup is to
 * grind down. A bigger lineup or heavier blocks ⇒ a strictly higher score, which
 * is exactly the ordering the run escalates along.
 *
 * This is a content-ordering metric, not combat math: it reads static data and
 * changes no formula the sim uses. Pure and total — no RNG, no Phaser, no I/O;
 * the same `def` always yields the identical number.
 * @param def - The encounter to score (its `enemies` are read against {@link ENEMIES}).
 * @returns The summed difficulty score (0 for an empty lineup).
 */
export function encounterDifficulty(def: EncounterDef): number {
  return def.enemies.reduce((total, enemyId) => {
    const { stats } = ENEMIES[enemyId];
    return total + stats.hp + stats.pow + stats.foc + stats.def + stats.wrd;
  }, 0);
}

/**
 * The Phase-3 run's escalating ATB encounters, in strictly-increasing
 * {@link encounterDifficulty} order (#108 AC: ">=4 distinct ATB encounters are
 * playable across the run" and "difficulty escalates"). Composed entirely from
 * the existing {@link ENCOUNTERS} — every entry plays on the reused Phase-2 sim,
 * so the ladder adds escalation without touching combat math. The ascent reads,
 * by score: tutorial-ambush (33) → warren-street (54) → drowned-kingdom (71) →
 * the-drip (154) → requiem-hall (167) → deep-audit (232) → the-cage (280) →
 * halcyon-chase (364), the Ch.2 climax boss appended as the strictly hardest
 * fight (#109). The strict-increase invariant is asserted in the test suite via
 * {@link isStrictlyEscalating}.
 */
export const ESCALATION_LADDER: readonly EncounterId[] = [
  EncounterIds.tutorialAmbush,
  EncounterIds.warrenStreet,
  EncounterIds.drownedKingdom,
  EncounterIds.theDrip,
  EncounterIds.requiemHall,
  EncounterIds.deepAudit,
  EncounterIds.theCage,
  EncounterIds.halcyonChase,
];

/**
 * Whether a ladder's {@link encounterDifficulty} strictly increases at every
 * step — each encounter strictly harder than the one before it (#108). A ladder
 * with a flat or descending step is not escalating. A 0- or 1-entry ladder is
 * vacuously escalating (no adjacent pair can violate the order). Pure — reads
 * only the static stat blocks via {@link encounterDifficulty}; no RNG, no Phaser.
 * @param ladder - The ordered encounter ids to check.
 * @returns True iff difficulty strictly increases across the whole ladder.
 */
export function isStrictlyEscalating(ladder: readonly EncounterId[]): boolean {
  return ladderScores(ladder).every(
    (score, index, scores) => index === 0 || score > scores[index - 1]!
  );
}

/**
 * The {@link encounterDifficulty} score for each ladder entry, in order. The
 * shared read both {@link isStrictlyEscalating} and {@link escalationErrors}
 * compute adjacent steps against, so the difficulty is derived once per id. Pure.
 * @param ladder - The ordered encounter ids to score.
 * @returns The per-entry difficulty scores, positionally aligned to `ladder`.
 */
function ladderScores(ladder: readonly EncounterId[]): readonly number[] {
  return ladder.map(id => encounterDifficulty(ENCOUNTERS[id]));
}

/**
 * The named errors for any non-increasing step in a ladder — the error-list
 * counterpart of {@link isStrictlyEscalating}, mirroring the `validateEnemyFamily`
 * idiom in `enemies.ts`. Each adjacent pair whose difficulty does not strictly
 * increase yields one error naming the offending step and its scores. An empty
 * list means the ladder strictly escalates. Pure — no RNG, no Phaser, no I/O.
 * @param ladder - The ordered encounter ids to check.
 * @returns One error string per non-increasing step ([] when strictly escalating).
 */
export function escalationErrors(
  ladder: readonly EncounterId[]
): readonly string[] {
  const scores = ladderScores(ladder);
  return ladder.flatMap((id, index) => {
    if (index === 0) {
      return [];
    }
    const prev = scores[index - 1]!;
    const here = scores[index]!;
    return here > prev
      ? []
      : [
          `step ${index} '${ladder[index - 1]!}' (${prev}) -> '${id}' (${here}) does not strictly increase`,
        ];
  });
}
