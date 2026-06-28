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

/** Canonical encounter ids (the slice's three rooms). */
export const EncounterIds = {
  warrenStreet: "warren-street",
  theDrip: "the-drip",
  theCage: "the-cage",
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
};
