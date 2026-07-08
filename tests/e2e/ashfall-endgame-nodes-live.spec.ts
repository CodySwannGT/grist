/**
 * Ashfall endgame-nodes verification (UAT) suite — the manifest for #273. Proves,
 * empirically against the live built game, that the World Map's Act II endgame is
 * finishable start→ending again, after the regression where the reunion ("story") nodes
 * were inert (selecting one travelled to its already-cleared anchor region and showed that
 * region's stale `region-cleared` summary) and the finale read as unreachable:
 *
 * - [EVIDENCE: ashfall-endgame-nodes-live] on the turned World Map, selecting a reunion
 *   story-node by real keyboard enters that reunion's OWN recruit surface (the Reunion
 *   scene, NOT another region's cleared-summary screen), plays its beat, PERSISTS the
 *   `reunion:<id>` completion, lands back on the map; the finale (★ Aurel's Heart) is then
 *   selectable and enterable, plays a reachable ending, and completes to the terminal card
 *   / Title — i.e. the game is finishable again.
 *
 * The reunion recruit rules + the finale reachability/choice rules are proven exhaustively
 * + deterministically by the headless unit suites (`tests/logic/reunion-content.test.ts`,
 * `world-map-select.test.ts`, `endings.test.ts`, `finale-standing.test.ts`); this spec
 * proves the live scenes wire that model to the canvas, the real input path, and the
 * persisted save. The bridge reuses the dialogue seam the Dialogue/Finale scenes register.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;
/** The count of region rows before the reunion frontier (7 regions, catalog order). */
const REGION_ROWS = 7;

/** The dialogue snapshot the bridge exposes via `dialogue()`. */
interface DialogueSnapshot {
  readonly caption: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly choices: readonly { readonly id: string }[];
}

/** Wait until the running game reports the given scene key. */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/** Wait until the `__VERIFY__` bridge is installed with the dialogue + save entry points. */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.dialogue === "function" &&
            typeof window.__VERIFY__?.advanceDialogue === "function" &&
            typeof window.__VERIFY__?.loadSave === "function" &&
            typeof window.__VERIFY__?.save === "function"
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/** Focus the game canvas so real keyboard events reach Phaser. */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/** Press a key, then dwell so the next keystroke lands in its own tick. */
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

/** Read the live dialogue snapshot from the bridge. */
async function dialogue(page: Page): Promise<DialogueSnapshot | null> {
  return page.evaluate(() => window.__VERIFY__?.dialogue() ?? null);
}

/** Persist a fresh save with only the world turned to ashfall (the endgame board). */
async function seedAshfall(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const fresh = await window.__VERIFY__!.loadSave();
    await window.__VERIFY__!.save({
      ...fresh,
      worldState: "ashfall",
      scene: { sceneId: "seed", nodeId: "seed", flags: {} },
    });
  });
}

/** Poll until the presenter has mounted (a non-empty caption) on the active scene. */
async function waitForCaption(page: Page): Promise<string> {
  await expect
    .poll(async () => (await dialogue(page))?.caption ?? "", {
      timeout: SEEN_TIMEOUT,
    })
    .not.toBe("");
  return (await dialogue(page))?.caption ?? "";
}

/** Advance the presenter until the running scene is no longer `from` (or a guard trips). */
async function advanceUntilLeaves(page: Page, from: string): Promise<void> {
  for (let guard = 0; guard < 12; guard += 1) {
    if ((await page.evaluate(() => window.__VERIFY__?.scene())) !== from) {
      return;
    }
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await page.waitForTimeout(KEY_DWELL);
  }
}

test.describe("GRIST — Ashfall endgame nodes live (#273, UAT)", () => {
  test("[EVIDENCE: ashfall-endgame-nodes-live] a reunion node enters its own surface, recruits, and the finale then completes the game", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
    await seedAshfall(page);
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");

    // Select the first reunion story-node ("The Ghost in the Vault", the row after the 7
    // region rows) by real keyboard.
    await focusCanvas(page);
    for (let i = 0; i < REGION_ROWS; i += 1) {
      await press(page, "ArrowDown");
    }
    await press(page, "Enter");

    // It enters the reunion's OWN surface — NOT a region's cleared-summary screen.
    await waitForScene(page, "Reunion");
    const reunionCaption = await waitForCaption(page);
    expect(reunionCaption).toContain("Ghost in the Vault");

    // Play the recruit beat out; it lands the run back on the World Map.
    await advanceUntilLeaves(page, "Reunion");
    await waitForScene(page, "WorldMap");

    // The recruit PERSISTED (the `reunion:quietus` completion flag the finale standing counts).
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const save = await window.__VERIFY__!.loadSave();
            return save.scene?.flags?.["reunion:quietus"] ?? null;
          }),
        { timeout: SEEN_TIMEOUT }
      )
      .toBeTruthy();

    // The finale (★ Aurel's Heart) is the last row — one ArrowUp wraps the reset cursor to
    // it. It is selectable + enterable (the #273 "unreachable" symptom is gone).
    await focusCanvas(page);
    await press(page, "ArrowUp");
    await press(page, "Enter");
    await waitForScene(page, "Finale");
    await waitForCaption(page);

    // Confront Sallow → the ending fork → commit a reachable ending → play out to the Title.
    for (let guard = 0; guard < 20; guard += 1) {
      const snap = await dialogue(page);
      if (snap?.branching || snap?.done) {
        break;
      }
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
      await page.waitForTimeout(KEY_DWELL);
    }
    const fork = await dialogue(page);
    expect(fork?.branching).toBe(true);
    expect(fork?.choices.map(c => c.id)).toContain("sunder");

    await page.evaluate(() => window.__VERIFY__?.branchDialogue("sunder"));
    await page.waitForTimeout(KEY_DWELL);
    await advanceUntilLeaves(page, "Finale");
    await waitForScene(page, "Title");

    // The committed ending PERSISTED — the game finished to a real ending.
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const save = await window.__VERIFY__!.loadSave();
            return save.scene?.flags?.["finale:chosen-ending"] ?? null;
          }),
        { timeout: SEEN_TIMEOUT }
      )
      .toBe("sunder");
    expect(errors).toEqual([]);
  });
});
