/**
 * The committed, pinned `hashState` progressions for the canonical
 * play-to-victory script (issue #127). These are the single source of truth the
 * determinism state-hash gate asserts against from BOTH lanes:
 *   - the headless twin in `tests/logic/combat-determinism.test.ts` (the pure
 *     `hashState` over the `step` reducer), and
 *   - the browser play-through in `tests/e2e/play-to-victory.spec.ts` (sampling
 *     `window.__VERIFY__.hash()`).
 *
 * Because the seeded RNG threads through every resolved hit, the same seed +
 * same action sequence MUST reproduce the same progression on every run and in
 * both lanes; a different seed MUST diverge. Pinning the values here makes the
 * contract a committed fact rather than a self-referential "two runs matched"
 * tautology — if the engine's determinism ever drifts, BOTH lanes fail against
 * these constants. Regenerate ONLY via a deliberate, reviewed engine change
 * (see the harness note in `tests/logic/combat-determinism.test.ts`).
 *
 * Zero Phaser — safe to import from the Vitest unit lane and the Playwright e2e
 * lane alike.
 * @module tests/fixtures/determinism-hashes
 */

/** The primary seed both lanes replay (identical-on-same-seed). */
export const DETERMINISM_SEED_A = 0x1234abcd;

/** A second, distinct seed both lanes replay (divergent-on-different-seed). */
export const DETERMINISM_SEED_B = 0x0badf00d;

/**
 * The pinned `hashState` progression for {@link DETERMINISM_SEED_A}: the hash at
 * the opening decision followed by the hash after each of the four scripted
 * actions (Strike, Craft, Bind, Craft) — five samples in total.
 */
export const DETERMINISM_HASHES_SEED_A: readonly string[] = [
  "a9748c0d",
  "98149e5b",
  "869bde14",
  "718b396d",
  "63f611ef",
];

/** The pinned `hashState` progression for {@link DETERMINISM_SEED_B} (must differ from A). */
export const DETERMINISM_HASHES_SEED_B: readonly string[] = [
  "ac1a10c3",
  "586ee8dc",
  "bbd0c954",
  "695fb2d9",
  "1b67965a",
];
