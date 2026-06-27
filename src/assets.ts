/**
 * Typed asset keys. Never pass raw string keys to the loader or factories —
 * import these so a missing/renamed asset is a compile error.
 *
 * This starter generates its placeholder textures programmatically in the
 * Preloader (zero binary assets, zero licensing risk), so these are hand-authored
 * keys. When real art is added, the asset pipeline (free-tex-packer-core +
 * audiosprite + BMFont) generates this module from `assets/src` — see the
 * `phaser-asset-pipeline` skill.
 * @module assets
 */

/** Texture keys (generated as placeholder textures in the Preloader). */
export const TextureKeys = {
  Player: "player",
  Item: "item",
} as const;
