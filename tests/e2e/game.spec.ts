import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - Expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Boot to the menu and start a run.
 * @param page - The Playwright page.
 */
async function startRun(page: Page): Promise<void> {
  await waitForScene(page, "MainMenu");
  await page.keyboard.press("Space");
  await waitForScene(page, "Game");
}

test.describe("GRIST — verification (UAT)", () => {
  test("boots to the main menu with a canvas and no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await page.goto("/?uat=1");
    await waitForScene(page, "MainMenu");
    await expect(page.locator("canvas")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("starts a run with full lives and zero score", async ({ page }) => {
    await page.goto("/?uat=1");
    await page.evaluate(() => window.__VERIFY__?.seed(12345));
    await startRun(page);

    const state = await page.evaluate(() => window.__VERIFY__?.state());
    expect(state?.lives).toBe(3);
    expect(state?.score).toBe(0);
    expect(state?.status).toBe("playing");
  });

  test("movement intent moves the player", async ({ page }) => {
    await page.goto("/?uat=1");
    await startRun(page);

    const before = await page.evaluate(
      () => window.__VERIFY__?.state()?.playerX ?? 0
    );
    await page.evaluate(() => window.__VERIFY__?.setIntent(1));
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.state()?.playerX ?? 0))
      .toBeGreaterThan(before + 20);

    await page.evaluate(() => window.__VERIFY__?.setIntent(-1));
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.state()?.playerX ?? 0))
      .toBeLessThan(before);
    await page.evaluate(() => window.__VERIFY__?.clearIntent());
  });

  test("catching an item increases the score (agent plays to catch)", async ({
    page,
  }) => {
    await page.goto("/?uat=1");
    await page.evaluate(() => window.__VERIFY__?.seed(777));
    await startRun(page);

    // Each poll: steer the player toward the lowest active item, return score.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const bridge = window.__VERIFY__;
            const state = bridge?.state();
            if (!bridge || !state) {
              return 0;
            }
            const [first] = state.items;
            if (!first) {
              bridge.setIntent(0);
              return state.score;
            }
            const lowest = state.items.reduce(
              (best, item) => (item.y > best.y ? item : best),
              first
            );
            bridge.setIntent(Math.sign(lowest.x - state.playerX));
            return state.score;
          }),
        { timeout: 25_000, intervals: [80] }
      )
      .toBeGreaterThan(0);
  });

  test("a run ends in GameOver when lives are exhausted", async ({ page }) => {
    await page.goto("/?uat=1");
    await page.evaluate(() => window.__VERIFY__?.seed(999));
    await startRun(page);
    // Pin the player to a corner so most items are missed.
    await page.evaluate(() => window.__VERIFY__?.setIntent(-1));
    await waitForScene(page, "GameOver");
  });
});
