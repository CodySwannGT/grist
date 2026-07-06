#!/usr/bin/env node
/**
 * ingest-assets — one-time (re-runnable) carving of the sourced CC0 packs into
 * `assets/src`, the raw-art input tree of the asset pipeline (pack-assets.mjs).
 *
 * This is the PROVENANCE record for every sprite in the game: which pack, which
 * file, which cell each frame came from. The packs themselves are not committed
 * (they are large); see `assets/LICENSES.md` for the pack list, sources, and
 * license evidence. Re-running against a fresh download of the same packs
 * reproduces `assets/src` byte-for-byte (nearest-neighbor slicing only).
 *
 * Layout conventions consumed here (verified empirically against the packs):
 * - Ninja Adventure character `SeparateAnim/`: `Idle.png`/`Attack.png` 64×16 =
 *   4 cells (one per direction: down, up, left, right); `Walk.png` 64×64 =
 *   4 direction columns × 4 walk-cycle rows; `Dead.png` 16×16 single cell.
 * - Ninja Adventure monster sheet (`SpriteSheet.png` or `<Name>.png`) 64×64 =
 *   4 direction columns × 4 walk-cycle rows.
 * - FX strips: fixed-width frames left→right (frame sizes per entry below).
 *
 * The battler folder names are the game's OWN content refs (`Combatant.ref` /
 * party-member ids), so a packed frame name is `<ref>/<anim>` and the scene can
 * map a combatant to its art with zero lookup tables.
 *
 * Usage: node scripts/ingest-assets.mjs --packs <dir with the downloaded packs>
 * @module scripts/ingest-assets
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "src");

/** Sprite cell size (px) of the Ninja Adventure character/monster grids. */
const CELL = 16;
/** Direction order of Ninja Adventure sheet columns / strip cells. */
const DIRS = ["down", "up", "left", "right"];
/** Walk-cycle frames per direction in the character/monster sheets. */
const WALK_FRAMES = 4;

/**
 * The cast: every battler ref in the game mapped to its Ninja Adventure actor.
 * `kind: "char"` folders carry `SeparateAnim/` strips + a `Faceset.png`;
 * `kind: "monster"` folders carry one 4×4 sheet (+ `Faceset.png`).
 */
const CAST = [
  { ref: "wren", kind: "char", folder: "Actor/Character/Hunter" },
  { ref: "tobi", kind: "char", folder: "Actor/Character/Boy" },
  { ref: "halcyon", kind: "char", folder: "Actor/Character/Knight" },
  { ref: "marrow-scrapper", kind: "monster", folder: "Actor/Monster/Skull" },
  { ref: "render-construct", kind: "monster", folder: "Actor/Monster/Cyclope" },
  { ref: "the-ashling", kind: "monster", folder: "Actor/Monster/Flam" },
  {
    ref: "house-enforcer",
    kind: "char",
    folder: "Actor/Character/GladiatorBlue",
  },
  { ref: "drowned-husk", kind: "monster", folder: "Actor/Monster/Octopus" },
  { ref: "requiem-wraith", kind: "monster", folder: "Actor/Monster/Spirit" },
  { ref: "deep-auditor", kind: "monster", folder: "Actor/Monster/Eye" },
  { ref: "halcyon-knight", kind: "char", folder: "Actor/Character/KnightGold" },
];

/** @type {const} */

/** Non-battler portrait speakers (dialogue facesets only). */
const PORTRAIT_ONLY = [{ ref: "sable", folder: "Actor/Character/GoldStatue" }];

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

/**
 * Slice one character's SeparateAnim strips into per-frame PNGs under
 * `sprites/battlers/<ref>/`.
 * @param {string} actorDir - The character folder (contains SeparateAnim/).
 * @param {string} ref - The game content ref (output folder name).
 * @returns {Promise<void>} Resolves when all frames are written.
 */
async function sliceCharacter(actorDir, ref) {
  const out = join(OUT, "sprites", "battlers", ref);
  const anim = join(actorDir, "SeparateAnim");
  const idle = await Jimp.read(join(anim, "Idle.png"));
  const attack = await Jimp.read(join(anim, "Attack.png"));
  const walk = await Jimp.read(join(anim, "Walk.png"));
  const dead = await Jimp.read(join(anim, "Dead.png"));
  for (const [col, dir] of DIRS.entries()) {
    await writeCell(
      idle,
      col * CELL,
      0,
      CELL,
      CELL,
      join(out, `idle-${dir}.png`)
    );
    await writeCell(
      attack,
      col * CELL,
      0,
      CELL,
      CELL,
      join(out, `attack-${dir}.png`)
    );
    for (let row = 0; row < WALK_FRAMES; row++) {
      await writeCell(
        walk,
        col * CELL,
        row * CELL,
        CELL,
        CELL,
        join(out, `walk-${dir}-${row}.png`)
      );
    }
  }
  await writeCell(dead, 0, 0, CELL, CELL, join(out, "dead.png"));
}

/**
 * Slice one monster's 4×4 sheet into per-frame walk PNGs under
 * `sprites/battlers/<ref>/` (monsters have no separate idle/attack strips —
 * the anim layer derives poses from walk frames).
 * @param {string} actorDir - The monster folder.
 * @param {string} ref - The game content ref (output folder name).
 * @returns {Promise<void>} Resolves when all frames are written.
 */
async function sliceMonster(actorDir, ref) {
  const out = join(OUT, "sprites", "battlers", ref);
  const base = actorDir.split("/").at(-1);
  const sheetPath = ["SpriteSheet.png", `${base}.png`]
    .map(name => join(actorDir, name))
    .find(existsSync);
  if (sheetPath === undefined) {
    throw new Error(`no sheet found in ${actorDir}`);
  }
  const sheet = await Jimp.read(sheetPath);
  for (const [col, dir] of DIRS.entries()) {
    for (let row = 0; row < WALK_FRAMES; row++) {
      await writeCell(
        sheet,
        col * CELL,
        row * CELL,
        CELL,
        CELL,
        join(out, `walk-${dir}-${row}.png`)
      );
    }
  }
}

/**
 * Copy an actor's dialogue faceset into `sprites/portraits/<ref>.png`.
 * @param {string} actorDir - The actor folder (contains Faceset.png).
 * @param {string} ref - The game content ref.
 * @returns {Promise<void>} Resolves when written.
 */
async function copyFaceset(actorDir, ref) {
  const face = await Jimp.read(join(actorDir, "Faceset.png"));
  const outPath = join(OUT, "sprites", "portraits", `${ref}.png`);
  mkdirSync(dirname(outPath), { recursive: true });
  await face.write(outPath);
}

/**
 * Entry point: carve every cast member, FX strip, UI piece, and backdrop.
 * @returns {Promise<void>} Resolves when assets/src is fully written.
 */
async function main() {
  const flagIndex = process.argv.indexOf("--packs");
  const packsDir = flagIndex === -1 ? null : process.argv[flagIndex + 1];
  if (packsDir === null || packsDir === undefined) {
    console.error("usage: node scripts/ingest-assets.mjs --packs <dir>");
    process.exit(1);
  }
  const { ninja, warped } = packRoots(packsDir);
  rmSync(OUT, { recursive: true, force: true });

  for (const member of CAST) {
    const actorDir = join(ninja, member.folder);
    if (member.kind === "char") {
      await sliceCharacter(actorDir, member.ref);
    } else {
      await sliceMonster(actorDir, member.ref);
    }
    await copyFaceset(actorDir, member.ref);
  }
  for (const { ref, folder } of PORTRAIT_ONLY) {
    await copyFaceset(join(ninja, folder), ref);
  }
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
  console.log("ingest-assets: assets/src rebuilt from packs.");
}

await main();
