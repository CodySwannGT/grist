/**
 * The battle-banner-reflects-the-region verification (#248) — the live-canvas proof
 * for the exploratory-QA finding `battle/hardcoded-marrow-descent-banner`: before the
 * fix, EVERY battle rendered the fixed title "MARROW DESCENT" no matter which region
 * the player had travelled to. This spec drives the REAL front door — Field → pause
 * Menu → World Map → travel into a region → engage its encounter — and asserts the
 * launched Battle scene's banner is the region's own contextual, world-state-aware
 * name (the Marrow's Reach reads "THE MARROW REACH"), NOT the hardcoded dungeon string.
 *
 * The banner is read off the `window.__VERIFY__.title()` bridge seam the Battle scene
 * now exposes (the launched region title, or the authored default). The Phaser-free
 * twin (`tests/logic/region-battle-title.test.ts`) proves the resolver derives a
 * DISTINCT banner per region ("UPPER VANTA — …") and that it turns with the Reckoning;
 * this spec proves the derived string actually reaches the rendered battle banner.
 *
 * Evidence marker (the required test title):
 * - [EVIDENCE: battle-region-title] A region battle's banner reflects its region and is
 *   not the fixed "MARROW DESCENT".
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Dwell between synthetic keystrokes so Phaser processes each discretely. */
const KEY_DWELL = 150;
/** The fixed banner the scene used to hardcode for every fight (the #248 regression). */
const LEGACY_FIXED_TITLE = "MARROW DESCENT";
/** The Marrow region's Act I (Reach) authored variant name, upper-cased for the banner. */
const MARROW_REACH_BANNER = "THE MARROW REACH";

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
 * Wait until the `__VERIFY__` bridge exposes the entry points this spec drives.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.field === "function" &&
            typeof window.__VERIFY__?.title === "function" &&
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

test.describe("BATTLE BANNER — region-contextual title verification (UAT)", () => {
  test("[EVIDENCE: battle-region-title] a region battle's banner reflects its region, not the fixed 'MARROW DESCENT'", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // Enter through the real front door and start from a clean save.
    await page.goto("/?scene=field&uat=1");
    await waitForScene(page, "Field");
    await waitForBridge(page);
    await focusCanvas(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());

    // Field → pause Menu → Map (Menu order: Party, Builds, Items, Ledger, Map).
    await press(page, "Escape");
    await waitForScene(page, "Menu");
    for (let i = 0; i < 4; i += 1) {
      await press(page, "ArrowDown");
    }
    await press(page, "Enter");
    await waitForScene(page, "WorldMap");
    await focusCanvas(page);

    // Travel into the first region (the Marrow — available + free from the start) and
    // engage its first encounter through a REAL battle.
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);
    expect(
      await page.evaluate(() => window.__VERIFY__?.regionRun()?.regionId)
    ).toBe("marrow");
    await press(page, "Enter");
    await waitForScene(page, "Battle");

    // The banner reflects the region the player travelled to — its own authored,
    // world-state-aware name — and is NOT the fixed dungeon string the bug reported.
    const banner = await page.evaluate(
      () => window.__VERIFY__?.title() ?? null
    );
    expect(banner).toBe(MARROW_REACH_BANNER);
    expect(banner).not.toBe(LEGACY_FIXED_TITLE);

    expect(errors).toEqual([]);
  });
});
