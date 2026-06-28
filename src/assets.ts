/**
 * Typed asset keys. Never pass raw string keys to the loader or factories —
 * import these so a missing/renamed asset is a compile error.
 *
 * This slice generates its placeholder art programmatically in the Preloader
 * (zero binary assets, zero licensing risk): a single white, tintable "unit"
 * texture stands in for every combatant sprite. When real art lands, the asset
 * pipeline (free-tex-packer-core + audiosprite + BMFont) generates this module
 * from `assets/src` — see the `phaser-asset-pipeline` skill.
 * @module assets
 */

/** Texture keys (generated as placeholder textures in the Preloader). */
export const TextureKeys = {
  /** The white, tintable combatant body placeholder (party + enemies). */
  Unit: "unit",
} as const;
