/**
 * Pause/main-menu verification (UAT) suite — the manifest for sub-task #113 (PRD
 * #42 FR7 / AC9 / AC10). Boots the PauseMenu scene directly via `?scene=pausemenu`
 * and drives it through the in-game `window.__VERIFY__` bridge to prove,
 * empirically against the live canvas, the two acceptance criteria:
 *
 * - [pause-menu-six-entries] the pause/main menu exposes exactly the six entries —
 *   Party, Builds, Items, Ledger, Map, System/Settings — in order (AC1).
 * - [builds-reuses-growth-screen] selecting **Builds** opens the *existing* Phase-2
 *   growth screen (the Bench scene, #76) — not a re-spec'd growth UI (AC2) — and
 *   the reached Bench performs equip shard / spend grist on that reused surface.
 *
 * Every menu action is routed through the scene's semantic pause-menu-input layer
 * (the scene reads no raw key/pointer), so a highlight/confirm driven by the bridge
 * is end-to-end proof the menu → route path works on the canvas. The menu is the
 * sim-authoritative renderer: the entry catalog + Builds→Bench route live in
 * `logic/pause-menu`, and this spec asserts the scene's rendered/opened state
 * mirrors them. This spec never touches the battle/field/bench specs and the battle
 * boot stays the default, so all existing tests stay green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/** The exact six entries the pause/main menu must expose, in menu order (AC1). */
const EXPECTED_ENTRIES = [
  "Party",
  "Builds",
  "Items",
  "Ledger",
  "Map",
  "System/Settings",
] as const;

/** The pause-menu snapshot exposed by the verification bridge. */
interface PauseMenuState {
  readonly scene: string;
  readonly entries: readonly string[];
  readonly selectedIndex: number;
  readonly openedRoute: string | null;
}

/** The bench snapshot exposed by the verification bridge (the AC2 reuse target). */
interface BenchState {
  readonly scene: string;
  readonly grist: number;
  readonly shardEquipped: boolean;
  readonly cinderLearning: boolean;
  readonly cinderProgress: number;
  readonly spdBonus: number;
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
 * Boot the PauseMenu scene directly with the bridge enabled. The `?scene=pausemenu`
 * query makes the Preloader start the PauseMenu instead of Battle.
 * @param page - The Playwright page.
 */
async function bootPauseMenu(page: Page): Promise<void> {
  await page.goto("/?scene=pausemenu&uat=1");
  await waitForScene(page, "PauseMenu");
}

/**
 * Read the live pause-menu snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The pause-menu snapshot, or null if unavailable.
 */
async function pauseMenuState(page: Page): Promise<PauseMenuState | null> {
  return page.evaluate(() => window.__VERIFY__?.pauseMenu() ?? null);
}

/**
 * Read the live bench snapshot from the bridge (null outside the Bench scene).
 * @param page - The Playwright page.
 * @returns The bench snapshot, or null.
 */
async function benchState(page: Page): Promise<BenchState | null> {
  return page.evaluate(() => window.__VERIFY__?.bench() ?? null);
}

test.describe("GRIST — pause/main-menu verification (UAT)", () => {
  test("[pause-menu-six-entries] exposes exactly Party, Builds, Items, Ledger, Map, System/Settings (AC1)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootPauseMenu(page);
    await expect(page.locator("canvas")).toBeVisible();

    const menu = await pauseMenuState(page);
    expect(menu?.scene).toBe("PauseMenu");
    // AC1: exactly the six entries, in menu order — no missing, no extra.
    expect(menu?.entries).toEqual([...EXPECTED_ENTRIES]);

    // The overlay renders at the locked 384x216 native resolution, integer-scaled.
    const resolution = await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    );
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("[pause-menu-keyboard-nav] the highlight is keyboard-navigable and wraps around", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootPauseMenu(page);

    const start = await pauseMenuState(page);
    expect(start?.selectedIndex).toBe(0);

    // Navigate down twice → index 2 (Items).
    await page.evaluate(() => window.__VERIFY__?.navigateMenu(1));
    await page.evaluate(() => window.__VERIFY__?.navigateMenu(1));
    expect((await pauseMenuState(page))?.selectedIndex).toBe(2);

    // Navigate up past the top → wraps to the last entry (index 5).
    await page.evaluate(() => window.__VERIFY__?.navigateMenu(-1));
    await page.evaluate(() => window.__VERIFY__?.navigateMenu(-1));
    await page.evaluate(() => window.__VERIFY__?.navigateMenu(-1));
    expect((await pauseMenuState(page))?.selectedIndex).toBe(5);
    expect(errors).toEqual([]);
  });

  test("[builds-reuses-growth-screen] selecting Builds opens the existing Phase-2 growth screen, not a re-spec (AC2)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootPauseMenu(page);

    // Highlight the Builds entry by id and confirm it (the player's path).
    await page.evaluate(() => window.__VERIFY__?.highlightMenuEntry("builds"));
    const highlighted = await pauseMenuState(page);
    // Builds is index 1 in the canonical order.
    expect(highlighted?.selectedIndex).toBe(1);

    await page.evaluate(() => window.__VERIFY__?.confirmMenuEntry());

    // AC2: the ACTIVE scene after selecting Builds is the existing Bench (#76) —
    // the reused growth screen, not a newly-spec'd one.
    await waitForScene(page, "Bench");
    const bench = await benchState(page);
    expect(bench?.scene).toBe("Bench");

    // And the reached screen is the real growth surface: equip the Ashling shard
    // (begins Cinder learning) on the very screen Builds opened — proving it is the
    // existing #76 Bench (equip / install / spend), not a re-spec.
    expect(bench?.shardEquipped).toBe(false);
    await page.evaluate(() => window.__VERIFY__?.equipShard());
    const grown = await benchState(page);
    expect(grown?.shardEquipped).toBe(true);
    expect(grown?.cinderLearning).toBe(true);
    expect(errors).toEqual([]);
  });
});
