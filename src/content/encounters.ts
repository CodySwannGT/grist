/**
 * Encounter definitions for the Marrow descent (the three slice rooms) as a typed
 * TS-module table. Each encounter's `enemies` list is a {@link EnemyId}[] so an
 * encounter can only reference defined enemies — referencing an undefined id is a
 * compile error. Pure data — no Phaser.
 * @module content/encounters
 */
import { EnemyIds, type EnemyId } from "./enemies";

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
};
