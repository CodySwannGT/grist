/**
 * The pure, Phaser-free navigation model for the growth/bench screen exit (#239):
 * the single decision of where a Back/Esc press at the Bench resolves to. The Bench
 * predates player-facing navigation (it was the `?scene=bench` verification surface),
 * so when the pause Menu's **Builds** entry began routing players INTO it, it needed
 * a symmetric way back out — this is the bench counterpart of
 * {@link import("./pause-menu").resolveMenuCancel}.
 *
 * Data in, data out: given the scene the Bench was launched from (the pause Menu
 * when opened via Builds, or null when reached standalone via `?scene=bench`), it
 * decides whether Back **returns** to that caller or **stays** put. The Bench scene
 * is a thin dispatcher over this decision — a standalone bench (no caller) has no
 * exit target, so Back stays, preserving the dev/UAT verification seam exactly the
 * way a standalone `?scene=menu` menu stays on a Cancel. Unit-tested headless.
 * @module logic/bench-nav
 */

/**
 * Return to the caller scene the Bench was opened over (#239): the pause Menu (when
 * opened via Builds), which then resumes the Field exactly where the player paused.
 * Carries the scene key so the adapter starts it without a second lookup.
 */
interface BenchBackReturn {
  readonly kind: "return";
  readonly scene: string;
}

/** Stay on the Bench — Back with no caller (the standalone `?scene=bench` seam). */
interface BenchBackStay {
  readonly kind: "stay";
}

/** What a Back/Esc press at the Bench resolves to, given the caller. */
type BenchBackOutcome = BenchBackReturn | BenchBackStay;

/**
 * Resolve a Back/Esc press purely from the one piece of live state the Bench holds:
 * which scene (if any) launched it. A bench opened from the pause Menu returns to
 * that caller; a bench reached standalone (`?scene=bench`, the verification seam)
 * has no caller and stays put, so the seam is preserved. Pure and total — the
 * {@link import("../scenes/Bench").Bench} scene is a thin dispatcher over it.
 * @param returnTo - The caller scene key to resume, or null when opened standalone.
 * @returns The Back outcome the scene applies.
 */
export function resolveBenchBack(returnTo: string | null): BenchBackOutcome {
  if (returnTo !== null) {
    return { kind: "return", scene: returnTo };
  }
  return { kind: "stay" };
}
