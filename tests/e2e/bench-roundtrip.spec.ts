/**
 * Bench (growth screen) exit + roundtrip verification (UAT) suite — the manifest for
 * sub-task #239. Boots the **Field** (the primary gameplay surface) via `?scene=field`
 * and drives it through the *real keyboard* (and the semantic pointer path) to prove,
 * empirically against the live canvas, that the pause Menu → Builds → **Bench** journey
 * — which previously stranded the player with no exit but a page reload — now backs all
 * the way out to the Field exactly where the player left off:
 *
 * - [EVIDENCE: bench-roundtrip] Field → Esc (pause Menu) → Builds → Bench → Esc (back to
 *   the Menu) → Esc (back to the Field) returns the player to the Field's exact room,
 *   phase, grist, and Wren position — the Bench is no longer a dead end, and the #233
 *   stash/resume survives the Menu→Bench→Menu detour intact.
 * - [EVIDENCE: bench-back-pointer] the pointer-first Bench's on-screen Back control (the
 *   semantic `back` intent, the same one the tappable button publishes) returns the Bench
 *   to the pause Menu — proving touch players, who have no Esc key, also have an exit.
 *
 * The pure exit decision (return to the caller vs. stay standalone) is proven headless in
 * `tests/logic/bench-nav.test.ts`; this spec proves the live scenes wire that decision to
 * the canvas and the real input path, and that `?scene=bench` still boots standalone (the
 * bench suite relies on it — a standalone bench has no caller, so Back stays put).
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;
/** A short dwell between discrete keystrokes so each lands in its own update tick. */
const KEY_DWELL = 150;
/** How long to hold a movement key so Wren visibly leaves her spawn. */
const HOLD_MS = 300;

/** A snapshot of the field the return assertion compares before/after the detour. */
interface FieldSnapshot {
  readonly room: string;
  readonly phase: string;
  readonly grist: number;
  readonly wren: { readonly x: number; readonly y: number };
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
 * Boot the Field scene directly at a fixed seed with the bridge enabled.
 * @param page - The Playwright page.
 */
async function bootField(page: Page): Promise<void> {
  await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Field");
}

/**
 * Focus the game canvas so real keyboard events reach Phaser.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Read the live field snapshot (room / phase / grist / Wren position).
 * @param page - The Playwright page.
 * @returns The field snapshot.
 */
async function readField(page: Page): Promise<FieldSnapshot> {
  return page.evaluate(() => {
    const field = window.__VERIFY__?.field();
    return {
      room: field?.room ?? "",
      phase: field?.phase ?? "",
      grist: field?.grist ?? -1,
      wren: field?.wren ?? { x: 0, y: 0 },
    };
  });
}

/**
 * Press a key, then dwell so the keystroke lands in its own Phaser update tick.
 * @param page - The Playwright page.
 * @param key - The key to press.
 */
async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/**
 * Walk Wren off her spawn and open the pause Menu → Builds → the Bench, returning the
 * pre-detour field snapshot so a caller can assert the exact resume. Party(0) → Builds(1)
 * is one step down, then confirm opens the growth screen.
 * @param page - The Playwright page.
 * @returns The field snapshot captured just before the detour.
 */
async function enterBenchViaBuilds(page: Page): Promise<FieldSnapshot> {
  await bootField(page);
  await focusCanvas(page);

  // Walk Wren right so the "return to the same spot" claim is non-trivial.
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(HOLD_MS);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(KEY_DWELL);

  const before = await readField(page);
  expect(before.wren.x).toBeGreaterThan(70);

  await pressKey(page, "Escape");
  await waitForScene(page, "Menu");
  await pressKey(page, "ArrowDown");
  await pressKey(page, "Enter");
  await waitForScene(page, "Bench");
  return before;
}

test.describe("GRIST — Bench exit + roundtrip from the pause menu (UAT, #239)", () => {
  test("[bench-roundtrip] Esc backs the Bench out through the pause Menu to the exact field spot", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    const before = await enterBenchViaBuilds(page);

    // The bench actually rendered (not a null/dead surface) before we exit it.
    expect(
      await page.evaluate(() => window.__VERIFY__?.bench()?.scene ?? null)
    ).toBe("Bench");

    // [EVIDENCE: bench-roundtrip] Back peels one layer at a time: the first Esc returns
    // the Bench to the pause Menu (carrying the Field caller), the second returns the
    // Menu to the Field — exactly where the player paused, not a cold restart.
    await pressKey(page, "Escape");
    await waitForScene(page, "Menu");
    await pressKey(page, "Escape");
    await waitForScene(page, "Field");

    const after = await readField(page);
    expect(after.room).toBe(before.room);
    expect(after.phase).toBe(before.phase);
    expect(after.grist).toBe(before.grist);
    // Wren is dropped back on the exact pixel she paused on, not respawned at the entrance.
    expect(after.wren.x).toBeCloseTo(before.wren.x, 1);
    expect(after.wren.y).toBeCloseTo(before.wren.y, 1);

    expect(errors).toEqual([]);
  });

  test("[bench-back-pointer] the Bench's on-screen Back control returns to the pause Menu", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await enterBenchViaBuilds(page);

    // [EVIDENCE: bench-back-pointer] the tappable Back control's semantic `back` intent
    // (the pointer exit for touch players, who have no Esc key) returns Bench → Menu.
    await page.evaluate(() => window.__VERIFY__?.benchBack());
    await waitForScene(page, "Menu");

    // And from the Menu the player is still one Esc from the Field (the caller was
    // threaded through the Bench), so no dead end anywhere on the journey.
    await pressKey(page, "Escape");
    await waitForScene(page, "Field");

    expect(errors).toEqual([]);
  });

  test("[bench-standalone-seam] ?scene=bench still boots the Bench standalone (Back stays put)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // The dev/UAT seam is preserved: a standalone Bench boot has no caller, so Back
    // stays on the Bench (the bench suite relies on this).
    await page.goto("/?scene=bench&uat=1");
    await waitForScene(page, "Bench");
    await focusCanvas(page);
    await pressKey(page, "Escape");
    expect(await page.evaluate(() => window.__VERIFY__?.scene())).toBe("Bench");

    expect(errors).toEqual([]);
  });
});
