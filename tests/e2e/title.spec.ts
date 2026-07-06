/**
 * Title front-door end-to-end verification (UAT) — the manifest for #226. The bug:
 * launching GRIST at the plain URL dropped the player straight into a combat battle,
 * with the story / field / bench / menu reachable only by hand-typing undocumented
 * `?scene=` URLs. This spec proves the fix on the live production preview, driven
 * through `window.__VERIFY__` plus REAL keyboard and pointer input (the "both inputs
 * work" acceptance criterion):
 *
 *   [title-cold-boot]        a plain URL boots the Title menu, NOT a raw battle.
 *   [title-new-game-keyboard] New Game (Enter) plays the Ch.1 opening and, after the
 *     reveal → tutorial ambush → win, lands the player in the Field with a fresh run —
 *     no secret `?scene=` URL anywhere on the path.
 *   [title-new-game-pointer] New Game via a real pointer click reaches the same opening
 *     (pointer parity with the keyboard).
 *   [title-continue-gating]  Continue is a no-op with no save (the front door stays
 *     put), and once a save exists it is selectable and loads that run into the Field.
 *
 * The `?scene=`/`?start=` seams every other spec uses are unchanged — they are the
 * DEV/UAT verification entry points, not the player path. Only the no-param default
 * changed from Battle to Title. [EVIDENCE: title-front-door]
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Dwell between synthetic keystrokes so Phaser processes each discretely. */
const KEY_DWELL = 150;
/** Grace for the async `saveService.has()` boot read to resolve before driving. */
const SAVE_READ_DWELL = 500;
/** The fixed seed the New Game journey runs under (deterministic, winnable ambush). */
const FIXED_SEED = 12345;
/** Advancing the opening this many times hands off to the tutorial ambush. */
const ADVANCES_TO_AMBUSH = 5;
/** The Continue-restored wallet balance the Field must report after loading the save. */
const SAVED_GRIST = 137;
/** The opening smuggling-run line Wren speaks on the Ch.1 cold boot. */
const OPENING_LINE =
  "Another run through the Marrow. Move the crate, get paid, ask nothing. That's the job.";
/** The New Game entry's logical (384×216) y — for the pointer-parity click. */
const NEW_GAME_Y = 128;

/** A complete, structurally-v3 save carrying a known wallet balance to Continue into. */
const SAVED_RUN = {
  version: 3,
  party: [{ id: "wren", level: 4 }],
  grist: SAVED_GRIST,
  inventory: [] as { id: string; qty: number }[],
  learned: [] as string[],
  learning: [] as { spell: string; progress: number }[],
  choice: { resolved: false },
  moralLedger: { karma: 0, freeChoices: 0, wieldChoices: 0 },
  rng: { seed: FIXED_SEED, state: 987654321 },
  worldState: "reach",
  build: { statBonuses: {}, equippedShards: [] as string[] },
  scene: null,
} as const;

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
 * Attach console + page-error capture; the returned array stays empty across a clean
 * run. Every Title test asserts it is `[]`.
 * @param page - The Playwright page.
 * @returns The live error sink (mutated as errors arrive).
 */
function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", error => errors.push(error.message));
  return errors;
}

/**
 * Focus the canvas (so keyboard events route to Phaser) by clicking a neutral top-left
 * spot, well away from the centered menu entries.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Press a key through the real keyboard and dwell so Phaser processes it discretely.
 * @param page - The Playwright page.
 * @param key - The key to press (e.g. "Enter", "ArrowDown").
 */
async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/**
 * Click a menu entry at its logical (384×216) y with a REAL pointer, mapped through the
 * canvas's rendered box so it is resolution/zoom independent.
 * @param page - The Playwright page.
 * @param logicalY - The entry's logical y in the 384×216 native space.
 */
async function clickEntry(page: Page, logicalY: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  if (box === null) {
    throw new Error("canvas has no bounding box");
  }
  await page.mouse.click(
    box.x + box.width * 0.5,
    box.y + box.height * (logicalY / 216)
  );
}

test.describe("GRIST — the Title front door (UAT, #226)", () => {
  test("[EVIDENCE: title-cold-boot] a plain URL boots the Title menu, not a raw battle", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    // The plain URL (no `?scene=`) — the exact thing a real player opens.
    await page.goto("/?uat=1");
    await waitForScene(page, "Title");
    await expect(page.locator("canvas")).toBeVisible();

    // 384×216, the locked native resolution (decision 0006) — the menu, not a battle.
    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });
    // The front door is NOT a combat encounter: no battle state is live on the Title.
    expect(
      await page.evaluate(() => window.__VERIFY__?.state() ?? null)
    ).toBeNull();

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: title-new-game-keyboard] New Game (keyboard) plays the opening and lands in the Field", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Title");
    await focusCanvas(page);

    // New Game is focused by default — Enter starts a fresh run into the Ch.1 opening.
    await pressKey(page, "Enter");
    await waitForScene(page, "Dialogue");
    expect(
      await page.evaluate(() => window.__VERIFY__?.dialogue()?.caption ?? "")
    ).toBe(OPENING_LINE);

    // The opening plays through the reveal and hands off to the tutorial ambush; the
    // player never types a `?scene=` URL to get here.
    for (let step = 0; step < ADVANCES_TO_AMBUSH; step += 1) {
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    }
    await waitForScene(page, "Battle");

    // Winning the ambush lands the player in the Field with their fresh run.
    const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
    expect(phase).toBe("won");
    await waitForScene(page, "Field");
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.scene ?? "")
    ).toBe("Field");

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: title-new-game-pointer] New Game via a real pointer click reaches the opening", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Title");

    // A real click on the New Game entry — pointer parity with the keyboard path.
    await clickEntry(page, NEW_GAME_Y);
    await waitForScene(page, "Dialogue");
    expect(
      await page.evaluate(() => window.__VERIFY__?.dialogue()?.caption ?? "")
    ).toBe(OPENING_LINE);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: title-continue-gating] Continue is disabled with no save, enabled + loads the run with one", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    // No save: Continue is a no-op — confirming it leaves the player on the Title.
    await page.goto("/?uat=1");
    await waitForScene(page, "Title");
    await page.waitForTimeout(SAVE_READ_DWELL);
    await focusCanvas(page);
    await pressKey(page, "ArrowDown"); // focus Continue
    await pressKey(page, "Enter"); // disabled → no-op
    expect(await page.evaluate(() => window.__VERIFY__?.scene() ?? "")).toBe(
      "Title"
    );

    // Seed a persisted run, then reload the Title so it re-reads that a save exists.
    const saved = await page.evaluate(
      run => window.__VERIFY__?.save(run),
      SAVED_RUN
    );
    expect(saved).toBe(true);

    await page.goto("/?uat=1");
    await waitForScene(page, "Title");
    await page.waitForTimeout(SAVE_READ_DWELL);
    await focusCanvas(page);
    await pressKey(page, "ArrowDown"); // focus Continue (now enabled)
    await pressKey(page, "Enter"); // load the saved run into the Field

    await waitForScene(page, "Field");
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.grist ?? -1)
    ).toBe(SAVED_GRIST);

    expect(errors).toEqual([]);
  });
});
