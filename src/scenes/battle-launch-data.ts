/**
 * The typed scene-data a launcher hands to the Battle scene when an encounter
 * fires (`this.scene.start(SceneKeys.Battle, data)`): the encounter id, the
 * deterministic seed, and the optional return-scene / banner / world-state a
 * region encounter threads. Keeping the shape here (co-located with the
 * `field-launch` / `region-launch` builders that populate it, not inline in the
 * scene) means a launcher and the battle-init can never drift on the key names.
 * @module scenes/battle-launch-data
 */

/** The typed launch payload the Field / Region hands the Battle scene. */
export interface BattleLaunchData {
  /** The encounter id the trigger fired (one of {@link import("../content").EncounterId}). */
  readonly encounterId: string;
  /** The 32-bit battle seed threaded from the field session for determinism. */
  readonly seed: number;
  /**
   * The scene to return to when the fight resolves (#241). Defaults to the Field when
   * absent — every existing Field↔Battle launch is unchanged — but a region encounter
   * launched from the World Map's region runner sets it to the Region scene so the win
   * flows back into the region's playlist progression rather than the Field.
   */
  readonly returnTo?: string;
  /**
   * The battle banner to render (#248) — the contextual title of the fight, derived
   * from the originating region's live world-state variant name (via
   * {@link import("../content").regionBattleTitle}) so a region encounter reads
   * "THE MARROW REACH" / "UPPER VANTA — …" rather than the fixed dungeon banner.
   * Absent on a Field/standalone launch, where the Battle scene keeps its authored
   * default ("MARROW DESCENT", the Marrow-descent tutorial's own name).
   */
  readonly title?: string;
  /**
   * The world-state the fielded enemies read (#266): `"ashfall"` fields each foe's
   * warped #141 variant (harsher HP/POW); absent ⇒ the base reads. A region
   * encounter threads its live `run.worldState`; Field/standalone launches omit it.
   */
  readonly worldState?: string;
}
