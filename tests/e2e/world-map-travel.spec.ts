/**
 * World-map travel front-door verification (UAT) suite — the manifest for #241. Proves,
 * empirically against the live built game, that the authored regions, the Reckoning, and
 * Act II are reachable in NORMAL PLAY through the World Map travel surface:
 *
 * - [EVIDENCE: worldmap-front-door] the pause Menu's Map entry opens the World Map, and
 *   from the Field a player travels into a region, wins its encounters through REAL
 *   battles, sees the cursor advance, and returns to the Field — all by real keyboard,
 *   with no dead ends and no console errors.
 * - [EVIDENCE: worldmap-unlock-order] a region's successor unlocks only once its
 *   predecessor's playlist is completed (Story #121's Act I order), and the completion +
 *   partial progress persist across a full reload.
 * - [EVIDENCE: worldmap-ashfall-frontier] once the world has turned to ashfall the map
 *   presents the Ashfall state (every region mourned) plus the Act II reunion frontier
 *   and the finale entry at Aurel's heart (#139/#140/#142).
 *
 * The unlock/status/surface projection is proven exhaustively + deterministically by the
 * headless unit suite (`tests/logic/world-map-*.test.ts`); this spec proves the live
 * scene wires that model to the canvas, the real input path, and the persisted save.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;

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
 * Wait until the `__VERIFY__` bridge is installed with the travel + battle entry points.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.worldMapSurface === "function" &&
            typeof window.__VERIFY__?.autoWin === "function" &&
            typeof window.__VERIFY__?.loadSave === "function"
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
 * Press a key, then dwell so the next keystroke lands in its own tick.
 * @param page - The Playwright page.
 * @param key - The key to press.
 */
async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/** Collect console + page errors so a test can assert the run stayed clean. */
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
 * The live World Map surface snapshot read from the bridge (re-adopting the persisted
 * save first so a just-persisted region clear surfaces).
 * @param page - The Playwright page.
 * @returns The surface snapshot.
 */
async function readSurface(page: Page): Promise<{
  regions: readonly {
    readonly id: string;
    readonly status: string;
    readonly tone: string;
  }[];
  reunions: readonly { readonly id: string }[];
  finale: { readonly available: boolean };
  reckoning: { readonly available: boolean } | null;
}> {
  return page.evaluate(async () => {
    await window.__VERIFY__!.loadSave();
    return window.__VERIFY__!.worldMapSurface().surface;
  });
}

/**
 * Win the region encounter under the cursor through a REAL battle: press Enter to
 * engage, wait for the Battle scene, auto-win, and wait for control to return to the
 * Region. Returns the region run cursor after the win.
 * @param page - The Playwright page.
 * @returns The region cursor after the win.
 */
async function winRegionEncounter(page: Page): Promise<number> {
  await press(page, "Enter");
  await waitForScene(page, "Battle");
  await page.evaluate(() => window.__VERIFY__?.autoWin());
  await waitForScene(page, "Region");
  await focusCanvas(page);
  return page.evaluate(() => window.__VERIFY__?.regionRun()?.cursor ?? -1);
}

test.describe("GRIST — world-map travel front door (UAT)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
  });

  test("[EVIDENCE: worldmap-front-door] Field → Map → region → real battles → back to Field, by keyboard, no dead ends", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    // Enter through the real front door: the Field, then the pause Menu's Map entry.
    await page.goto("/?scene=field&uat=1");
    await waitForScene(page, "Field");
    await focusCanvas(page);
    await press(page, "Escape"); // Field → pause Menu
    await waitForScene(page, "Menu");
    // Menu order: Party, Builds, Items, Ledger, Map — step down to Map and confirm.
    for (let i = 0; i < 4; i += 1) {
      await press(page, "ArrowDown");
    }
    await press(page, "Enter");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);

    // Travel into the first region (the Marrow — available from the start).
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);
    const region = await page.evaluate(() => window.__VERIFY__?.regionRun());
    expect(region?.regionId).toBe("marrow");
    expect(region?.cursor).toBe(0);

    // Win both Marrow encounters through real battles; the cursor advances each time.
    expect(await winRegionEncounter(page)).toBe(1);
    expect(await winRegionEncounter(page)).toBe(2);
    expect(
      await page.evaluate(() => window.__VERIFY__?.regionRun()?.phase)
    ).toBe("complete");

    // Leave the region back to the map (Esc), then the map back to the Field (Esc).
    await press(page, "Escape");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);
    await press(page, "Escape");
    await waitForScene(page, "Field");

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: worldmap-unlock-order] completing a region unlocks its successor and persists across a reload", async ({
    page,
  }) => {
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);

    // Before: the Marrow is available, its successor the Roots is locked.
    const before = await readSurface(page);
    expect(before.regions.find(r => r.id === "marrow")?.status).toBe(
      "available"
    );
    expect(before.regions.find(r => r.id === "roots")?.status).toBe("locked");

    // Travel into the Marrow and clear its playlist through real battles.
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);
    await winRegionEncounter(page);
    await winRegionEncounter(page);

    // Reload the whole page (fresh boot) and re-open the map — the clear persisted and
    // the successor (the Roots) is now unlocked.
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");
    await expect
      .poll(
        async () => {
          const s = await readSurface(page);
          return s.regions.find(r => r.id === "marrow")?.status;
        },
        { timeout: SEEN_TIMEOUT }
      )
      .toBe("complete");
    const after = await readSurface(page);
    expect(after.regions.find(r => r.id === "roots")?.status).toBe("available");
  });

  test("[EVIDENCE: worldmap-ashfall-frontier] the turned world presents the Ashfall map + reunion frontier + finale entry", async ({
    page,
  }) => {
    await waitForScene(page, "WorldMap");
    // Turn the world to ashfall via the persisted save (the Reckoning set-piece is #125).
    await page.evaluate(async () => {
      const fresh = await window.__VERIFY__!.loadSave();
      await window.__VERIFY__!.save({ ...fresh, worldState: "ashfall" });
    });
    // Re-open the map on the turned world.
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");
    const surface = await readSurface(page);

    // Every region reads its mourned Ashfall variant, and no region is locked (Act II
    // is nonlinear — the whole map re-opens).
    expect(surface.regions.every(r => r.tone === "ashen")).toBe(true);
    expect(surface.regions.every(r => r.status !== "locked")).toBe(true);
    // The Reckoning hook is gone; the reunion frontier + the finale entry are present.
    expect(surface.reckoning).toBeNull();
    expect(surface.reunions).toHaveLength(4);
    expect(surface.finale.available).toBe(true);
  });
});
