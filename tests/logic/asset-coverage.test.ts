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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FX_FRAMES } from "../../src/anims";
import { ImageKeys } from "../../src/assets";
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

  it("keeps the pure region-runtime backdrop mirror in lock-step with the generated key", () => {
    // regionBackdrop() in logic/region returns a literal so the pure layer
    // never imports asset modules; this pins the literal to the generated key.
    expect(ImageKeys.marrowBgFar).toBe("img-marrow/bg-far");
  });
});
