/**
 * The pure **World Map first-open onboarding** flag (#241, Scope-IN 5) — the "show the
 * travel hint once per save" ledger, mirroring the first-battle onboarding
 * (`logic/battle-onboarding`): the one-time flag rides `SaveDataV3.scene.flags` with no
 * schema bump, so the hint beat fires the first time the player opens the World Map and
 * never again. Zero Phaser, no I/O — a total function of the save.
 * @module logic/world-map-onboarding
 */
import { type CurrentSave } from "./save/types";

/** The scene-flag key the World Map's first-open hint is recorded under. */
const WORLD_MAP_ONBOARDING_FLAG = "worldMapOnboardingSeen";

/** The one-line first-open hint the World Map surfaces (once per save). */
export const WORLD_MAP_ONBOARDING_HINT =
  "Choose a region to travel there; win its encounters to open the road onward.";

/**
 * Whether the World Map first-open hint has already been shown for this save. Pure.
 * @param save - The current save.
 * @returns True when the hint has been seen.
 */
export function hasSeenWorldMapOnboarding(save: CurrentSave): boolean {
  return save.scene?.flags?.[WORLD_MAP_ONBOARDING_FLAG] === true;
}

/**
 * Record the World Map first-open hint as seen — folds the flag into the scene ledger,
 * preserving the existing sceneId/nodeId narrative cursor and every other flag. Pure —
 * returns a fresh save, mutates nothing.
 * @param save - The current save (never mutated).
 * @returns The save with the onboarding flag set.
 */
export function markWorldMapOnboardingSeen(save: CurrentSave): CurrentSave {
  const scene = save.scene;
  return {
    ...save,
    scene: {
      sceneId: scene?.sceneId ?? "",
      nodeId: scene?.nodeId ?? "",
      flags: { ...scene?.flags, [WORLD_MAP_ONBOARDING_FLAG]: true },
    },
  };
}
