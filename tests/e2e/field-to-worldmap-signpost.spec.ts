/**
 * Field → World Map signpost verification (UAT) suite — the manifest for #261. The
 * intro Field ("Warren Street") used to dead-end a brand-new player: after the tutorial
 * they landed with only `[M] map` / `[Esc] menu` on screen, neither of which advances
 * the game, and the `[M]` mini-map's "clear Warren Street" cue implied an in-field
 * action that does not exist — a discoverability soft-lock. This proves, empirically
 * against the live built game, that the road onward is now obvious and reachable:
 *
 * - [EVIDENCE: field-to-worldmap-signpost] a fresh, opted-in run lands in the Field, the
 *   once-per-save travel signpost shows and points at the World Map, the `[T]` travel
 *   affordance opens the World Map DIRECTLY (no pause-menu hunt), and travel proceeds
 *   into a region — all by real keyboard, no console errors.
 * - the signpost is a true once-per-save beat: it clears on the player's first input and
 *   does not return on a reload of the same save.
 * - the hint stays quiet on plain bridge-driven `?uat=1` runs unless a spec opts in with
 *   `?hints=1` (the #228/#241 gate), so it never noises up the other field specs.
 *
 * The signpost copy + gate are proven exhaustively headless (`tests/logic/field-onboarding
 * .test.ts`); the `[T]` binding by `tests/logic/field-input.test.ts`; this spec proves the
 * live scene wires them to the canvas, the real input path, and the persisted save.
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
 * Wait until the `__VERIFY__` bridge is installed with the field + save entry points.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.field === "function" &&
            typeof window.__VERIFY__?.clearSave === "function" &&
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
 * Read the field's current travel-signpost hint from the bridge (null when absent).
 * @param page - The Playwright page.
 * @returns The on-screen onboarding hint, or null.
 */
async function onboardingHint(page: Page): Promise<string | null> {
  return page.evaluate(
    () => window.__VERIFY__?.field()?.onboardingHint ?? null
  );
}

test.describe("GRIST — Field → World Map signpost (UAT, #261)", () => {
  test.beforeEach(async ({ page }) => {
    // Boot once (hints off, so nothing is shown/marked) to install the bridge, then wipe
    // the save so each test starts from a fresh, unseen once-per-save ledger.
    await page.goto("/?scene=field&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
  });

  test("[EVIDENCE: field-to-worldmap-signpost] the signpost shows, [T] opens the World Map directly, and travel proceeds", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // A fresh, opted-in run lands in the intro Field with the once-per-save signpost up.
    await page.goto("/?scene=field&uat=1&hints=1");
    await waitForScene(page, "Field");
    await expect
      .poll(() => onboardingHint(page), { timeout: SEEN_TIMEOUT })
      .not.toBeNull();
    const hint = await onboardingHint(page);
    // The copy points at the real road onward — the World Map — and names the key.
    expect(hint).toContain("world map");
    expect(hint).toContain("[T]");

    // The [T] travel affordance opens the World Map DIRECTLY — no pause-menu detour.
    await focusCanvas(page);
    await press(page, "KeyT");
    await waitForScene(page, "WorldMap");

    // Travel proceeds: from the map, entering the first region boots real region play.
    await focusCanvas(page);
    await press(page, "Enter");
    await waitForScene(page, "Region");
    const region = await page.evaluate(() => window.__VERIFY__?.regionRun());
    expect(region?.regionId).toBe("marrow");

    expect(errors).toEqual([]);
  });

  test("the signpost is a once-per-save beat — clears on first input and never returns on reload", async ({
    page,
  }) => {
    // First opted-in landing: the signpost is up.
    await page.goto("/?scene=field&uat=1&hints=1");
    await waitForScene(page, "Field");
    await expect
      .poll(() => onboardingHint(page), { timeout: SEEN_TIMEOUT })
      .not.toBeNull();

    // The player's first input dismisses it — it never lingers over play.
    await focusCanvas(page);
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(() => onboardingHint(page), { timeout: SEEN_TIMEOUT })
      .toBeNull();
    await page.keyboard.up("ArrowRight");

    // The seen-flag write has landed on the persisted save.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const save = await window.__VERIFY__!.loadSave();
            return save.scene?.flags?.["fieldTravelOnboardingSeen"] === true;
          }),
        { timeout: SEEN_TIMEOUT }
      )
      .toBe(true);

    // Reload the same save, opted in again: the beat has fired for this save and stays
    // quiet — a once-per-save signpost, not a nag.
    await page.goto("/?scene=field&uat=1&hints=1");
    await waitForScene(page, "Field");
    await page.waitForTimeout(KEY_DWELL);
    expect(await onboardingHint(page)).toBeNull();
  });

  test("the signpost stays quiet on a plain bridge-driven run (no ?hints opt-in)", async ({
    page,
  }) => {
    // Under ?uat=1 without ?hints=1 the beat is suppressed so it never noises up the
    // other field specs (the #228/#241 gate) — even on a fresh, unseen save.
    await page.goto("/?scene=field&uat=1");
    await waitForScene(page, "Field");
    await page.waitForTimeout(KEY_DWELL);
    expect(await onboardingHint(page)).toBeNull();
  });
});
