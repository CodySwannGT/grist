/**
 * Reckoning travel set-piece verification (UAT) suite — the manifest for #251. Proves,
 * empirically against the live built game, that selecting **The Reckoning** on the World Map
 * — previously a silent map re-skin (the header flipped REACH → ASHFALL with no cutscene) —
 * now PLAYS the authored world-turn set-piece (#125) before the world transforms:
 *
 * - [EVIDENCE: reckoning-travel-setpiece] on a qualifying run (upper Vanta finished, so the
 *   keystone hook is available), selecting The Reckoning by real keyboard enters the Reckoning
 *   scene; the authored set-piece PLAYS (its presenter nodes advance through Sallow's overload
 *   → the world turning → the scatter → the hard cut); the world-state flip COMMITS EXACTLY
 *   ONCE at its authored world-turns beat; and the run lands back on the now-transformed
 *   Ashfall World Map — where the Reckoning hook is gone, so the set-piece can never REPLAY.
 *
 * The world-turn transform (the pure `reckon` flip, party scatter, Sable lost, color drain)
 * is proven exhaustively + deterministically by the headless suites (`tests/logic/
 * reckoning.test.ts`, `world-state.test.ts`); this spec proves the live World Map wires the
 * authored set-piece to the canvas, the real input path, and the single persisted flip. The
 * bridge reuses the dialogue seam (`__VERIFY__.dialogue()` / `advanceDialogue()`), the same
 * one the Dialogue and Finale scenes register.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;

/** The dialogue snapshot the bridge exposes via `dialogue()`. */
interface DialogueSnapshot {
  readonly caption: string;
  readonly done: boolean;
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
 * Wait until the `__VERIFY__` bridge is installed with the dialogue + save + surface seams.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.dialogue === "function" &&
            typeof window.__VERIFY__?.advanceDialogue === "function" &&
            typeof window.__VERIFY__?.worldMapSurface === "function" &&
            typeof window.__VERIFY__?.loadSave === "function" &&
            typeof window.__VERIFY__?.save === "function"
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

/** Read the live dialogue snapshot from the bridge. */
async function dialogue(page: Page): Promise<DialogueSnapshot | null> {
  return page.evaluate(() => {
    const model = window.__VERIFY__?.dialogue();
    return model ? { caption: model.caption, done: model.done } : null;
  });
}

/** Read the persisted world-state (the single flip the set-piece commits). */
async function persistedWorldState(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const save = await window.__VERIFY__!.loadSave();
    return save.worldState;
  });
}

/** Read the live world-map surface projection from the persisted save. */
async function surface(page: Page): Promise<{
  worldState: string;
  reckoning: { readonly available: boolean } | null;
}> {
  return page.evaluate(async () => {
    await window.__VERIFY__!.loadSave();
    const s = window.__VERIFY__!.worldMapSurface().surface;
    return { worldState: s.worldState, reckoning: s.reckoning };
  });
}

/**
 * Seed a qualifying Act I run: still in `reach`, with upper Vanta's playlist finished so the
 * Reckoning keystone hook is available on the World Map.
 * @param page - The Playwright page.
 */
async function seedQualifyingRun(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const fresh = await window.__VERIFY__!.loadSave();
    await window.__VERIFY__!.save({
      ...fresh,
      worldState: "reach",
      scene: {
        sceneId: "seed",
        nodeId: "seed",
        flags: {
          "region:upper-vanta:cleared": 99,
          "region:upper-vanta:done": true,
        },
      },
    });
  });
}

test.describe("GRIST — Reckoning travel set-piece (#251, UAT)", () => {
  test("[EVIDENCE: reckoning-travel-setpiece] the World Map plays the authored world-turn set-piece, commits the flip once, and lands on the Ashfall map with no replay", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
    await seedQualifyingRun(page);
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");

    // The qualifying run surfaces the Reckoning hook as available, still in `reach`.
    const before = await surface(page);
    expect(before.worldState).toBe("reach");
    expect(before.reckoning?.available).toBe(true);

    // Select The Reckoning by real keyboard. Entry order in `reach` is
    // [regions…, Reckoning, ★ Aurel's Heart]; the cursor wraps, so from row 0 one
    // ArrowUp lands the finale (last) and a second lands the Reckoning (second-to-last).
    await focusCanvas(page);
    await press(page, "ArrowUp");
    await press(page, "ArrowUp");
    await press(page, "Enter");
    await waitForScene(page, "Reckoning");

    // The authored set-piece PLAYS: wait for the presenter to mount (a non-empty caption),
    // then advance, asserting the nodes actually advance (distinct captions) and that the
    // world has NOT yet turned before its authored beat.
    await expect
      .poll(async () => (await dialogue(page))?.caption ?? "", {
        timeout: SEEN_TIMEOUT,
      })
      .not.toBe("");
    expect(await persistedWorldState(page)).toBe("reach");

    const captions = new Set<string>();
    let turnedDuringPlay = false;
    for (let guard = 0; guard < 20; guard += 1) {
      const snap = await dialogue(page);
      if (snap === null) {
        break;
      }
      captions.add(snap.caption);
      if ((await persistedWorldState(page)) === "ashfall") {
        turnedDuringPlay = true;
      }
      if (snap.done) {
        break;
      }
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
      await page.waitForTimeout(KEY_DWELL);
    }
    // The set-piece is a multi-beat played scene, not a single silent flip.
    expect(captions.size).toBeGreaterThanOrEqual(3);
    // The flip committed AT its authored world-turns beat — during the played scene.
    expect(turnedDuringPlay).toBe(true);

    // Advancing past the terminal hard cut lands the run back on the transformed World Map.
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await waitForScene(page, "WorldMap");

    // The world turned exactly once and the map now reads Ashfall; the Reckoning hook is
    // GONE (projected to null once turned), so the set-piece can never replay.
    const after = await surface(page);
    expect(after.worldState).toBe("ashfall");
    expect(after.reckoning).toBeNull();
    expect(await persistedWorldState(page)).toBe("ashfall");

    expect(errors).toEqual([]);
  });
});
