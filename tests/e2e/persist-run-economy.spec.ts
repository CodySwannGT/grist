/**
 * Run-economy **persistence** verification (UAT) suite — the manifest for the owner
 * decision in #235: the grist a player *earns and spends in a run* must survive a full
 * page close + Continue, not reset to zero. The QA validation pass observed Grist reset
 * 14→0 on a genuine reload while story/scene progress survived, because the save layer's
 * economy autosave was marked "(future)". This spec proves that future is now — driving
 * the REAL Bench scene through live input and asserting, across a GENUINE IndexedDB
 * reload, that the earned wallet + bench build write THROUGH to the save and Continue
 * restores them into live play.
 *
 * The seam under test is the write-through the Field/Bench scenes now perform whenever
 * the run economy commits: on each `setRunState` at a real mutation site (the Bench's
 * equip/sink `#commit`, the Field's battle-result fold), the live wallet balance +
 * bench build fold into `SaveDataV3.grist` / `SaveDataV3.build` via the pure
 * `foldRunEconomy` projection — the same v3 fields Continue's `runStateFromSave` already
 * restores (no save-version bump). This spec drives the equip + sink through the real
 * bench-input bridge (not a data cell), reads the persisted bytes straight from
 * IndexedDB via the real `loadSave()` bridge across a genuine document reload, and then
 * drives the Title's **Continue** with real keyboard input to prove the reopened game's
 * live Field wallet reads exactly what was saved.
 *
 * - [EVIDENCE: persist-run-economy] earn (a funded wallet) → spend at a sink (Runner's
 *   Reflex, −25) + equip a shard → GENUINE reload → the persisted save holds the spent
 *   grist, the +2 SPD augment, and the equipped shard → Continue → the live Field wallet
 *   shows exactly the spent grist. A determinism check (no page errors, rng untouched)
 *   rides along.
 *
 * The pure fold + the Continue projection are proven exhaustively and deterministically
 * by the headless suites (`tests/logic/run-economy`, `tests/logic/save-run`); this spec
 * proves the live scenes wire the fold to real IndexedDB persistence through the real
 * input path. It leaves the default boot unchanged so every existing spec stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Grace for the async `saveService.has()` boot read to resolve before driving Continue. */
const SAVE_READ_DWELL = 500;
/** Dwell between synthetic keystrokes so Phaser processes each discretely. */
const KEY_DWELL = 150;
/** A wallet seeded above the sink cost so the spend is affordable (the "earned grist"). */
const FUNDED_GRIST = 100;
/** Runner's Reflex sink cost (authoritative in `src/content/bench.ts`). */
const RUNNERS_REFLEX_COST = 25;
/** The wallet balance after the spend — the exact grist Continue must restore. */
const SPENT_GRIST = FUNDED_GRIST - RUNNERS_REFLEX_COST;
/** Runner's Reflex grows +2 SPD (the persisted bench "sink progress"). */
const RUNNERS_REFLEX_SPD = 2;
/** The shard the bench equips (the Marrow/Ashling reward shard). */
const MARROW_SHARD = "marrow-bound";

/** The persisted sub-shape `loadSave()` round-trips (v3), declared locally. */
interface LoadedSave {
  readonly grist: number;
  readonly build: {
    readonly statBonuses: Readonly<Record<string, number>>;
    readonly equippedShards: readonly string[];
  };
  readonly rng: { readonly seed: number; readonly state: number };
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
 * Wait until the Bench bridge (equip + the two sink drivers) is wired.
 * @param page - The Playwright page.
 */
async function waitForBenchBridge(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof window.__VERIFY__?.equipShard === "function" &&
          typeof window.__VERIFY__?.buyRunnersReflex === "function" &&
          typeof window.__VERIFY__?.loadSave === "function" &&
          typeof window.__VERIFY__?.clearSave === "function"
      )
    )
    .toBe(true);
}

/**
 * Read the persisted save straight from IndexedDB via the real bridge.
 * @param page - The Playwright page.
 * @returns The persisted save projected to the economy sub-shape.
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
 * Boot the real Bench scene funded, clear any prior save, then earn/spend through live
 * input: equip the Marrow shard (free — grows the build's equipped shards) and buy
 * Runner's Reflex (−25 grist, +2 SPD). Polls IndexedDB until the write-through commits
 * the spent economy, so the reload that follows reads a settled store.
 * @param page - The Playwright page.
 */
async function earnSpendAtBench(page: Page): Promise<void> {
  await page.goto(`/?scene=bench&uat=1&grist=${FUNDED_GRIST}`);
  await waitForScene(page, "Bench");
  await waitForBenchBridge(page);
  await page.evaluate(() => window.__VERIFY__!.clearSave());

  // Equip the Marrow shard (grows equippedShards), then spend at the sink (−25 grist,
  // +2 SPD) — both commit through the real bench #commit → setRunState → autosave.
  await page.evaluate(() => window.__VERIFY__!.equipShard());
  await page.waitForTimeout(KEY_DWELL);
  await page.evaluate(() => window.__VERIFY__!.buyRunnersReflex());

  // Poll IndexedDB until the spent economy has written THROUGH: the drawn-down wallet,
  // the +2 SPD augment, and the equipped shard are all present in the persisted save.
  await expect
    .poll(
      async () => {
        const save = await loadedSave(page);
        return (
          save.grist === SPENT_GRIST &&
          save.build.statBonuses["spd"] === RUNNERS_REFLEX_SPD &&
          save.build.equippedShards.includes(MARROW_SHARD)
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

test.describe("GRIST — run-economy persistence verification (UAT)", () => {
  test("[EVIDENCE: persist-run-economy] earned grist + spent sink + equipped shard survive a genuine reload and Continue", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await earnSpendAtBench(page);

    // The persisted bytes hold the spent economy before the reload even happens.
    const beforeReload = await loadedSave(page);
    const rngBefore = beforeReload.rng;

    await reloadAndContinue(page);

    // The AC's Continue clause: the reopened game's LIVE Field wallet shows exactly the
    // grist held at close — read from the real registry run-state, not a cell.
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.grist ?? -1)
    ).toBe(SPENT_GRIST);

    // The AC's "bench/sink progress and shards match" clause: the build (the +2 SPD
    // augment + the equipped shard) round-tripped through the genuine reload intact.
    const restored = await loadedSave(page);
    expect(restored.grist).toBe(SPENT_GRIST);
    expect(restored.build.statBonuses["spd"]).toBe(RUNNERS_REFLEX_SPD);
    expect(restored.build.equippedShards).toContain(MARROW_SHARD);

    // Determinism: the persistence path is I/O-only — the rng lineage is data, never
    // regenerated, so it comes back verbatim across the reload.
    expect(restored.rng).toEqual(rngBefore);

    expect(errors).toEqual([]);
  });
});
