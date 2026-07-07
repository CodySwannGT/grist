/**
 * The pure **Field travel onboarding** flag (#261) — the "show the travel signpost
 * once per save" ledger, mirroring the World Map first-open hint
 * (`logic/world-map-onboarding`): the one-time flag rides `SaveDataV3.scene.flags`
 * with no schema bump, so the beat fires the first time the player lands in the intro
 * Field after the tutorial and never again. It answers the front-door gap the intro
 * Field left open — a brand-new player dropped into "Warren Street" with only `[M]`/
 * `[Esc]` on screen and no cue that progression lives on the World Map — by telling
 * them, once, how to reach the road onward. Zero Phaser, no I/O — a total function of
 * the save.
 * @module logic/field-onboarding
 */
import { type CurrentSave } from "./save/types";

/** The scene-flag key the Field's first-landing travel hint is recorded under. */
const FIELD_TRAVEL_ONBOARDING_FLAG = "fieldTravelOnboardingSeen";

/**
 * The one-line first-landing hint the Field surfaces (once per save): after the
 * tutorial drops the player in "Warren Street" with nothing in the field to clear, it
 * points them at the real road onward — the World Map, reached by the `[T]` travel
 * affordance. Terse and in-voice (themes-and-tone), echoing the World Map's own "open
 * the road onward" copy.
 */
export const FIELD_TRAVEL_ONBOARDING_HINT =
  "The road runs on from the world map — press [T] to travel.";

/**
 * Whether the Field travel hint has already been shown for this save. Pure.
 * @param save - The current save.
 * @returns True when the hint has been seen.
 */
export function hasSeenFieldTravelOnboarding(save: CurrentSave): boolean {
  return save.scene?.flags?.[FIELD_TRAVEL_ONBOARDING_FLAG] === true;
}

/**
 * Record the Field travel hint as seen — folds the flag into the scene ledger,
 * preserving the existing sceneId/nodeId narrative cursor and every other flag. Pure —
 * returns a fresh save, mutates nothing.
 * @param save - The current save (never mutated).
 * @returns The save with the onboarding flag set.
 */
export function markFieldTravelOnboardingSeen(save: CurrentSave): CurrentSave {
  const scene = save.scene;
  return {
    ...save,
    scene: {
      sceneId: scene?.sceneId ?? "",
      nodeId: scene?.nodeId ?? "",
      flags: { ...scene?.flags, [FIELD_TRAVEL_ONBOARDING_FLAG]: true },
    },
  };
}
