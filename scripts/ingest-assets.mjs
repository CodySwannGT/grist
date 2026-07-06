#!/usr/bin/env node
/**
 * ingest-assets — the (re-runnable) carving of the sourced art into `assets/src`,
 * the raw-art input tree of the asset pipeline (pack-assets.mjs).
 *
 * This is the PROVENANCE record for every sprite in the game. Two source lanes
 * feed it, and each lane's provenance lives with its evidence in
 * `assets/LICENSES.md`:
 *
 * 1. **PixelLab (bespoke, #203)** — the party + enemy battler cast and the
 *    dialogue portraits are AI-generated pixel art (PixelLab, art-bible-fidelity,
 *    Option B on #203/#199). There is NO re-downloadable pack: the committed
 *    generated PNGs under `assets/pixellab-raw/<ref>/` ARE the provenance, and
 *    `assets/pixellab-manifest.json` traces every ref to its PixelLab
 *    `character_id` + per-step job ids. PixelLab pads each canvas ~50% around the
 *    character; {@link ingestPixellab} trims each ref with ONE uniform crop rect
 *    (the union content box across all of that ref's frames — never a per-frame
 *    auto-crop, so anchors never swim) and writes engine-named frames into
 *    `sprites/battlers/<ref>/` + `sprites/portraits/`. Deterministic and
 *    reproducible from the committed raw with `--pixellab` (no packs needed);
 *    the computed rects are recorded back into the manifest.
 * 2. **Ninja Adventure + Warped City (CC0)** — battle FX (`sprites/fx/`), UI
 *    chrome (`sprites/ui/`), temp audio (`audio/`), and the per-region parallax
 *    backdrops (`images/<region>/`) are still carved from the CC0 packs (verified
 *    layout conventions below). These require `--packs <dir>` (packs are large
 *    and not committed).
 *
 * - FX strips: fixed-width frames left→right (frame sizes per entry below).
 *
 * The battler folder names are the game's OWN content refs (`Combatant.ref` /
 * party-member ids), so a packed frame name is `<ref>/<anim>` and the scene can
 * map a combatant to its art with zero lookup tables.
 *
 * Usage:
 *   node scripts/ingest-assets.mjs --pixellab            # battlers+portraits only
 *   node scripts/ingest-assets.mjs --packs <downloads>   # full rebuild (CC0 + pixellab)
 * @module scripts/ingest-assets
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "src");

/** Committed PixelLab raw frames (the provenance; no re-downloadable pack). */
const PIXELLAB_RAW = join(ROOT, "assets", "pixellab-raw");
/** The PixelLab machine record (character_id + per-step job ids per ref). */
const PIXELLAB_MANIFEST = join(ROOT, "assets", "pixellab-manifest.json");

/**
 * PixelLab renders the four cardinal facings under compass names; the engine's
 * battler frame contract (`ui/battler-view`) uses screen-relative names. This is
 * the one place the two vocabularies meet.
 */
const PIXELLAB_DIR = {
  south: "down",
  north: "up",
  west: "left",
  east: "right",
};

/**
 * The party refs whose PixelLab kit includes a `taking-punch` hurt template —
 * their most-collapsed hurt frame becomes the dedicated `dead` pose (#203 party
 * death). Enemies ship no hurt kit; their downed pose stays the idle frame
 * (dimmed by the scene), matching the `monster` art kind in `ui/battler-view`.
 */
const PIXELLAB_PORTRAIT_REFS = new Set(["wren", "tobi", "halcyon", "sable"]);

/**
 * Battle FX strips: name, source, frame width/height, frame count. The three
 * base flavors (slash/spark/smoke) plus the five per-element strips and the
 * Break burst (#201). Every element's strip is a distinct Ninja Adventure
 * `FX/Elemental/` sheet so an action reads by element; the view layer tints each
 * to the combat color language (Flux cyan-white … Gloom void-black). Frame
 * sizes were derived empirically from each sheet (single row, N equal cells) —
 * `width / count` per strip, height = sheet height.
 */
const FX = [
  {
    name: "slash",
    file: "FX/Slash/SpriteSheetSlash01.png",
    w: 26,
    h: 32,
    count: 5,
  },
  {
    name: "spark",
    file: "FX/Magic/Spark/SpriteSheet.png",
    w: 45,
    h: 35,
    count: 6,
  },
  {
    name: "smoke",
    file: "FX/Smoke/Smoke/SpriteSheet.png",
    w: 32,
    h: 32,
    count: 6,
  },
  // ── Per-element craft FX (#201) — one Elemental strip per combat element. ──
  {
    name: "flux",
    file: "FX/Elemental/Thunder/SpriteSheet.png",
    w: 20,
    h: 28,
    count: 8,
  },
  {
    name: "ash",
    file: "FX/Elemental/Flam/SpriteSheet.png",
    w: 25,
    h: 30,
    count: 8,
  },
  {
    name: "iron",
    file: "FX/Elemental/Rock/SpriteSheet.png",
    w: 30,
    h: 30,
    count: 14,
  },
  {
    name: "bloom",
    file: "FX/Elemental/Plant/SpriteSheet.png",
    w: 30,
    h: 28,
    count: 8,
  },
  {
    name: "gloom",
    file: "FX/Elemental/Ice/SpriteSheet.png",
    w: 32,
    h: 32,
    count: 10,
  },
  // The Break burst — the dedicated Pressure→Break visual moment.
  {
    name: "break",
    file: "FX/Elemental/Explosion/SpriteSheet.png",
    w: 40,
    h: 40,
    count: 9,
  },
];

/**
 * UI chrome copied verbatim from Ninja Adventure (already pixel-art). The
 * `panel` piece is the pack's purpose-built 9-slice frame (`ThemeMetal3` — a
 * dark, near-black terminal screen behind a teal etched bezel with rounded
 * corners) used as a Phaser NineSlice for every chrome panel (menus, HUD
 * framing, the dialogue caption box, choice/command buttons). Its dark interior
 * keeps the light HUD text legible while the bezel reads as the art bible's
 * "corporate-terminal frame etched with old sigils"; a grist-gold NineSlice tint
 * marks the active/selected surface (#202). `dialog-box`/`choice-box` are the
 * pack's flat boxes and `arrow` is the selection cursor.
 */
const UI = [
  { name: "dialog-box", file: "Ui/Dialog/DialogBox.png" },
  { name: "choice-box", file: "Ui/Dialog/ChoiceBox.png" },
  { name: "arrow", file: "Ui/Arrow.png" },
  { name: "panel", file: "Ui/Theme/Wip/ThemeMetal3/nine_path_panel.png" },
];

/**
 * The three CC0 Warped City parallax layers (far → near), the single source set
 * every region's backdrop is carved from. `bg-1/2/3` are the pack's far/mid/near
 * plates; the `layer` name is the region-relative output stem.
 */
const BACKDROP_LAYERS = [
  { layer: "bg-far", file: "assets/environment/bg-1.png" },
  { layer: "bg-mid", file: "assets/environment/bg-2.png" },
  { layer: "bg-near", file: "assets/environment/bg-3.png" },
];

/**
 * Per-region palette treatments over the one CC0 Warped City parallax set (#200,
 * PRD #43 Art pass II) — every live region in `content/regions` gets its OWN
 * distinct layered backdrop instead of sharing the Marrow plates. Cohesion over
 * variety: rather than seven unrelated packs, this is one artist's set (ansimuz,
 * CC0) palette-shifted per region toward its art-direction identity
 * (`wiki/design/art-direction.md` §Environment design). The recolor is a
 * deterministic `jimp` `.color()` pipeline (hue `spin` + `saturate`/`desaturate`
 * + `mix` toward the region's key colour + `darken`/`lighten`) so the derivation
 * is reproducible from the CC0 source and stays CC0. `marrow` keeps the pack
 * verbatim (`color: []`) — its native neon-over-bone read is the signature look.
 *
 * The `mix` toward each region's key colour dominates the final palette, so a
 * region reads as its colour family regardless of the source hue; `spin` +
 * saturation shape the secondary tones so no two regions collide.
 * @type {ReadonlyArray<{ region: string, color: ReadonlyArray<{ apply: string, params: readonly unknown[] }> }>}
 */
const REGION_BACKDROPS = [
  // The Marrow — neon, rain, ancient bone: the untouched Warped City set.
  { region: "marrow", color: [] },
  // The Deep / Roots — luminous overgrown forest, the last bright Weave.
  {
    region: "roots",
    color: [
      { apply: "spin", params: [-105] },
      { apply: "saturate", params: [22] },
      { apply: "mix", params: [{ r: 46, g: 196, b: 120 }, 46] },
      { apply: "lighten", params: [4] },
    ],
  },
  // Upper Vanta / the Crown — cold glass spires, ordered gold corporate light.
  {
    region: "upper-vanta",
    color: [
      { apply: "desaturate", params: [16] },
      { apply: "spin", params: [40] },
      { apply: "mix", params: [{ r: 210, g: 192, b: 132 }, 42] },
      { apply: "lighten", params: [8] },
    ],
  },
  // Sylvemarch — verdant march: lusher, more yellow-green than the Deep.
  {
    region: "sylvemarch",
    color: [
      { apply: "spin", params: [-68] },
      { apply: "saturate", params: [28] },
      { apply: "mix", params: [{ r: 122, g: 190, b: 68 }, 46] },
      { apply: "lighten", params: [3] },
    ],
  },
  // Holtspire — foundry / industry: furnace amber over smoky iron.
  {
    region: "holtspire",
    color: [
      { apply: "spin", params: [150] },
      { apply: "saturate", params: [18] },
      { apply: "mix", params: [{ r: 202, g: 108, b: 40 }, 46] },
      { apply: "darken", params: [8] },
    ],
  },
  // Cinderfen — ashen fen: strip-mined greys, dead machinery, haunted.
  {
    region: "cinderfen",
    color: [
      { apply: "desaturate", params: [46] },
      { apply: "mix", params: [{ r: 122, g: 120, b: 108 }, 42] },
      { apply: "darken", params: [12] },
    ],
  },
  // Wrack — drowned gloom: deep sunken blue-teal, light-starved.
  {
    region: "wrack",
    color: [
      { apply: "spin", params: [28] },
      { apply: "desaturate", params: [10] },
      { apply: "mix", params: [{ r: 22, g: 74, b: 92 }, 52] },
      { apply: "darken", params: [20] },
    ],
  },
];

/**
 * Temp (demo-quality) audio → `assets/src/audio` (#115, PRD #42 Scope-IN
 * "temp-but-intentional audio", FR11). Copied verbatim from the Ninja Adventure
 * pack's CC0 `Audio/` tree (no re-encode) — one opening Choir-leitmotif fragment
 * (a short story theme) plus the three resonant stingers the demo hooks fire:
 * grist-spend (a gold chime), Break (a heavy impact), and Rendering (a spectral,
 * entropy-touched flourish). Placeholders, not finished score/SFX.
 */
const AUDIO = [
  { name: "choir-leitmotif.ogg", file: "Audio/Musics/6 - Story (Short).ogg" },
  { name: "grist-spend.wav", file: "Audio/Sounds/Bonus/Gold1.wav" },
  { name: "break.wav", file: "Audio/Sounds/Hit & Impact/Impact.wav" },
  { name: "rendering.wav", file: "Audio/Sounds/Magic & Skill/Spirit.wav" },
];

/**
 * Resolve the two pack roots from the --packs dir.
 * @param {string} packsDir - The downloads directory.
 * @returns {{ ninja: string, warped: string }} Absolute pack roots.
 */
function packRoots(packsDir) {
  const ninja = join(
    packsDir,
    "ninja-adventure-full",
    "Ninja Adventure - Asset Pack"
  );
  const warped = join(packsDir, "warped-city", "Warped City Phaser");
  for (const [label, path] of [
    ["Ninja Adventure", ninja],
    ["Warped City", warped],
  ]) {
    if (!existsSync(path)) {
      throw new Error(`${label} pack not found at ${path}`);
    }
  }
  return { ninja, warped };
}

/**
 * Crop one cell out of an image and write it as a lone frame PNG.
 * @param {import("jimp").JimpInstance} sheet - The source sheet.
 * @param {number} x - Cell left (px).
 * @param {number} y - Cell top (px).
 * @param {number} w - Cell width (px).
 * @param {number} h - Cell height (px).
 * @param {string} outPath - Destination PNG path.
 * @returns {Promise<void>} Resolves when written.
 */
async function writeCell(sheet, x, y, w, h, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  await sheet.clone().crop({ x, y, w, h }).write(outPath);
}

// ── PixelLab battler + portrait ingest (#203) ──────────────────────────────

/**
 * The opaque-pixel bounding box of one image (min/max x,y where alpha > 0), or
 * null when the image is fully transparent.
 * @param {import("jimp").JimpInstance} img - The frame image.
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function opaqueBox(img) {
  const { data, width, height } = img.bitmap;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

/**
 * The uniform crop rect for a ref: the union opaque box across EVERY frame the
 * engine emits for it, so a single rect trims all frames identically (anchors
 * stay put — never a per-frame auto-crop). PixelLab centers the character in a
 * ~50%-padded canvas, so this recovers the tight character cell.
 * @param {ReadonlyArray<import("jimp").JimpInstance>} frames - Every emitted frame.
 * @returns {{ x: number, y: number, w: number, h: number }} The shared crop rect.
 */
function unionCropRect(frames) {
  const boxes = frames.map(opaqueBox).filter(box => box !== null);
  if (boxes.length === 0) {
    const { width, height } = frames[0].bitmap;
    return { x: 0, y: 0, w: width, h: height };
  }
  const minX = Math.min(...boxes.map(b => b.minX));
  const minY = Math.min(...boxes.map(b => b.minY));
  const maxX = Math.max(...boxes.map(b => b.maxX));
  const maxY = Math.max(...boxes.map(b => b.maxY));
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * The engine frame name for a raw PixelLab frame file (compass facing → screen
 * facing), or null for a raw file the engine does not consume (the full attack
 * frame sets `attack-<dir>-fNN`, the extra hurt frames, contact sheets). The
 * single mid-swing `attack-<dir>.png` IS consumed (the held attack pose).
 * @param {string} file - The raw file name (e.g. `walk-south-3.png`).
 * @returns {string | null} The engine frame file name, or null to skip.
 */
function engineFrameName(file) {
  const walk = /^walk-(south|north|west|east)-([0-9]+)\.png$/u.exec(file);
  if (walk) {
    return `walk-${PIXELLAB_DIR[walk[1]]}-${walk[2]}.png`;
  }
  const idle = /^idle-(south|north|west|east)\.png$/u.exec(file);
  if (idle) {
    return `idle-${PIXELLAB_DIR[idle[1]]}.png`;
  }
  const attack = /^attack-(south|north|west|east)\.png$/u.exec(file);
  if (attack) {
    return `attack-${PIXELLAB_DIR[attack[1]]}.png`;
  }
  return null;
}

/**
 * The chosen `dead` source frame for a party ref: its most-collapsed
 * `hurt-south` frame (highest index), or null when the ref ships no hurt kit.
 * @param {readonly string[]} rawFiles - The ref's raw file names.
 * @returns {string | null} The hurt file to become `dead.png`, or null.
 */
function deadSourceFrame(rawFiles) {
  const hurt = rawFiles
    .filter(file => /^hurt-south-f[0-9]+\.png$/u.test(file))
    .sort();
  return hurt.length > 0 ? hurt[hurt.length - 1] : null;
}

/**
 * Trim one PixelLab ref: read every emitted frame, compute the ref's single
 * union crop rect, and write the cropped, engine-named frames into
 * `sprites/battlers/<ref>/` (+ the `dead` pose from the best hurt frame for a
 * party ref). Returns the rect + trimmed size for the manifest record.
 * @param {string} ref - The content ref (raw folder + output folder name).
 * @returns {Promise<{ trim: {x:number,y:number,w:number,h:number}, trimmedSize: {width:number,height:number} }>}
 */
async function trimBattlerRef(ref) {
  const rawDir = join(PIXELLAB_RAW, ref);
  const rawFiles = readdirSync(rawDir).filter(file => file.endsWith(".png"));
  const emitted = rawFiles
    .map(file => ({ file, engine: engineFrameName(file) }))
    .filter(entry => entry.engine !== null);
  const dead = deadSourceFrame(rawFiles);
  if (dead !== null) {
    emitted.push({ file: dead, engine: "dead.png" });
  }
  const images = await Promise.all(
    emitted.map(entry => Jimp.read(join(rawDir, entry.file)))
  );
  const rect = unionCropRect(images);
  const out = join(OUT, "sprites", "battlers", ref);
  mkdirSync(out, { recursive: true });
  await Promise.all(
    emitted.map((entry, index) =>
      images[index].clone().crop(rect).write(join(out, entry.engine))
    )
  );
  return {
    trim: rect,
    trimmedSize: { width: rect.w, height: rect.h },
  };
}

/**
 * Ingest the PixelLab cast: trim every battler ref from the committed raw frames
 * and copy the four dialogue portraits (64×64, no trim — the dialogue slot
 * downscales them). Rebuilds ONLY `sprites/battlers` + `sprites/portraits` (so
 * `--pixellab` can run without the CC0 packs) and records the per-ref crop rects
 * back into the manifest.
 * @returns {Promise<void>} Resolves when the pixellab source tree is rebuilt.
 */
async function ingestPixellab() {
  rmSync(join(OUT, "sprites", "battlers"), { recursive: true, force: true });
  rmSync(join(OUT, "sprites", "portraits"), { recursive: true, force: true });
  const refs = readdirSync(PIXELLAB_RAW, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const manifest = JSON.parse(readFileSync(PIXELLAB_MANIFEST, "utf8"));
  for (const ref of refs) {
    const rawDir = join(PIXELLAB_RAW, ref);
    const hasBattlerFrames = readdirSync(rawDir).some(file =>
      /^(idle|walk|attack)-/u.test(file)
    );
    if (hasBattlerFrames) {
      const record = await trimBattlerRef(ref);
      if (manifest[ref] !== undefined) {
        manifest[ref].trim = record.trim;
        manifest[ref].trimmedSize = record.trimmedSize;
      }
    }
    if (PIXELLAB_PORTRAIT_REFS.has(ref)) {
      const portraitOut = join(OUT, "sprites", "portraits", `${ref}.png`);
      mkdirSync(dirname(portraitOut), { recursive: true });
      copyFileSync(join(rawDir, "portrait.png"), portraitOut);
    }
  }
  writeFileSync(PIXELLAB_MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
}

/**
 * Carve the CC0-pack lane: FX strips, UI chrome, per-region backdrops, and temp
 * audio (everything NOT bespoke PixelLab art). Requires the downloaded packs.
 * @param {string} ninja - The Ninja Adventure pack root.
 * @param {string} warped - The Warped City pack root.
 * @returns {Promise<void>} Resolves when the CC0-derived tree is written.
 */
async function ingestPacks(ninja, warped) {
  for (const fx of FX) {
    const sheet = await Jimp.read(join(ninja, fx.file));
    for (let index = 0; index < fx.count; index++) {
      await writeCell(
        sheet,
        index * fx.w,
        0,
        fx.w,
        fx.h,
        join(OUT, "sprites", "fx", `${fx.name}-${index}.png`)
      );
    }
  }
  for (const piece of UI) {
    const img = await Jimp.read(join(ninja, piece.file));
    const outPath = join(OUT, "sprites", "ui", `${piece.name}.png`);
    mkdirSync(dirname(outPath), { recursive: true });
    await img.write(outPath);
  }
  for (const { region, color } of REGION_BACKDROPS) {
    for (const { layer, file } of BACKDROP_LAYERS) {
      const img = await Jimp.read(join(warped, file));
      if (color.length > 0) {
        img.color(color);
      }
      const outPath = join(OUT, "images", region, `${layer}.png`);
      mkdirSync(dirname(outPath), { recursive: true });
      await img.write(outPath);
    }
  }
  for (const clip of AUDIO) {
    const outPath = join(OUT, "audio", clip.name);
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(join(ninja, clip.file), outPath);
  }
  console.log("ingest-assets: CC0-pack lane (fx/ui/backdrops/audio) rebuilt.");
}

/**
 * Entry point. `--pixellab` rebuilds ONLY the bespoke battler + portrait tree
 * from the committed raw frames (no packs). `--packs <dir>` does a full rebuild:
 * the CC0-pack lane AND the pixellab lane.
 * @returns {Promise<void>} Resolves when assets/src is written.
 */
async function main() {
  const pixellabOnly = process.argv.includes("--pixellab");
  const flagIndex = process.argv.indexOf("--packs");
  const packsDir = flagIndex === -1 ? null : process.argv[flagIndex + 1];
  if (pixellabOnly && packsDir === null) {
    await ingestPixellab();
    console.log("ingest-assets: pixellab battlers + portraits rebuilt.");
    return;
  }
  if (packsDir === null || packsDir === undefined) {
    console.error(
      "usage: node scripts/ingest-assets.mjs [--pixellab | --packs <dir>]"
    );
    process.exit(1);
  }
  const { ninja, warped } = packRoots(packsDir);
  rmSync(OUT, { recursive: true, force: true });
  await ingestPacks(ninja, warped);
  await ingestPixellab();
  console.log(
    "ingest-assets: assets/src fully rebuilt (CC0 packs + pixellab)."
  );
}

await main();
