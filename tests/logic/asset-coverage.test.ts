/**
 * Asset-coverage contract — proves every frame name the game DERIVES (battler
 * poses/cycles via `ui/battler-view`, FX strips via `anims`, dialogue
 * portraits) resolves in the COMMITTED packed atlases, and that the pure
 * region-runtime's backdrop key mirror matches the generated image key. This
 * is what keeps the typed-key guarantee honest for convention-derived names:
 * a renamed/missing frame in `assets/src` fails here, never as a silent black
 * square at runtime. Headless — reads the packed JSON straight from
 * `public/assets`, zero Phaser.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FX_FRAMES } from "../../src/anims";
import { Frames, ImageKeys } from "../../src/assets";
import {
  BATTLER_REFS,
  BattlerDirs,
  WALK_FRAME_COUNT,
  battlerAttackFrame,
  battlerDeadFrame,
  battlerIdleFrame,
  battlerWalkFrame,
  type BattlerDir,
} from "../../src/ui/battler-view";

const ATLAS_DIR = join(__dirname, "..", "..", "public", "assets", "atlases");
const IMAGE_DIR = join(__dirname, "..", "..", "public", "assets", "images");

/**
 * The frame-name set of one committed atlas.
 * @param name - The atlas basename.
 * @returns Every frame name in the packed descriptor.
 */
function framesOf(name: string): ReadonlySet<string> {
  const parsed = JSON.parse(
    readFileSync(join(ATLAS_DIR, `${name}.json`), "utf8")
  ) as { readonly frames: Readonly<Record<string, unknown>> };
  return new Set(Object.keys(parsed.frames));
}

const DIRS = Object.values(BattlerDirs) as readonly BattlerDir[];

describe("asset coverage — derived keys resolve in the committed atlases", () => {
  const battlers = framesOf("battlers");

  it("covers every battler pose and walk cycle for every cast ref", () => {
    for (const ref of BATTLER_REFS) {
      for (const dir of DIRS) {
        expect(battlers).toContain(battlerIdleFrame(ref, dir));
        expect(battlers).toContain(battlerAttackFrame(ref, dir));
        expect(battlers).toContain(battlerDeadFrame(ref, dir));
        for (let frame = 0; frame < WALK_FRAME_COUNT; frame++) {
          expect(battlers).toContain(battlerWalkFrame(ref, dir, frame));
        }
      }
    }
  });

  it("covers every FX strip frame the anims module plays", () => {
    const fx = framesOf("fx");
    for (const frames of Object.values(FX_FRAMES)) {
      for (const frame of frames) {
        expect(fx).toContain(frame);
      }
    }
  });

  it("covers the dialogue portrait for every scripted speaker", () => {
    const portraits = framesOf("portraits");
    for (const speaker of ["wren", "tobi", "sable", "halcyon"]) {
      expect(portraits).toContain(speaker);
    }
  });

  it("covers every UI chrome frame the pixel 9-slice reskin draws (#202)", () => {
    // The `panel` 9-slice frames every menu/HUD/dialogue chrome surface and the
    // `arrow` is the selection cursor; both must resolve in the committed `ui`
    // atlas or the reskin is a silent black square. `dialog-box`/`choice-box`
    // are the pack's flat boxes kept available alongside them.
    const ui = framesOf("ui");
    for (const frame of Object.values(Frames.ui)) {
      expect(ui).toContain(frame);
    }
  });

  it("keeps every pure region-runtime backdrop mirror in lock-step with the generated key (#200)", () => {
    // regionBackdrop() in logic/region returns string literals so the pure layer
    // never imports asset modules; this pins each per-region literal to its
    // generated far-layer key. Every live region has its OWN distinct set.
    expect(ImageKeys.marrowBgFar).toBe("img-marrow/bg-far");
    expect(ImageKeys.rootsBgFar).toBe("img-roots/bg-far");
    expect(ImageKeys.upperVantaBgFar).toBe("img-upper-vanta/bg-far");
    expect(ImageKeys.sylvemarchBgFar).toBe("img-sylvemarch/bg-far");
    expect(ImageKeys.holtspireBgFar).toBe("img-holtspire/bg-far");
    expect(ImageKeys.cinderfenBgFar).toBe("img-cinderfen/bg-far");
    expect(ImageKeys.wrackBgFar).toBe("img-wrack/bg-far");
  });

  it("packs the full far/mid/near stack for every per-region backdrop set (#200)", () => {
    // The scene layers far→mid→near per region; all three plates of every set must
    // resolve as committed standalone images or the parallax is a black square.
    const stacks: Readonly<Record<string, readonly string[]>> = {
      marrow: [
        ImageKeys.marrowBgFar,
        ImageKeys.marrowBgMid,
        ImageKeys.marrowBgNear,
      ],
      roots: [
        ImageKeys.rootsBgFar,
        ImageKeys.rootsBgMid,
        ImageKeys.rootsBgNear,
      ],
      upperVanta: [
        ImageKeys.upperVantaBgFar,
        ImageKeys.upperVantaBgMid,
        ImageKeys.upperVantaBgNear,
      ],
      sylvemarch: [
        ImageKeys.sylvemarchBgFar,
        ImageKeys.sylvemarchBgMid,
        ImageKeys.sylvemarchBgNear,
      ],
      holtspire: [
        ImageKeys.holtspireBgFar,
        ImageKeys.holtspireBgMid,
        ImageKeys.holtspireBgNear,
      ],
      cinderfen: [
        ImageKeys.cinderfenBgFar,
        ImageKeys.cinderfenBgMid,
        ImageKeys.cinderfenBgNear,
      ],
      wrack: [
        ImageKeys.wrackBgFar,
        ImageKeys.wrackBgMid,
        ImageKeys.wrackBgNear,
      ],
    };
    for (const [region, keys] of Object.entries(stacks)) {
      for (const key of keys) {
        const rel = key.replace(/^img-/u, "");
        expect(existsSync(join(IMAGE_DIR, `${rel}.png`))).toBe(true);
      }
      expect(new Set(keys).size).toBe(keys.length);
      expect(region.length).toBeGreaterThan(0);
    }
  });
});
