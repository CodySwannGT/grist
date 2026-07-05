#!/usr/bin/env node
/**
 * pack-assets — the build-time asset pipeline (locked decision #7; the
 * `phaser-asset-pipeline` skill made real).
 *
 * Raw, human-editable art lives in `assets/src` and is NEVER loaded by the game
 * directly. This script packs it into runtime form under `public/assets` and
 * then regenerates the typed key module `src/assets.ts`, so a missing or
 * renamed asset is a **compile error**, never a silent black square:
 *
 *   assets/src/sprites/<atlas>/**\/*.png  → public/assets/atlases/<atlas>.png
 *                                           + <atlas>.json   (texture atlas,
 *                                           free-tex-packer-core, JsonHash —
 *                                           `load.atlas`)
 *   assets/src/images/**\/*.png           → public/assets/images/** (verbatim
 *                                           copy — full-screen backdrops and
 *                                           parallax layers that would bloat an
 *                                           atlas; `load.image`)
 *
 * The generated module exports:
 *   AtlasKeys  — one key per packed atlas.
 *   ImageKeys  — one key per standalone image (path-derived, stable).
 *   Frames     — per-atlas frame-name constants (every packed frame).
 *   TextureKeys — legacy Preloader-generated placeholder keys, kept only while
 *                 a scene still generates its texture programmatically; delete
 *                 the entry here when the last user is reskinned.
 *
 * Outputs are DETERMINISTIC (inputs sorted, no timestamps) and are committed:
 * the repo typechecks without running the pipeline, and CI can re-run this
 * script and `git diff --exit-code` to prove the committed outputs are current.
 *
 * Usage: node scripts/pack-assets.mjs [--check]
 *   --check  Re-pack into a temp staging area and fail (exit 1) if any
 *            committed output under public/assets or src/assets.ts is stale.
 * @module scripts/pack-assets
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ftpc from "free-tex-packer-core";

const { packAsync } = ftpc;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_SPRITES = join(ROOT, "assets", "src", "sprites");
const SRC_IMAGES = join(ROOT, "assets", "src", "images");
const OUT_ATLASES = join(ROOT, "public", "assets", "atlases");
const OUT_IMAGES = join(ROOT, "public", "assets", "images");

/**
 * Placeholder texture keys still generated at runtime by a Preloader
 * `generateTexture` call. Each entry is transitional art-debt: remove it the
 * moment the last scene using it loads real art instead.
 * @type {Readonly<Record<string, string>>}
 */
const LEGACY_GENERATED_TEXTURE_KEYS = {};

/**
 * free-tex-packer-core options shared by every atlas. Pixel-art-safe: no
 * rotation (Phaser frame flipping stays trivial), no trim (animation frames
 * keep identical dimensions so anchors never swim), 1px extrude (kills
 * bleeding at integer scales).
 * @param {string} textureName - The atlas basename.
 * @returns {object} Packer options.
 */
function packerOptions(textureName) {
  return {
    textureName,
    width: 4096,
    height: 4096,
    fixedSize: false,
    powerOfTwo: false,
    packer: "MaxRectsPacker",
    packerMethod: "Smart",
    padding: 2,
    extrude: 1,
    allowRotation: false,
    allowTrim: false,
    detectIdentical: true,
    exporter: "JsonHash",
    removeFileExtension: true,
    prependFolderName: true,
  };
}

/**
 * Recursively list every `.png` under a directory, sorted for determinism.
 * @param {string} dir - The directory to walk.
 * @returns {readonly string[]} Absolute file paths, sorted.
 */
function pngsUnder(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { recursive: true, withFileTypes: false })
    .map(entry => join(dir, String(entry)))
    .filter(path => path.endsWith(".png"))
    .sort();
}

/**
 * Turn an asset-relative path into a stable camelCase identifier, e.g.
 * `heroes/wren/idle-0.png` → `heroesWrenIdle0`.
 * @param {string} relPath - Path relative to its atlas/images root.
 * @returns {string} A TypeScript-safe identifier.
 */
function identifierFor(relPath) {
  const cleaned = relPath.replace(/\.png$/u, "");
  const parts = cleaned.split(/[^a-zA-Z0-9]+/u).filter(Boolean);
  const joined = parts
    .map((part, index) =>
      index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
  return /^[0-9]/u.test(joined) ? `_${joined}` : joined;
}

/**
 * Pack one atlas folder into its texture + JsonHash descriptor.
 * @param {string} atlasName - The folder / atlas basename.
 * @returns {Promise<{files: ReadonlyArray<{name: string, buffer: Buffer}>, frames: readonly string[]}>}
 *   The packed output files and the sorted frame names.
 */
async function packAtlas(atlasName) {
  const dir = join(SRC_SPRITES, atlasName);
  const inputs = pngsUnder(dir).map(path => ({
    path: relative(dir, path).split(sep).join("/"),
    contents: readFileSync(path),
  }));
  const files = await packAsync(inputs, packerOptions(atlasName));
  const jsonFile = files.find(file => file.name.endsWith(".json"));
  const parsed = JSON.parse(jsonFile.buffer.toString("utf8"));
  return { files, frames: Object.keys(parsed.frames).sort() };
}

/**
 * Render one generated `as const` record.
 * @param {string} name - The exported const name.
 * @param {string} doc - The JSDoc line.
 * @param {Readonly<Record<string, string>>} entries - identifier → key.
 * @returns {string} TypeScript source.
 */
function renderRecord(name, doc, entries) {
  const rows = Object.entries(entries).map(([id, key]) => `  ${id}: "${key}",`);
  const body = rows.length > 0 ? `\n${rows.join("\n")}\n` : "";
  return `/** ${doc} */\nexport const ${name} = {${body}} as const;\n`;
}

/**
 * Generate `src/assets.ts` from the packed results.
 * @param {ReadonlyArray<{name: string, frames: readonly string[]}>} atlases - Packed atlases.
 * @param {readonly string[]} imageRelPaths - Standalone image paths (relative).
 * @returns {string} The full module source.
 */
function renderKeysModule(atlases, imageRelPaths) {
  const header = `/**
 * Typed asset keys — GENERATED by \`bun run assets\` (scripts/pack-assets.mjs).
 * DO NOT EDIT BY HAND: add art under \`assets/src\` and re-run the pipeline.
 * Never pass raw string keys to the loader or factories — import these so a
 * missing/renamed asset is a compile error.
 * @module assets
 */\n\n`;
  const atlasKeys = Object.fromEntries(
    atlases.map(atlas => [identifierFor(atlas.name), `atlas-${atlas.name}`])
  );
  const imageKeys = Object.fromEntries(
    imageRelPaths.map(rel => [
      identifierFor(rel),
      `img-${rel
        .replace(/\.png$/u, "")
        .split(sep)
        .join("/")}`,
    ])
  );
  const frameBlocks = atlases
    .map(atlas => {
      const entries = atlas.frames
        .map(frame => `    ${identifierFor(frame)}: "${frame}",`)
        .join("\n");
      return `  ${identifierFor(atlas.name)}: {\n${entries}\n  },`;
    })
    .join("\n");
  return (
    header +
    renderRecord(
      "AtlasKeys",
      "Texture-atlas keys (one per packed `assets/src/sprites/<atlas>` folder).",
      atlasKeys
    ) +
    "\n" +
    renderRecord(
      "ImageKeys",
      "Standalone image keys (backdrops / parallax layers under `assets/src/images`).",
      imageKeys
    ) +
    "\n" +
    `/** Per-atlas frame names (every packed frame, path-derived). */\nexport const Frames = {\n${frameBlocks}\n} as const;\n` +
    (Object.keys(LEGACY_GENERATED_TEXTURE_KEYS).length > 0
      ? "\n" +
        renderRecord(
          "TextureKeys",
          "Legacy Preloader-generated placeholder keys (transitional art-debt).",
          LEGACY_GENERATED_TEXTURE_KEYS
        )
      : "")
  );
}

/**
 * Run the pipeline: pack every atlas, copy every standalone image, regenerate
 * the typed key module.
 * @returns {Promise<{outputs: Map<string, Buffer|string>}>} Every produced
 *   output keyed by repo-relative path.
 */
async function build() {
  const outputs = new Map();
  const atlasNames = existsSync(SRC_SPRITES)
    ? readdirSync(SRC_SPRITES, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort()
    : [];
  const atlases = [];
  for (const name of atlasNames) {
    const { files, frames } = await packAtlas(name);
    for (const file of files) {
      outputs.set(join("public", "assets", "atlases", file.name), file.buffer);
    }
    atlases.push({ name, frames });
  }
  const imageRelPaths = pngsUnder(SRC_IMAGES).map(path =>
    relative(SRC_IMAGES, path)
  );
  for (const rel of imageRelPaths) {
    outputs.set(
      join("public", "assets", "images", rel),
      readFileSync(join(SRC_IMAGES, rel))
    );
  }
  outputs.set(
    join("src", "assets.ts"),
    renderKeysModule(atlases, imageRelPaths)
  );
  return { outputs };
}

/**
 * SHA-256 of a buffer/string, for --check comparison.
 * @param {Buffer|string} content - The content to digest.
 * @returns {string} Hex digest.
 */
function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Entry point.
 * @returns {Promise<void>} Resolves when outputs are written (or verified).
 */
async function main() {
  const check = process.argv.includes("--check");
  const { outputs } = await build();
  if (check) {
    const stale = [...outputs.entries()].filter(([rel, content]) => {
      const path = join(ROOT, rel);
      return (
        !existsSync(path) || digest(readFileSync(path)) !== digest(content)
      );
    });
    if (stale.length > 0) {
      console.error(
        `pack-assets --check: ${stale.length} stale output(s):\n` +
          stale.map(([rel]) => `  ${rel}`).join("\n") +
          "\nRun `bun run assets` and commit the results."
      );
      process.exit(1);
    }
    console.log("pack-assets --check: all committed outputs are current.");
    return;
  }
  rmSync(OUT_ATLASES, { recursive: true, force: true });
  rmSync(OUT_IMAGES, { recursive: true, force: true });
  for (const [rel, content] of outputs) {
    const path = join(ROOT, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(
    `pack-assets: wrote ${outputs.size} output(s) ` +
      `(${[...outputs.keys()].filter(rel => rel.includes("atlases")).length} atlas file(s)).`
  );
}

await main();
