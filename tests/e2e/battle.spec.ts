import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;

/** The battle resolution snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

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
 * Load the battle at a fixed seed with the verification bridge enabled.
 * @param page - The Playwright page.
 */
async function bootBattle(page: Page): Promise<void> {
  await page.goto(`/?uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Battle");
}

test.describe("GRIST — battle scene verification (UAT)", () => {
  test("boots to the battle with a fixed seed and no console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootBattle(page);
    await expect(page.locator("canvas")).toBeVisible();

    const state = await page.evaluate(() => window.__VERIFY__?.state());
    expect(state?.scene).toBe("Battle");
    expect(state?.party.length).toBeGreaterThan(0);
    expect(state?.enemies.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("renders at 384x216 internal resolution, integer-scaled", async ({
    page,
  }) => {
    await bootBattle(page);

    const resolution = (await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    )) as Resolution | null | undefined;
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(resolution?.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);

    // The canvas backing store is the native resolution; CSS scales it up whole.
    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });
  });

  test("a Strike driven from the scene changes the target's HP in state", async ({
    page,
  }) => {
    await bootBattle(page);

    const before = await page.evaluate(
      () => window.__VERIFY__?.state()?.enemies[0]?.hp ?? 0
    );
    expect(before).toBeGreaterThan(0);

    await page.evaluate(() => window.__VERIFY__?.strike());

    await expect
      .poll(() =>
        page.evaluate(() => window.__VERIFY__?.state()?.enemies[0]?.hp ?? 0)
      )
      .toBeLessThan(before);
  });
});
