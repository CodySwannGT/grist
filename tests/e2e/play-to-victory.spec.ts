import { expect, test, type Page } from "@playwright/test";

import {
  DETERMINISM_HASHES_SEED_A,
  DETERMINISM_HASHES_SEED_B,
} from "../fixtures/determinism-hashes";

const READY_TIMEOUT = 15_000;
/** Two distinct seeds prove identical-on-same-seed and divergent-on-different. */
const SEED_A = 0x1234abcd;
const SEED_B = 0x0badf00d;

/** A combatant ref the verification bridge accepts on a {@link ScriptedAction}. */
interface Ref {
  readonly side: "party" | "enemies";
  readonly index: number;
}

/** One battle action in the hard-coded play-to-victory script. */
interface ScriptedAction {
  readonly kind: "strike" | "craft" | "bind";
  readonly actor: Ref;
  readonly target?: Ref;
  readonly id?: string;
}

/** The before/after sample captured around one scripted action. */
interface StepSample {
  readonly apBefore: number;
  readonly apAfter: number;
  readonly gristBefore: number;
  readonly gristAfter: number;
  readonly phase: string;
  readonly hash: string;
}

const WREN: Ref = { side: "party", index: 0 };
const SCRAPPER: Ref = { side: "enemies", index: 0 }; // marrow-scrapper
const CONSTRUCT: Ref = { side: "enemies", index: 1 }; // render-construct (Flux-weak)

/**
 * The hard-coded encounter script played to victory: a Strike, a Craft (Spark)
 * that one-shots the Flux-weak construct and funds the grist pool with its loot,
 * a grist-spending Bind, and a finishing Craft on the scrapper — Strike + Craft +
 * Bind, ending in Victory.
 */
const SCRIPT: readonly ScriptedAction[] = [
  { kind: "strike", actor: WREN, target: SCRAPPER },
  { kind: "craft", id: "spark", actor: WREN, target: CONSTRUCT },
  { kind: "bind", id: "bind-wisp", actor: WREN },
  { kind: "craft", id: "spark", actor: WREN, target: SCRAPPER },
];

/**
 * Wait until the running game reports the Battle scene.
 * @param page - The Playwright page.
 */
async function waitForBattle(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: READY_TIMEOUT,
    })
    .toBe("Battle");
}

/**
 * Restart the battle under a seed and wait for the bridge to expose the fresh,
 * non-null state — so no caller samples a transient pre-restart snapshot.
 * @param page - The Playwright page.
 * @param seed - The 32-bit battle seed.
 */
async function reseed(page: Page, seed: number): Promise<void> {
  await page.evaluate(s => window.__VERIFY__?.seed(s), seed);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__VERIFY__?.state() !== null &&
          window.__VERIFY__?.hud() !== null
      )
    )
    .toBe(true);
}

/**
 * Drive one scripted action through the bridge and advance to the next player
 * decision — atomically, in a single page evaluation, so the per-frame runner
 * loop cannot interleave between the act and the sample. Captures the actor's AP
 * and the shared grist pool on both sides of the action plus the resulting phase
 * and state hash.
 * @param page - The Playwright page.
 * @param action - The scripted action to apply.
 * @returns The before/after sample for the step.
 */
async function playStep(
  page: Page,
  action: ScriptedAction
): Promise<StepSample> {
  return page.evaluate(scripted => {
    const verify = window.__VERIFY__;
    if (!verify) {
      throw new Error("verification bridge not installed");
    }
    const before = verify.state();
    const apBefore = before?.party[0]?.ap ?? -1;
    const gristBefore = before?.grist ?? -1;
    verify.act(scripted);
    verify.advanceTurn();
    const after = verify.state();
    return {
      apBefore,
      apAfter: after?.party[0]?.ap ?? -1,
      gristBefore,
      gristAfter: after?.grist ?? -1,
      phase: after?.phase ?? "",
      hash: verify.hash() ?? "",
    };
  }, action);
}

/**
 * Play the full hard-coded encounter to its end under a seed: reseed, advance to
 * the opening decision, then run every scripted action. Returns the hash sampled
 * at the opening decision and after each action (the determinism progression),
 * plus the per-step samples and the final phase.
 * @param page - The Playwright page.
 * @param seed - The 32-bit battle seed.
 * @returns The hash progression, per-step samples, and final phase.
 */
async function playEncounter(
  page: Page,
  seed: number
): Promise<{
  hashes: string[];
  steps: StepSample[];
  finalPhase: string;
}> {
  await reseed(page, seed);
  const opening = await page.evaluate(() => {
    const verify = window.__VERIFY__;
    verify?.advanceTurn();
    return { hash: verify?.hash() ?? "", phase: verify?.state()?.phase ?? "" };
  });
  const hashes: string[] = [opening.hash];
  const steps: StepSample[] = [];
  for (const action of SCRIPT) {
    const sample = await playStep(page, action);
    steps.push(sample);
    hashes.push(sample.hash);
    if (sample.phase === "won" || sample.phase === "lost") {
      break;
    }
  }
  const finalPhase = steps.at(-1)?.phase ?? opening.phase;
  return { hashes, steps, finalPhase };
}

test.describe("GRIST — play-to-victory + determinism gate (UAT)", () => {
  test("an agent plays the seeded encounter to VICTORY via the bridge (AC6/AC7)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/?scene=battle&uat=1");
    await waitForBattle(page);

    const { steps, finalPhase } = await playEncounter(page, SEED_A);

    // The run reached a Victory state, asserted via window.__VERIFY__.
    expect(finalPhase).toBe("won");

    // AP drops on Craft: the first Craft (Spark on the construct) spends Anima.
    const craft = steps[1];
    expect(craft?.apAfter).toBeLessThan(craft?.apBefore ?? 0);

    // The construct kill funded the shared pool (loot), so grist is non-zero...
    expect(craft?.gristAfter).toBeGreaterThan(0);

    // ...and grist drops on Bind: the Bind spends from the shared wallet.
    const bind = steps[2];
    expect(bind?.gristAfter).toBeLessThan(bind?.gristBefore ?? 0);

    // The whole play-through produced no console errors or page errors.
    expect(errors).toEqual([]);
  });

  test("determinism state-hash gate: identical progression on the same seed, divergent on another", async ({
    page,
  }) => {
    await page.goto("/?scene=battle&uat=1");
    await waitForBattle(page);

    const first = await playEncounter(page, SEED_A);
    const replay = await playEncounter(page, SEED_A);
    const other = await playEncounter(page, SEED_B);

    // Same seed + same action sequence ⇒ identical hashState progression.
    expect(replay.hashes).toEqual(first.hashes);
    // A real, multi-step progression that actually reached Victory (not a no-op).
    expect(first.finalPhase).toBe("won");
    expect(first.hashes.length).toBe(SCRIPT.length + 1);
    expect(new Set(first.hashes).size).toBeGreaterThan(1);
    // A different seed threads a different RNG stream ⇒ a different progression.
    expect(other.hashes).not.toEqual(first.hashes);

    // Per-increment DoD harness (#127): the browser `__VERIFY__.hash()`
    // progression must equal the committed constant the headless `hashState`
    // twin in tests/logic also pins to — proving both lanes agree on ONE fact,
    // exactly as the AC requires ("compared against the headless hashState()
    // twin in tests/logic"). [EVIDENCE: determinism-hash-identical]
    expect(first.hashes).toEqual([...DETERMINISM_HASHES_SEED_A]);
    expect(other.hashes).toEqual([...DETERMINISM_HASHES_SEED_B]);
  });
});
