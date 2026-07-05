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
import { existsSync, mkdirSync, rmSync } from "node:fs";
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
]; /** @type {const} */

/** Non-battler portrait speakers (dialogue facesets only). */
const PORTRAIT_ONLY = [{ ref: "sable", folder: "Actor/Character/GoldStatue" }];

/** Battle FX strips: name, source, frame width/height, frame count. */
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
];

/** UI chrome copied verbatim from Ninja Adventure (already pixel-art). */
const UI = [
  { name: "dialog-box", file: "Ui/Dialog/DialogBox.png" },
  { name: "choice-box", file: "Ui/Dialog/ChoiceBox.png" },
  { name: "arrow", file: "Ui/Arrow.png" },
];

/** Warped City parallax layers → the Marrow side-view backdrop set. */
const BACKDROPS = [
  { name: "marrow/bg-far", file: "assets/environment/bg-1.png" },
  { name: "marrow/bg-mid", file: "assets/environment/bg-2.png" },
  { name: "marrow/bg-near", file: "assets/environment/bg-3.png" },
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
  for (const backdrop of BACKDROPS) {
    const img = await Jimp.read(join(warped, backdrop.file));
    const outPath = join(OUT, "images", `${backdrop.name}.png`);
    mkdirSync(dirname(outPath), { recursive: true });
    await img.write(outPath);
  }
  console.log("ingest-assets: assets/src rebuilt from packs.");
}

await main();
