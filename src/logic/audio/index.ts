/**
 * Public surface of the pure audio-cue core (#115): the Phaser-free vocabulary of
 * temp-audio cues, their redundant text/icon captions (FR11 / AC12), and the edge
 * predicates that decide when a stinger fires. Engine-free, deterministic, and
 * unit-tested headless; the SoundService and the scenes import from here so the
 * cue set and its captions are a single source of truth. Re-export only — the
 * logic lives in `./cues`.
 * @module logic/audio
 */
export type { AudioCueId } from "./cues";
export {
  AudioCues,
  CUE_CAPTIONS,
  hasRendering,
  justRendered,
  spentGrist,
} from "./cues";
