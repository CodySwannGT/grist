/**
 * The pure, Phaser-free focus-ring model for the growth/bench screen (#246): the
 * single source of the bench's keyboard-navigable controls — the equip-shard
 * button, each grist sink, and the Back control — their traversal order, and the
 * ring cursor (move up/down with wrap, read the focused control). The Bench was
 * pointer-only (arrows/Enter did nothing, locking keyboard/gamepad/Deck players
 * out of the whole build system); this gives it the same cursor idiom the pause
 * Menu uses ({@link import("./pause-menu").moveCursor}), so the Bench scene stays a
 * thin renderer that reads `cursor`, moves it through {@link moveBenchFocus}, and
 * activates whatever {@link focusedControl} returns.
 *
 * Every actionable control is focus-visitable — including an unaffordable sink —
 * exactly the way the Menu's cursor visits its `unavailable` entries: confirming a
 * disabled sink emits the same buy intent a pointer tap would, which the pure
 * {@link import("./run-state").applyBenchSink} reducer already absorbs as a no-op.
 * So affordability never enters this model; it is a static ring, unit-tested
 * headless. Data in, data out — no Phaser, no run-state, no I/O.
 * @module logic/bench-focus
 */
import { BenchSinkIds, type BenchSinkId } from "../content/bench";

/**
 * One focus-visitable bench control: the equip-shard button, a specific grist
 * sink (carrying its id so the scene activates it without a second lookup), or the
 * Back control. A discriminated union so the scene's confirm handler is total over
 * every focus target.
 */
type BenchControl =
  | { readonly kind: "equip" }
  | { readonly kind: "sink"; readonly sink: BenchSinkId }
  | { readonly kind: "back" };

/**
 * The bench controls in the order the focus cursor traverses them, top to bottom:
 * the equip button, the two grist sinks (Runner's Reflex, then Accelerate: Cinder,
 * the same order the scene stacks them), and the Back control. This array IS the
 * navigation contract the ring wraps over — authored once, never rebuilt per call.
 */
export const BENCH_CONTROL_ORDER: readonly BenchControl[] = [
  { kind: "equip" },
  { kind: "sink", sink: BenchSinkIds.runnersReflex },
  { kind: "sink", sink: BenchSinkIds.accelerateCinder },
  { kind: "back" },
] as const;

/** The live focus state of the bench: which control the cursor sits on. */
export interface BenchFocusState {
  /** The zero-based index of the focused control within {@link BENCH_CONTROL_ORDER}. */
  readonly cursor: number;
}

/**
 * The opening focus state: the cursor rests on the first control (the equip
 * button). Pure — the same fresh state every call, holding no ambient input.
 * @returns A fresh bench focus state.
 */
export function newBenchFocus(): BenchFocusState {
  return { cursor: 0 };
}

/**
 * Move the cursor by `delta` controls, wrapping both ends so the control list is a
 * ring (down past the last lands on the first; up past the first lands on the
 * last) — the keyboard-navigable, no-dead-ends contract the Menu's cursor also
 * honors. Pure: returns a new state, never mutates the input.
 * @param state - The current focus state (never mutated).
 * @param delta - The signed step (−1 = up, +1 = down).
 * @returns The next focus state with the cursor moved (and wrapped).
 */
export function moveBenchFocus(
  state: BenchFocusState,
  delta: -1 | 1
): BenchFocusState {
  const count = BENCH_CONTROL_ORDER.length;
  const next = (((state.cursor + delta) % count) + count) % count;
  return { cursor: next };
}

/**
 * Read the control the cursor currently focuses — the single derivation the scene
 * needs to activate the focused control on confirm and to park the caret beside
 * it. Total over a valid cursor (the reducers keep it in `[0, count)`).
 * @param state - The live focus state.
 * @returns The focused {@link BenchControl}.
 */
export function focusedControl(state: BenchFocusState): BenchControl {
  const count = BENCH_CONTROL_ORDER.length;
  const index = ((state.cursor % count) + count) % count;
  const control = BENCH_CONTROL_ORDER[index];
  if (control === undefined) {
    throw new RangeError(`bench focus cursor out of range: ${state.cursor}`);
  }
  return control;
}

/**
 * A stable string id for a control — its kind, or the sink's own id for a sink —
 * so the verification bridge can surface which control is focused (the e2e asserts
 * the caret moved) without leaking the union shape across the test seam.
 * @param control - The focused control.
 * @returns The control's stable id (`"equip"`, a sink id, or `"back"`).
 */
export function controlId(control: BenchControl): string {
  return control.kind === "sink" ? control.sink : control.kind;
}
