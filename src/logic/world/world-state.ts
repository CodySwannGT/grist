/**
 * The pure **world-state model** — the deterministic Act I *Reach* / Act II
 * *Ashfall* flag every region, NPC arc, landmark, encounter table, and economy
 * value resolves through, so the same authored map reads as two distinct states
 * (PRD #43 FR2 / AC3, Story #134). The flag has exactly two values:
 *
 * - **reach** — Act I, the world as it was before the Reckoning (the start state).
 * - **ashfall** — Act II, the world after the Reckoning has fired (terminal).
 *
 * The {@link reckon} flip is the *semantics* of the world-turn, NOT the Reckoning
 * set-piece (#122, out of scope): it is a total, idempotent transition —
 * `reach → ashfall`, and `ashfall → ashfall` (already-flipped is a no-op). The
 * world-turn decides when it fires; chance never does, so the flip **consumes no
 * RNG** and is referentially transparent (the same input always yields the same
 * output). Content reads *through* the flag with a {@link WorldStateResolver}: a
 * `{ reach, ashfall }` pair whose value {@link resolveByWorldState} selects by the
 * current state — the framework region/encounter/economy code uses to surface its
 * Ashfall value the instant the flag flips, without branching by hand at every
 * call site.
 *
 * This module owns only the flag *rules* and the resolve *framework* as pure
 * functions: data-in / data-out, no mutation, fresh state on every call (for a
 * primitive `WorldState`, "structural sharing on a no-op" is simply returning the
 * value unchanged). Deliberately out of scope (and never touched here): the
 * Reckoning set-piece (#122), the per-region both-states content authoring
 * (#133), the Act II Ashfall content (#123), and the visual desaturation pass.
 * Persisting the flag across a reload is the save layer's job (`logic/save`,
 * which imports `WorldState` from here — a one-way `save → world` edge, never the
 * reverse, so the import graph stays acyclic).
 *
 * Zero Phaser, no I/O, no RNG, no `Math.random` / `Date.now` — every output is a
 * total function of its explicit inputs, so world-state is deterministic and
 * reproducible under a fixed seed (the seed never enters: the flip is decided by
 * the world-turn, not chance).
 * @module logic/world/world-state
 */

/**
 * The deterministic world-state flag. Exactly two values: `reach` (Act I, the
 * start state) and `ashfall` (Act II, after the Reckoning). Persisted verbatim by
 * the save layer so the same map reads as two states across a reload.
 */
export type WorldState = "reach" | "ashfall";

/**
 * The world-state a new run begins in: Act I **reach**, before the Reckoning has
 * fired. The save layer seeds a fresh save with this so a new game and a new save
 * agree on the start state.
 */
export const INITIAL_WORLD_STATE: WorldState = "reach";

/**
 * Apply the Reckoning flip to the world-state — the world-turn's transition, not
 * the set-piece (#122). Total and idempotent: `reach` becomes `ashfall`, and
 * `ashfall` stays `ashfall` (the Reckoning fires once; a second flip is a no-op,
 * returning the same value). Pure — decided by the world-turn, never by chance, so
 * it consumes no RNG and the same input always yields the same output.
 * @param state - The current world-state (never mutated).
 * @returns The post-Reckoning world-state: always `ashfall`.
 */
export function reckon(state: WorldState): WorldState {
  return state === "reach" ? "ashfall" : state;
}

/**
 * Whether the world is still in Act I **reach**. A thin reader so a consumer can
 * branch on "before the Reckoning?" without comparing the union literal by hand.
 * Pure.
 * @param state - The world-state to inspect.
 * @returns True when the world is in `reach`.
 */
export function isReach(state: WorldState): boolean {
  return state === "reach";
}

/**
 * Whether the world has flipped to Act II **ashfall**. A thin reader so a consumer
 * can branch on "after the Reckoning?" without comparing the union literal by
 * hand. Pure.
 * @param state - The world-state to inspect.
 * @returns True when the world is in `ashfall`.
 */
export function isAshfall(state: WorldState): boolean {
  return state === "ashfall";
}

/**
 * A world-state resolver: a `{ reach, ashfall }` pair holding the value a region,
 * encounter table, or economy axis takes in each state. The framework's read seam
 * — content authors one pair per axis and {@link resolveByWorldState} picks the
 * live value, so a flip surfaces the Ashfall value everywhere without per-call-site
 * branching. Generic in `T` so the same machinery serves a string tone, a numeric
 * price, an encounter-table id, or any per-state value.
 */
export interface WorldStateResolver<T> {
  /** The value used while the world is in Act I `reach`. */
  readonly reach: T;
  /** The value used once the world has flipped to Act II `ashfall`. */
  readonly ashfall: T;
}

/**
 * Resolve a {@link WorldStateResolver} pair against the current world-state — read
 * *through* the flag. Returns the pair's `reach` value before the Reckoning and its
 * `ashfall` value after, so the same authored resolver yields a different value the
 * instant {@link reckon} flips the flag. Pure — selects, never mutates; the seed
 * never enters, so the read is deterministic.
 * @param state - The current world-state.
 * @param resolver - The per-state value pair to read through the flag.
 * @returns The resolver's value for `state` (`reach` value in reach, `ashfall` value in ashfall).
 */
export function resolveByWorldState<T>(
  state: WorldState,
  resolver: WorldStateResolver<T>
): T {
  return resolver[state];
}
