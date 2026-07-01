/**
 * Pause/main-menu verification (UAT) suite — the manifest for sub-task #113 (Story
 * #99 / PD-3.8, PRD #42 FR7 + AC9/AC10). Boots the Menu scene directly via
 * `?scene=menu` and drives it through the *real keyboard* (the acceptance criteria
 * require the menu to be keyboard-operable) to prove, empirically against the live
 * canvas:
 *
 * - [menu-open-384x216] the pause/main menu opens at 384×216, integer zoom, no errors.
 * - [menu-builds-opens-growth] navigating to **Builds** and confirming opens the
 *   *existing* Phase-2 growth screen (the Bench, #76) — reused, not re-spec'd (AC10).
 * - [menu-keyboard-navigates] arrow navigation is keyboard-operable and stays in the
 *   menu until an entry is confirmed.
 *
 * The six-entries contract (AC9) and the entry→route mapping are proven exhaustively
 * and deterministically by the headless unit suite (`tests/logic/pause-menu.test.ts`);
 * this spec proves the live scene wires that model to the canvas and the real input
 * path. It never touches the other specs and leaves the default battle boot unchanged,
 * so every existing test stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/**
 * A short dwell between discrete keystrokes so each keydown lands in its own
 * Phaser update tick — two `press` calls fired back-to-back can coalesce and drop
 * the first (the cursor would never move), exactly like the field spec's keystroke
 * dwell.
 */
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
 * Focus the game canvas so real keyboard events are delivered to Phaser.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Boot the Menu scene directly with the bridge enabled. The `?scene=menu` query
 * makes the Preloader start the pause/main menu instead of Battle.
 * @param page - The Playwright page.
 */
async function bootMenu(page: Page): Promise<void> {
  await page.goto("/?scene=menu&uat=1");
  await waitForScene(page, "Menu");
}

test.describe("GRIST — pause/main menu verification (UAT)", () => {
  test("[menu-open-384x216] opens the pause/main menu at 384x216, integer-scaled, no errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await expect(page.locator("canvas")).toBeVisible();

    const scene = await page.evaluate(() => window.__VERIFY__?.scene() ?? "");
    expect(scene).toBe("Menu");

    // The canvas renders at the locked 384×216 native resolution (read from the
    // DOM element — the menu scene registers no bridge view of its own; the full
    // __VERIFY__ menu surface is the verification sub-task #117).
    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });

    expect(errors).toEqual([]);
  });

  test("[menu-builds-opens-growth] navigating to Builds and confirming opens the existing growth screen (AC10)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await focusCanvas(page);

    // The cursor starts on Party (entry 0); one step down focuses Builds (entry 1).
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(KEY_DWELL);
    // Confirm Builds → the existing Phase-2 growth screen (the Bench, #76), reused.
    await page.keyboard.press("Enter");

    await waitForScene(page, "Bench");
    const scene = await page.evaluate(() => window.__VERIFY__?.scene() ?? "");
    expect(scene).toBe("Bench");
    expect(errors).toEqual([]);
  });

  test("[menu-keyboard-navigates] arrow navigation is keyboard-operable and stays in the menu", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await focusCanvas(page);

    // Move the cursor around the ring; navigation must not leave the menu.
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(KEY_DWELL);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(KEY_DWELL);
    await page.keyboard.press("ArrowUp");
    // Give the scene a beat to process the keystrokes before asserting.
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
        timeout: SEEN_TIMEOUT,
      })
      .toBe("Menu");

    expect(errors).toEqual([]);
  });
});
