/**
 * First-battle onboarding verification (UAT) suite (#228) — proves, empirically
 * against the live canvas, the onboarding affordances the ticket asks for:
 *
 * - [onboarding-first-battle-hints-once] a fresh, not-yet-seen battle surfaces the
 *   contextual hint beats (speed on opening, controls when the menu opens, the
 *   AP-vs-Grist beat when Craft is highlighted) — and after a save/reload they never
 *   replay (the one-time `scene.flags` ledger).
 * - [onboarding-bridge-driven-no-hints] a plain bridge-driven battle (`?uat=1`, no
 *   opt-in) surfaces NO beats, so every existing battle spec stays green.
 * - [onboarding-help-panel-controls] the pause menu's System/Settings panel renders
 *   the persistent controls & help reference (the real Shift binding + the AP/Grist
 *   legend), reachable from the menu.
 *
 * The beats are suppressed under the verification surface by default (so specs stay
 * green); this suite opts them in with the gated `?hints=1` seam — exactly like
 * `?encounter=` / `?seed=` — and reads the machine's live state through the
 * `battleOnboarding()` bridge read. The exhaustive hint-machine and reference logic
 * is proven headless (`tests/logic/battle-onboarding.test.ts`,
 * `tests/logic/controls-help.test.ts`); this proves the live wiring.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;
/** A dwell between keystrokes so each keydown lands in its own Phaser update tick. */
const KEY_DWELL = 150;

/** The onboarding snapshot the bridge surfaces. */
interface Onboarding {
  readonly enabled: boolean;
  readonly active: string | null;
  readonly shown: readonly string[];
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
 * Focus the game canvas so real keyboard events reach Phaser.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Read the live onboarding snapshot (a safe default when the bridge is absent).
 * @param page - The Playwright page.
 * @returns The onboarding snapshot.
 */
function readOnboarding(page: Page): Promise<Onboarding> {
  return page.evaluate(
    () =>
      window.__VERIFY__?.battleOnboarding() ?? {
        enabled: false,
        active: null,
        shown: [],
      }
  );
}

/**
 * Wait until a party actor is ready and the command menu is open.
 * @param page - The Playwright page.
 */
async function waitForMenu(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__VERIFY__?.hud()?.menuOpen ?? false),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/** Collect console + page errors for a spec (the standard no-errors guard). */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

test.describe("GRIST — first-battle onboarding verification (UAT, #228)", () => {
  test("[onboarding-first-battle-hints-once] a fresh battle surfaces the hint beats, and a reload never replays them", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // Opt the beats in on a fresh, not-yet-seen battle (the gated `?hints=1` seam).
    await page.goto(`/?scene=battle&uat=1&hints=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Battle");

    // The machine activates once the save resolves (fresh save → not seen).
    await expect
      .poll(() => readOnboarding(page).then(o => o.enabled))
      .toBe(true);

    // The speed beat surfaces on the opening frame.
    await expect
      .poll(() => readOnboarding(page).then(o => o.shown.includes("speed")))
      .toBe(true);
    const opening = await readOnboarding(page);
    expect(opening.active).not.toBeNull();

    // The controls beat surfaces when the command menu first opens.
    await waitForMenu(page);
    await expect
      .poll(() => readOnboarding(page).then(o => o.shown.includes("controls")))
      .toBe(true);

    // Highlighting Craft (one step down from Strike) surfaces the AP-vs-Grist beat.
    await focusCanvas(page);
    await page.keyboard.press("s");
    await page.waitForTimeout(KEY_DWELL);
    await expect
      .poll(() => readOnboarding(page).then(o => o.shown.includes("resources")))
      .toBe(true);

    // Reload: the one-time ledger persisted "seen", so the beats never replay.
    await page.reload();
    await waitForScene(page, "Battle");
    await waitForMenu(page);
    const afterReload = await readOnboarding(page);
    expect(afterReload.enabled).toBe(false);
    expect(afterReload.active).toBeNull();
    expect(afterReload.shown).toEqual([]);

    expect(errors).toEqual([]);
  });

  test("[onboarding-bridge-driven-no-hints] a plain bridge-driven battle surfaces no beats", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // No `?hints=1` opt-in: the beats are suppressed under the verification surface.
    await page.goto(`/?scene=battle&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Battle");
    await waitForMenu(page);

    const onboarding = await readOnboarding(page);
    expect(onboarding.enabled).toBe(false);
    expect(onboarding.active).toBeNull();
    expect(onboarding.shown).toEqual([]);

    expect(errors).toEqual([]);
  });

  test("[onboarding-help-panel-controls] the pause menu's System/Settings panel renders the controls reference", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto("/?scene=menu&uat=1");
    await waitForScene(page, "Menu");
    await focusCanvas(page);

    // Party(0) → System/Settings(5): five steps down, then confirm to open the panel.
    for (let step = 0; step < 5; step += 1) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(KEY_DWELL);
    }
    await page.keyboard.press("Enter");

    // The panel renders the controls & help reference — poll until it resolves.
    await expect
      .poll(() =>
        page.evaluate(() => window.__VERIFY__?.menuHelpControls() ?? null)
      )
      .not.toBeNull();
    const lines = await page.evaluate(
      () => window.__VERIFY__?.menuHelpControls() ?? []
    );
    const blob = lines.join("\n");
    // The real Shift binding and the AP/Grist resource legend are on screen.
    expect(blob).toContain("Shift");
    expect(blob).toContain("AP");
    expect(blob).toContain("Grist");

    expect(errors).toEqual([]);
  });
});
