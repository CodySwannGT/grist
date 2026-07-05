/**
 * Pure, Phaser-free audio-cue vocabulary + the edge predicates that decide when
 * a demo stinger fires (#115, PRD #42 Scope-IN "temp-but-intentional audio").
 * The four cues are the opening **Choir leitmotif** fragment and the three
 * resonant stingers — **grist-spend**, **Break**, and **Rendering** — each hooked
 * to its game moment. Detection is expressed here as small pure functions over
 * sim state so the whole mapping is unit-testable headless; the Phaser
 * {@link import("../../services/sound-service").SoundService} plays the clip and
 * the view shows the redundant caption.
 *
 * Every cue carries a {@link CueCaption} — a non-color, non-audio text+icon label
 * — so no acceptance-relevant cue is ever conveyed by color or audio alone (FR11,
 * the redundancy half of AC12): the SoundService fires the cue and the caption in
 * lockstep, so they can never drift.
 * @module logic/audio/cues
 */
import { Statuses, type CombatantStatus } from "../combat/types";

/**
 * The temp-audio cue ids. Use the keyed values (e.g. `AudioCues.break`) rather
 * than inline string literals so a typo is a compile error and there is one
 * source of truth. `choir` is the looping opening leitmotif; the rest are
 * one-shot stingers.
 */
export const AudioCues = {
  choir: "choir",
  gristSpend: "grist-spend",
  break: "break",
  rendering: "rendering",
} as const;

/** A temp-audio cue id. */
export type AudioCueId = (typeof AudioCues)[keyof typeof AudioCues];

/**
 * The redundant, non-color/non-audio on-screen cue for one audio moment: a short
 * `text` label plus an `icon` glyph. Shown briefly whenever the cue fires so a
 * player who cannot hear (or distinguish the color) still receives the beat.
 */
interface CueCaption {
  readonly icon: string;
  readonly text: string;
}

/**
 * The caption shown for each cue (FR11 / AC12 redundancy). Text + icon only — the
 * view may color it, but the meaning never depends on the color or the sound.
 */
export const CUE_CAPTIONS: Readonly<Record<AudioCueId, CueCaption>> = {
  [AudioCues.choir]: { icon: "♪", text: "Choir leitmotif" },
  [AudioCues.gristSpend]: { icon: "◆", text: "Grist spent" },
  [AudioCues.break]: { icon: "✦", text: "BREAK" },
  [AudioCues.rendering]: { icon: "▓", text: "Rendering" },
};

/**
 * Whether grist was strictly spent between two frames (the pool went down). Loot
 * can also raise grist mid-battle, so the stinger fires only on a strict
 * decrease, never on a credit.
 * @param prev - The grist pool as of the last frame.
 * @param next - The grist pool this frame.
 * @returns True when `next < prev`.
 */
export function spentGrist(prev: number, next: number): boolean {
  return next < prev;
}

/**
 * Whether a combatant currently carries the Rendering DoT.
 * @param statuses - The combatant's live status list.
 * @returns True when a `rendering` status is present.
 */
export function hasRendering(statuses: readonly CombatantStatus[]): boolean {
  return statuses.some(status => status.id === Statuses.rendering);
}

/**
 * The one-shot Rendering edge: true only on the frame a combatant first gains the
 * Rendering status (false→true), the audio counterpart of the Break edge. The
 * caller tracks the prior presence and passes it in.
 * @param wasRendering - Whether the combatant carried Rendering as of the last mirror.
 * @param statuses - The combatant's live status list.
 * @returns True on the frame Rendering first appears.
 */
export function justRendered(
  wasRendering: boolean,
  statuses: readonly CombatantStatus[]
): boolean {
  return !wasRendering && hasRendering(statuses);
}
