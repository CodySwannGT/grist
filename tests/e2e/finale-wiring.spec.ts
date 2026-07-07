/**
 * Finale wiring verification (UAT) suite — the manifest for #244. Proves, empirically
 * against the live built game, that the World Map's ★ Aurel's Heart node — previously
 * inert ("the finale awaits" but Enter/click were a no-op) — now enters the finale flow
 * (#142's endings machinery), plays a standing-gated ending path, commits it, and lands
 * the run somewhere final, with a self-explaining locked state when it is not yet open:
 *
 * - [EVIDENCE: finale-gated-explains-itself] booted before the world has turned, the
 *   finale states its prerequisite ("your standing does not yet reach Aurel's heart …")
 *   through the real presenter rather than silently doing nothing, and still lands on the
 *   Title (no dead end).
 * - [EVIDENCE: finale-enter-play-commit-exit] on the turned World Map, selecting ★ Aurel's
 *   Heart by real keyboard enters the Finale scene, confronts Sallow with the Choir's Song
 *   whole, plays a reachable ending, PERSISTS the committed ending, and exits to the Title.
 * - [EVIDENCE: finale-diverges-by-standing] which endings the fork offers diverges by the
 *   run's accumulated standing — a neutral run is offered only "Finish the Sundering"; a
 *   merciful, fully-gathered run is offered all four (incl. the reunion-gated ends).
 *
 * The reachability + choice rules are proven exhaustively + deterministically by the
 * headless unit suites (`tests/logic/endings.test.ts`, `finale-standing.test.ts`,
 * `finale-content.test.ts`); this spec proves the live scene wires that model to the
 * canvas, the real input path, and the persisted save. The bridge reuses the dialogue
 * seam (`__VERIFY__.dialogue()` / `advanceDialogue()` / `branchDialogue()`), the same one
 * the Dialogue scene registers.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;

/** The dialogue snapshot the bridge exposes via `dialogue()`. */
interface DialogueSnapshot {
  readonly scene: string;
  readonly caption: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly choices: readonly { readonly id: string; readonly label: string }[];
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
 * Wait until the `__VERIFY__` bridge is installed with the dialogue + save entry points.
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
            typeof window.__VERIFY__?.branchDialogue === "function" &&
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
  return page.evaluate(() => window.__VERIFY__?.dialogue() ?? null);
}

/**
 * Persist a save with the world turned to ashfall plus an optional standing (moral ledger
 * + completed-reunion flags), the setup a run would accumulate before the finale.
 * @param page - The Playwright page.
 * @param standing - The karma/wield ledger and how many reunions to mark completed.
 */
async function seedAshfallStanding(
  page: Page,
  standing: { karma: number; wieldChoices: number; reunions: number }
): Promise<void> {
  await page.evaluate(async input => {
    const fresh = await window.__VERIFY__!.loadSave();
    const reunionFlags: Record<string, boolean> = {};
    for (let i = 0; i < input.reunions; i += 1) {
      reunionFlags[`reunion:seed-${i}`] = true;
    }
    await window.__VERIFY__!.save({
      ...fresh,
      worldState: "ashfall",
      moralLedger: {
        karma: input.karma,
        freeChoices: Math.max(input.karma, 0),
        wieldChoices: input.wieldChoices,
      },
      scene: { sceneId: "seed", nodeId: "seed", flags: reunionFlags },
    });
  }, standing);
}

/**
 * From the World Map, select the finale entry (the last row — one ArrowUp from the initial
 * cursor wraps to it, count-independent) and wait for the Finale scene.
 * @param page - The Playwright page.
 */
async function enterFinaleFromMap(page: Page): Promise<void> {
  await focusCanvas(page);
  await press(page, "ArrowUp"); // wrap the cursor to the last row: ★ Aurel's Heart
  await press(page, "Enter");
  await waitForScene(page, "Finale");
  // The Finale scene loads the save asynchronously — wait for the presenter to mount
  // (a non-empty confrontation caption) before driving it.
  await expect
    .poll(async () => (await dialogue(page))?.caption ?? "", {
      timeout: SEEN_TIMEOUT,
    })
    .not.toBe("");
}

/** Advance the finale presenter until it reaches the ending fork (or ends). */
async function advanceToFork(page: Page): Promise<DialogueSnapshot | null> {
  for (let guard = 0; guard < 20; guard += 1) {
    const snap = await dialogue(page);
    if (snap === null || snap.branching || snap.done) {
      return snap;
    }
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await page.waitForTimeout(KEY_DWELL);
  }
  return dialogue(page);
}

test.describe("GRIST — finale wiring (#244, UAT)", () => {
  test("[EVIDENCE: finale-gated-explains-itself] the finale states its prerequisite before the world turns, then lands on the Title", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/?scene=finale&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave()); // fresh Act I `reach`
    await page.goto("/?scene=finale&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "Finale");

    // The sealed read explains itself through the real presenter — not a silent no-op.
    // Poll until the presenter has mounted (the scene loads the save asynchronously).
    await expect
      .poll(
        async () => {
          const snap = await dialogue(page);
          return { caption: snap?.caption ?? "", branching: snap?.branching };
        },
        { timeout: SEEN_TIMEOUT }
      )
      .toEqual({
        caption: expect.stringContaining("does not yet reach"),
        branching: false,
      });

    // Advancing off the sealed beat lands the run on the Title (no dead end).
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await waitForScene(page, "Title");
    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: finale-enter-play-commit-exit] the turned map enters the finale, plays an ending, persists it, and exits to the Title", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
    // A neutral, turned world: only the always-available "Finish the Sundering" is offered.
    await seedAshfallStanding(page, { karma: 0, wieldChoices: 0, reunions: 0 });
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");

    await enterFinaleFromMap(page);

    // Confront Sallow → the Choir's Song whole → the ending fork with a single reachable end.
    const fork = await advanceToFork(page);
    expect(fork?.branching).toBe(true);
    expect(fork?.choices.map(c => c.id)).toEqual(["sunder"]);

    // Commit the ending; play its epilogue + the THE GRIST card out to the Title.
    await page.evaluate(() => window.__VERIFY__?.branchDialogue("sunder"));
    await page.waitForTimeout(KEY_DWELL);
    for (let guard = 0; guard < 6; guard += 1) {
      if ((await page.evaluate(() => window.__VERIFY__?.scene())) === "Title") {
        break;
      }
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
      await page.waitForTimeout(KEY_DWELL);
    }
    await waitForScene(page, "Title");

    // The committed ending PERSISTED to the save (#142's choice folded through).
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

  test("[EVIDENCE: finale-diverges-by-standing] a merciful, fully-gathered run is offered every ending the neutral run is not", async ({
    page,
  }) => {
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await page.evaluate(() => window.__VERIFY__?.clearSave());
    // A near-pure Free run that reassembled the party: karma ≥3, zero Wield, ≥3 reunions —
    // the standing that unlocks all four ends (incl. the hardest, "Let It Die").
    await seedAshfallStanding(page, { karma: 3, wieldChoices: 0, reunions: 3 });
    await page.goto("/?scene=worldmap&uat=1");
    await waitForBridge(page);
    await waitForScene(page, "WorldMap");

    await enterFinaleFromMap(page);
    const fork = await advanceToFork(page);
    const ids = fork?.choices.map(c => c.id) ?? [];
    // Diverges from the neutral single-choice fork: every ending is on the table here.
    expect(ids).toEqual(["sunder", "wake", "third-way", "let-die"]);
  });
});
