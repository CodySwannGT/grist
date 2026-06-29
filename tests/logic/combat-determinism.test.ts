import { describe, expect, it } from "vitest";

import {
  hashState,
  runToNextDecision,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
} from "../../src/logic/combat";
import { ENCOUNTERS, PARTY } from "../../src/content";
import {
  DETERMINISM_HASHES_SEED_A,
  DETERMINISM_HASHES_SEED_B,
  DETERMINISM_SEED_A,
  DETERMINISM_SEED_B,
} from "../fixtures/determinism-hashes";

/**
 * The determinism state-hash gate (combat-spec / decision 0001 "deterministic
 * sim"): a seeded battle played to victory through a fixed action sequence must
 * produce an identical {@link hashState} progression on every run, and a
 * different seed must diverge. This is the headless, CI-runnable twin of the
 * `tests/e2e` play-to-victory spec — same encounter, same script, proven without
 * a browser so the gate runs in the unit lane.
 *
 * The per-increment DoD harness (#127) pins this progression as a committed fact
 * shared with the browser play-through (`tests/fixtures/determinism-hashes.ts`),
 * so the headless twin and the `__VERIFY__.hash()` lane assert against the SAME
 * constant — not merely against each other. To regenerate the pinned values
 * after a deliberate engine change, log `play(DETERMINISM_SEED_A).hashes` /
 * `play(DETERMINISM_SEED_B).hashes` and update the fixture under review.
 */

const WREN = { side: "party", index: 0 } as const;
const SCRAPPER = { side: "enemies", index: 0 } as const; // marrow-scrapper
const CONSTRUCT = { side: "enemies", index: 1 } as const; // render-construct (Flux-weak)

/**
 * The hard-coded play-to-victory script: a Strike, a Craft that one-shots the
 * Flux-weak construct (funding the pool with its loot), at least one Bind (spends
 * grist), and a finishing Craft on the scrapper — Strike + Craft + Bind, ending
 * in Victory.
 */
const SCRIPT: readonly BattleAction[] = [
  { kind: "strike", actor: WREN, target: SCRAPPER },
  { kind: "craft", id: "spark", actor: WREN, target: CONSTRUCT },
  { kind: "bind", id: "bind-wisp", actor: WREN },
  { kind: "craft", id: "spark", actor: WREN, target: SCRAPPER },
];

/** One played-out run: the hash sampled at every decision point, plus the end state. */
interface Run {
  readonly hashes: readonly string[];
  readonly final: BattleState;
}

/**
 * Play the canonical encounter under a seed, sampling the state hash at the
 * opening decision and after each scripted action (advancing to the next player
 * turn between actions, so enemy turns + ATB fill are part of the deterministic
 * progression).
 * @param seed - The 32-bit battle seed.
 * @returns The hash progression and the final state.
 */
function play(seed: number): Run {
  let state = runToNextDecision(
    startBattle([PARTY.wren, PARTY.tobi], ENCOUNTERS["the-drip"], seed)
  );
  const hashes: string[] = [hashState(state)];
  for (const action of SCRIPT) {
    state = runToNextDecision(step(state, action));
    hashes.push(hashState(state));
  }
  return { hashes, final: state };
}

describe("determinism state-hash gate", () => {
  it("plays the seeded encounter all the way to Victory (guards against a no-op pass)", () => {
    const run = play(0x1234abcd);
    expect(run.final.phase).toBe("won");
    // Every enemy is down and the party survived.
    expect(run.final.enemies.every(enemy => enemy.hp <= 0)).toBe(true);
    expect(run.final.party.some(member => member.hp > 0)).toBe(true);
  });

  it("yields an identical hash progression for the same seed + same action sequence", () => {
    const a = play(0x1234abcd);
    const b = play(0x1234abcd);
    expect(a.hashes).toEqual(b.hashes);
    // A real progression, not a single trivially-equal snapshot.
    expect(a.hashes).toHaveLength(SCRIPT.length + 1);
    expect(new Set(a.hashes).size).toBeGreaterThan(1);
  });

  it("diverges for a different seed (the RNG threads through every resolved hit)", () => {
    expect(play(0x1234abcd).hashes).not.toEqual(play(0x0badf00d).hashes);
  });

  it("reproduces the committed hash progression the e2e play-through pins to (DoD #127)", () => {
    // The headless twin must match the SAME committed constant the browser
    // `__VERIFY__.hash()` lane asserts against — proving the two lanes agree on
    // one fact, not merely with each other. [EVIDENCE: determinism-hash-identical]
    expect(play(DETERMINISM_SEED_A).hashes).toEqual(DETERMINISM_HASHES_SEED_A);
    expect(play(DETERMINISM_SEED_B).hashes).toEqual(DETERMINISM_HASHES_SEED_B);
    // And the two seeds' pinned progressions genuinely diverge.
    expect(DETERMINISM_HASHES_SEED_A).not.toEqual(DETERMINISM_HASHES_SEED_B);
  });

  it("spends Anima on Craft and grist on Bind along the way (the two-resource economy)", () => {
    let state = runToNextDecision(
      startBattle([PARTY.wren, PARTY.tobi], ENCOUNTERS["the-drip"], 0x1234abcd)
    );

    const apBeforeCraft = state.party[0]?.ap ?? 0;
    state = runToNextDecision(step(state, SCRIPT[0]!)); // strike
    state = runToNextDecision(step(state, SCRIPT[1]!)); // craft (spends AP)
    expect(state.party[0]?.ap ?? 0).toBeLessThan(apBeforeCraft);
    // The construct kill funded the pool, so a Bind is now affordable.
    const gristBeforeBind = state.grist;
    expect(gristBeforeBind).toBeGreaterThan(0);

    state = runToNextDecision(step(state, SCRIPT[2]!)); // bind (spends grist)
    expect(state.grist).toBeLessThan(gristBeforeBind);
  });
});
