/**
 * Learning-progression **persistence** verification (UAT) suite — the manifest for #264:
 * on Continue the Bench must be internally self-consistent. The pass-4 exploratory-QA
 * sweep observed a contradiction — after a genuine reload + Continue the equip button
 * still read "The Marrow Bound — equipped (learning Cinder)" (the equipped-shard state
 * persisted) while the status line reverted to "Cinder: not begun (equip the shard)"
 * (the learning progress had silently reset to a fresh state). The two surfaces
 * disagreed because one read the persisted `equippedShards` and the other read a
 * `learning` that `runStateFromSave` threw away.
 *
 * The fix persists the learning progression the same way the wallet/build persist
 * (owner decision #235: "persist whatever a player would call my progress"): the Bench's
 * equip/accelerate `#commit` folds the run's learning into `SaveDataV3.learned` /
 * `SaveDataV3.learning` (original v1 fields — no save-version bump) via the pure
 * `foldLearning` projection, and Continue's `runStateFromSave` rehydrates it. So after a
 * reload the Bench's two label sources derive from the SAME restored learning and always
 * agree.
 *
 * This spec drives the REAL Bench through the live input bridge, reads the persisted
 * bytes straight from IndexedDB across a GENUINE document reload, drives the Title's
 * **Continue** and the pause-menu → Builds → Bench journey with real keyboard input, and
 * asserts the reopened Bench is self-consistent — the exact player path the QA sweep
 * walked.
 *
 * - [EVIDENCE: bench-state-consistent-after-continue] equip the Marrow shard + accelerate
 *   Cinder to 50% → GENUINE reload → the persisted save holds the equipped shard AND the
 *   50% Cinder learning together → Continue → open the Bench → the shard reads equipped
 *   AND Cinder reads in-progress at 50% (never "not begun"), so the equip button and the
 *   status line agree. A determinism check (no page errors) rides along.
 *
 * The pure fold + the projection round-trip are proven exhaustively and deterministically
 * by the headless suites (`tests/logic/save/learning`, `tests/logic/spell-learning`,
 * `tests/logic/save-run`); this spec proves the live scenes wire the fold to real
 * IndexedDB persistence through the real input path. It leaves the default boot unchanged
 * so every existing spec stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Grace for the async `saveService.has()` boot read to resolve before driving Continue. */
const SAVE_READ_DWELL = 500;
/** Dwell between synthetic keystrokes so Phaser processes each discretely. */
const KEY_DWELL = 150;
/** A wallet seeded above the sink cost so the accelerate is affordable. */
const FUNDED_GRIST = 100;
/** The shard the bench equips (the Marrow/Ashling reward shard). */
const MARROW_SHARD = "marrow-bound";
/** One Accelerate: Cinder award advances the 100-point bar by 50 → 50%. */
const HALF_PROGRESS = 0.5;
/** Floating-point tolerance for the persisted/read progress fraction. */
const EPSILON = 1e-6;

/** The persisted sub-shape `loadSave()` round-trips (v3), declared locally. */
interface LoadedSave {
  readonly build: { readonly equippedShards: readonly string[] };
  readonly learned: readonly string[];
  readonly learning: readonly {
    readonly spell: string;
    readonly progress: number;
  }[];
}

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - The expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Wait until the Bench bridge (equip + the accelerate driver + the save bridge) is wired.
 * @param page - The Playwright page.
 */
async function waitForBenchBridge(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof window.__VERIFY__?.equipShard === "function" &&
          typeof window.__VERIFY__?.accelerateCinder === "function" &&
          typeof window.__VERIFY__?.loadSave === "function" &&
          typeof window.__VERIFY__?.clearSave === "function"
      )
    )
    .toBe(true);
}

/**
 * Read the persisted save straight from IndexedDB via the real bridge.
 * @param page - The Playwright page.
 * @returns The persisted save projected to the build + learning sub-shape.
 */
async function loadedSave(page: Page): Promise<LoadedSave> {
  return (await page.evaluate(() =>
    window.__VERIFY__!.loadSave()
  )) as LoadedSave;
}

/**
 * Press a key through the real keyboard and dwell so Phaser processes it discretely.
 * @param page - The Playwright page.
 * @param key - The key to press.
 */
async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/**
 * Read the Cinder learning entry's progress from a persisted save, or -1 when absent.
 * @param save - The persisted save.
 * @returns The Cinder unlock fraction, or -1 if Cinder is not in progress.
 */
function cinderProgress(save: LoadedSave): number {
  return save.learning.find(entry => entry.spell === "cinder")?.progress ?? -1;
}

/**
 * Boot the real Bench funded, clear any prior save, then grow learning through live
 * input: equip the Marrow shard (begins Cinder) and Accelerate Cinder (−20 grist, +50%).
 * Polls IndexedDB until the write-through commits both the equipped shard and the 50%
 * Cinder learning, so the reload that follows reads a settled store.
 * @param page - The Playwright page.
 */
async function equipAndLearnAtBench(page: Page): Promise<void> {
  await page.goto(`/?scene=bench&uat=1&grist=${FUNDED_GRIST}`);
  await waitForScene(page, "Bench");
  await waitForBenchBridge(page);
  await page.evaluate(() => window.__VERIFY__!.clearSave());

  // Equip the Marrow shard (begins Cinder learning), then accelerate it to 50% — both
  // commit through the real bench #commit → setRunState → autosave (foldLearning).
  await page.evaluate(() => window.__VERIFY__!.equipShard());
  await page.waitForTimeout(KEY_DWELL);
  await page.evaluate(() => window.__VERIFY__!.accelerateCinder());

  // Poll IndexedDB until the grown learning has written THROUGH: the equipped shard AND
  // the 50% Cinder learning are both present in the persisted save.
  await expect
    .poll(
      async () => {
        const save = await loadedSave(page);
        return (
          save.build.equippedShards.includes(MARROW_SHARD) &&
          Math.abs(cinderProgress(save) - HALF_PROGRESS) < EPSILON
        );
      },
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Reload the plain Title and drive **Continue** with real keyboard input, landing in the
 * Field with the saved run rebuilt. A genuine `page.goto` — a fresh document + a fresh
 * SaveService reading the same on-disk IndexedDB — is the real "close the page and
 * reopen" boundary.
 * @param page - The Playwright page.
 */
async function reloadAndContinue(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForScene(page, "Title");
  await page.waitForTimeout(SAVE_READ_DWELL);
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
  await pressKey(page, "ArrowDown"); // focus Continue (enabled — a save exists)
  await pressKey(page, "Enter"); // load the saved run into the Field
  await waitForScene(page, "Field");
}

/**
 * From the Field, open the pause Menu → Builds → the Bench with real keyboard input — the
 * exact player path the QA sweep walked to reach the contradictory display. Party(0) →
 * Builds(1) is one ArrowDown then Enter.
 * @param page - The Playwright page.
 */
async function openBenchViaBuilds(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
  await pressKey(page, "Escape");
  await waitForScene(page, "Menu");
  await pressKey(page, "ArrowDown"); // Party → Builds
  await pressKey(page, "Enter"); // open the Bench
  await waitForScene(page, "Bench");
}

test.describe("GRIST — learning-progression persistence verification (UAT, #264)", () => {
  test("[EVIDENCE: bench-state-consistent-after-continue] equipped shard + Cinder learning survive a genuine reload and Continue, so the Bench labels agree", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await equipAndLearnAtBench(page);

    // The persisted bytes hold BOTH the equipped shard and the 50% Cinder learning
    // together before the reload even happens — the two surfaces will agree because they
    // now derive from the same persisted truth.
    const beforeReload = await loadedSave(page);
    expect(beforeReload.build.equippedShards).toContain(MARROW_SHARD);
    expect(cinderProgress(beforeReload)).toBeCloseTo(HALF_PROGRESS);

    await reloadAndContinue(page);
    await openBenchViaBuilds(page);

    // The AC: the equip button and the Cinder status line AGREE. The Bench derives the
    // button from `shardEquipped` and the status line's "begun" from
    // `cinderLearning || cinderProgress > 0` — post-fix both are true, so it never reads
    // "equipped (learning Cinder)" alongside "not begun (equip the shard)".
    const bench = await page.evaluate(() => window.__VERIFY__?.bench());
    expect(bench?.shardEquipped).toBe(true);
    expect(bench?.cinderLearning).toBe(true);
    expect(bench?.cinderProgress).toBeCloseTo(HALF_PROGRESS);

    // The persisted store still holds both after the round-trip (I/O-only path).
    const restored = await loadedSave(page);
    expect(restored.build.equippedShards).toContain(MARROW_SHARD);
    expect(cinderProgress(restored)).toBeCloseTo(HALF_PROGRESS);

    expect(errors).toEqual([]);
  });
});
