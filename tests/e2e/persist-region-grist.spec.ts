/**
 * Region-earned Grist **persistence** verification (UAT) suite — the manifest for #245.
 * The exploratory-QA pass observed, live on the production build: after clearing a region
 * through the World Map travel front door (Grist climbing 14→34, the region marked
 * COMPLETE and the world turned to Ashfall), a reload + **Continue** dropped the player
 * back with Grist rolled back to 14 — the region progress persisted while the currency it
 * earned did NOT. Two save layers out of sync: the region-progress write and the economy
 * write each owned an independent `load → fold → save` chain, so the region write — which
 * preserves grist verbatim from its own load — loaded the pre-win balance before the
 * economy write committed and then landed last, clobbering the credited grist.
 *
 * This proves the fix end-to-end: with both writes serialized through the ONE shared
 * save-autosave queue, a region battle win's credited Grist survives a GENUINE IndexedDB
 * reload and Continue, alongside the region completion — an internally-consistent save.
 * The pure serialization is proven headless (`tests/services/save-autosave`); this spec
 * proves the live scenes wire it through the REAL travel → battle → resume path.
 *
 * - [EVIDENCE: persist-region-grist] Field → Map → travel → win region battles (Grist
 *   climbs) → GENUINE reload → Continue → the live Field wallet holds the earned Grist,
 *   NOT the pre-travel balance, and the region is still COMPLETE. Errors-clean throughout.
 *
 * The field-path counterpart (`persist-run-economy.spec.ts`, #235) proves the Bench/Field
 * economy persists; this is its region-path sibling, closing the travel-battle gap #245
 * opened. It leaves the default boot untouched so every existing spec stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Dwell between synthetic keystrokes so Phaser processes each discretely. */
const KEY_DWELL = 150;
/** Grace for the async `saveService.has()` boot read to resolve before driving Continue. */
const SAVE_READ_DWELL = 500;

/** The World Map surface sub-shape this spec reads (region statuses only). */
interface Surface {
  readonly regions: readonly { readonly id: string; readonly status: string }[];
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
 * Wait until the `__VERIFY__` bridge exposes the field + travel/battle entry points.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.field === "function" &&
            typeof window.__VERIFY__?.autoWin === "function" &&
            typeof window.__VERIFY__?.worldMapSurface === "function" &&
            typeof window.__VERIFY__?.loadSave === "function" &&
            typeof window.__VERIFY__?.clearSave === "function"
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Focus the game canvas so real keyboard events reach Phaser.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Press a key through the real keyboard and dwell so Phaser processes it discretely.
 * @param page - The Playwright page.
 * @param key - The key to press.
 */
async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/** Collect console + page errors so the test can assert the run stayed clean. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", m => {
    if (m.type() === "error") {
      errors.push(m.text());
    }
  });
  page.on("pageerror", e => errors.push(e.message));
  return errors;
}

/**
 * The persisted World Map surface (re-adopting the persisted save first so a just-written
 * region clear surfaces), projected to the region-status sub-shape.
 * @param page - The Playwright page.
 * @returns The surface snapshot.
 */
async function readSurface(page: Page): Promise<Surface> {
  return page.evaluate(async () => {
    await window.__VERIFY__!.loadSave();
    return window.__VERIFY__!.worldMapSurface().surface as unknown;
  }) as Promise<Surface>;
}

/** The live registry run's Grist, read off the Field view (−1 outside the Field). */
async function fieldGrist(page: Page): Promise<number> {
  return page.evaluate(() => window.__VERIFY__?.field()?.grist ?? -1);
}

/**
 * Win the region encounter under the cursor through a REAL battle: engage, auto-win, and
 * wait for control to return to the Region.
 * @param page - The Playwright page.
 */
async function winRegionEncounter(page: Page): Promise<void> {
  await press(page, "Enter");
  await waitForScene(page, "Battle");
  await page.evaluate(() => window.__VERIFY__?.autoWin());
  await waitForScene(page, "Region");
  await focusCanvas(page);
}

test.describe("GRIST — region-earned Grist persistence verification (UAT)", () => {
  test("[EVIDENCE: persist-region-grist] Grist earned through region battles survives a genuine reload + Continue, with the region still complete", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // Enter through the real front door and start from a clean save.
    await page.goto("/?scene=field&uat=1");
    await waitForScene(page, "Field");
    await waitForBridge(page);
    await focusCanvas(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());

    const baselineGrist = await fieldGrist(page);
    expect(baselineGrist).toBeGreaterThanOrEqual(0);

    // Field → pause Menu → Map (Menu order: Party, Builds, Items, Ledger, Map).
    await press(page, "Escape");
    await waitForScene(page, "Menu");
    for (let i = 0; i < 4; i += 1) {
      await press(page, "ArrowDown");
    }
    await press(page, "Enter");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);

    // Travel into the first region (the Marrow — available + free from the start) and win
    // both of its encounters through REAL battles; each win credits loot Grist.
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);
    expect(
      await page.evaluate(() => window.__VERIFY__?.regionRun()?.regionId)
    ).toBe("marrow");
    await winRegionEncounter(page);
    await winRegionEncounter(page);
    expect(
      await page.evaluate(() => window.__VERIFY__?.regionRun()?.phase)
    ).toBe("complete");

    // Return through the front door: Region → Map → Field, then read the LIVE wallet — the
    // authoritative credited balance the registry holds (the "Grist 34" the map showed).
    await press(page, "Escape");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);
    await press(page, "Escape");
    await waitForScene(page, "Field");
    const earnedGrist = await fieldGrist(page);
    // The region battles actually credited Grist — the scenario is not vacuous.
    expect(earnedGrist).toBeGreaterThan(baselineGrist);

    // Wait until the region-progress write (the one that used to clobber the economy) has
    // settled in the persisted save, so the reload reads a fully-committed store.
    await expect
      .poll(
        async () =>
          (await readSurface(page)).regions.find(r => r.id === "marrow")
            ?.status,
        { timeout: SEEN_TIMEOUT }
      )
      .toBe("complete");

    // GENUINE reload — a fresh document + a fresh SaveService reading the same on-disk
    // IndexedDB — then drive the Title's Continue with real keyboard input.
    await page.goto("/?uat=1");
    await waitForScene(page, "Title");
    await page.waitForTimeout(SAVE_READ_DWELL);
    await focusCanvas(page);
    await press(page, "ArrowDown"); // focus Continue (enabled — a save exists)
    await press(page, "Enter"); // load the saved run into the Field
    await waitForScene(page, "Field");

    // The #245 assertion: Continue restores the EARNED Grist, not the pre-travel balance.
    // Before the fix the region write clobbered the credited grist, so this read the
    // baseline (the QA "34 → 14" rollback); with the unified save queue it holds.
    expect(await fieldGrist(page)).toBe(earnedGrist);

    // ...and the save is internally consistent: the region is still COMPLETE alongside it.
    expect(
      (await readSurface(page)).regions.find(r => r.id === "marrow")?.status
    ).toBe("complete");

    expect(errors).toEqual([]);
  });
});
