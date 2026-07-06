/**
 * Pause-menu reachability verification (UAT) suite — the manifest for sub-task #233.
 * Boots the **Field** (the primary gameplay surface) via `?scene=field` and drives
 * it through the *real keyboard* to prove, empirically against the live canvas, that
 * a normal player can open the pause Menu — and everything behind it (Party / Builds
 * / Items / Ledger codex / Map / System-Help) — which was previously reachable only
 * through the dev-only `?scene=menu` seam:
 *
 * - [EVIDENCE: pause-menu-esc-opens-from-field] pressing Esc in the Field opens the
 *   pause Menu, routed through the semantic field InputService (`open-menu` intent),
 *   with the field session stashed for an exact resume.
 * - [EVIDENCE: pause-menu-system-help-renders-228] the Menu's System/Settings entry
 *   opens the #228 controls & Help reference (Shift + the AP/Grist legend), now
 *   reachable in normal play.
 * - [EVIDENCE: pause-menu-ledger-codex-reachable] the Menu's Ledger entry opens the
 *   moral-ledger codex.
 * - [EVIDENCE: pause-menu-esc-returns-to-field-same-position] Esc from the bare Menu
 *   returns the player to the Field exactly where they left off — same room, phase,
 *   grist, and Wren's exact position (not a respawn).
 *
 * The pure model (the six entries, the ring cursor, the Cancel/Back peel) is proven
 * headless in `tests/logic/pause-menu.test.ts`; this spec proves the live scene wires
 * that model to the canvas and the real input path, and that `?scene=menu` still works
 * (the standalone seam suites are untouched). It never touches the battle boot, so
 * every existing test stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;
/** A short dwell between discrete keystrokes so each lands in its own update tick. */
const KEY_DWELL = 150;
/** How long to hold a movement key so Wren visibly leaves her spawn. */
const HOLD_MS = 300;

/** A snapshot of the field the return assertion compares before/after the menu. */
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

test.describe("GRIST — pause-menu reachability from gameplay (UAT, #233)", () => {
  test("[pause-menu] Esc opens the pause menu from the Field, reaches System-Help + Ledger, and returns to the exact spot", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootField(page);
    await focusCanvas(page);

    // Walk Wren off her spawn so the "return to the same spot" claim is non-trivial.
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(HOLD_MS);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(KEY_DWELL);

    const before = await readField(page);
    // She actually moved right of the spawn (60px) — the session is mid-exploration.
    expect(before.wren.x).toBeGreaterThan(70);

    // [EVIDENCE: pause-menu-esc-opens-from-field] Esc in the Field opens the Menu.
    await pressKey(page, "Escape");
    await waitForScene(page, "Menu");

    // [EVIDENCE: pause-menu-system-help-renders-228] Party(0) → System/Settings(5):
    // five steps down, confirm, and the #228 controls & Help reference renders.
    for (let step = 0; step < 5; step += 1) {
      await pressKey(page, "ArrowDown");
    }
    await pressKey(page, "Enter");
    await expect
      .poll(
        () =>
          page.evaluate(() => window.__VERIFY__?.menuHelpControls() ?? null),
        { timeout: SEEN_TIMEOUT }
      )
      .not.toBeNull();
    const help = await page.evaluate(
      () => window.__VERIFY__?.menuHelpControls() ?? []
    );
    const helpBlob = help.join("\n");
    expect(helpBlob).toContain("Shift");
    expect(helpBlob).toContain("AP");
    expect(helpBlob).toContain("Grist");
    // The reference now teaches its own opener (the Esc pause-menu binding).
    expect(helpBlob).toContain("Esc");

    // [EVIDENCE: pause-menu-ledger-codex-reachable] System(5) → Ledger(3): two steps
    // up (which closes the help panel), confirm, and the moral-ledger codex renders.
    await pressKey(page, "ArrowUp");
    await pressKey(page, "ArrowUp");
    await pressKey(page, "Enter");
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__VERIFY__?.menuLedgerCodex()?.rows.length ?? 0
          ),
        { timeout: SEEN_TIMEOUT }
      )
      .toBeGreaterThan(0);
    // Still in the Menu — opening panels never leaves it.
    expect(await page.evaluate(() => window.__VERIFY__?.scene())).toBe("Menu");

    // [EVIDENCE: pause-menu-esc-returns-to-field-same-position] Back peels one layer:
    // the first Esc closes the open Ledger panel; the second returns to the Field.
    await pressKey(page, "Escape");
    await pressKey(page, "Escape");
    await waitForScene(page, "Field");

    const after = await readField(page);
    expect(after.room).toBe(before.room);
    expect(after.phase).toBe(before.phase);
    expect(after.grist).toBe(before.grist);
    // Wren is dropped back on the exact pixel she paused on, not respawned.
    expect(after.wren.x).toBeCloseTo(before.wren.x, 1);
    expect(after.wren.y).toBeCloseTo(before.wren.y, 1);

    expect(errors).toEqual([]);
  });

  test("[pause-menu-seam] the ?scene=menu verification seam still opens the Menu standalone", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // The dev/UAT seam is preserved: a standalone Menu boot has no caller, so Esc
    // stays in the menu (the ledger-codex / menu suites rely on this).
    await page.goto("/?scene=menu&uat=1");
    await waitForScene(page, "Menu");
    await focusCanvas(page);
    await pressKey(page, "Escape");
    // No caller to return to — the Menu is still the active scene.
    expect(await page.evaluate(() => window.__VERIFY__?.scene())).toBe("Menu");

    expect(errors).toEqual([]);
  });
});
