/**
 * The region-play-title-uses-the-human-name verification (#247) — the live-canvas
 * proof for the exploratory-QA finding `region-play/raw-slug-title`: before the fix,
 * the region-play screen's banner rendered the raw region slug ("upper-vanta" /
 * "wrack" / "cinderfen") verbatim, a developer id that mismatched the human name the
 * World Map had just shown. This spec drives the REAL front door — Field → pause Menu
 * → World Map → travel into a region — and asserts the booted Region scene's banner is
 * the region's own authored, world-state-aware display name ("The Marrow Reach"), NOT
 * the "marrow" slug.
 *
 * The title is read off the `window.__VERIFY__.regionRun()!.title` bridge seam the
 * Region scene now exposes (the same shared name resolver the banner renders). The
 * Phaser-free twin (`tests/logic/region-display-name.test.ts`) proves the resolver is
 * never a slug, turns with the Reckoning, and agrees with the World-Map row across
 * every region; this spec proves the derived string actually reaches the rendered
 * region-play banner through the real travel flow.
 *
 * Evidence marker (the required test title):
 * - [EVIDENCE: region-title] A travelled region's play screen shows the region's human
 *   display name, not the raw slug.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Dwell between synthetic keystrokes so Phaser processes each discretely. */
const KEY_DWELL = 150;
/** The Marrow region's stable slug — the developer id the bug rendered as the title. */
const MARROW_SLUG = "marrow";
/** The Marrow region's Act I (Reach) authored display name — the human-facing title. */
const MARROW_REACH_NAME = "The Marrow Reach";

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
            typeof window.__VERIFY__?.regionRun === "function" &&
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

test.describe("REGION-PLAY BANNER — human-name title verification (UAT)", () => {
  test("[EVIDENCE: region-title] a travelled region's play screen shows the human name, not the raw slug", async ({
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

    // Travel into the first region (the Marrow — available + free from the start).
    await press(page, "Enter");
    await waitForScene(page, "Region");
    await focusCanvas(page);

    // The booted region is the Marrow (its slug), but the banner it RENDERS is the
    // region's authored human name — the exact mismatch the bug reported.
    const run = await page.evaluate(
      () => window.__VERIFY__?.regionRun() ?? null
    );
    expect(run?.regionId).toBe(MARROW_SLUG);
    expect(run?.title).toBe(MARROW_REACH_NAME);
    expect(run?.title).not.toBe(MARROW_SLUG);

    expect(errors).toEqual([]);
  });
});
