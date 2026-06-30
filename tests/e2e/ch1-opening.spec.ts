/**
 * Ch.1 "The delivery" OPENING verification (UAT) suite — the manifest for sub-task
 * #105 (Story #93, PD-3.2). Boots the cold-start opening directly via
 * `?scene=opening` and drives it through the in-game `window.__VERIFY__` bridge to
 * prove, empirically against the live canvas, all three acceptance criteria:
 *
 * - [ch1-logic-suite] the deterministic `tests/logic` lane (ch1-content +
 *   ch1-opening) asserts the tutorial-ambush EncounterDef shape/values and the Ch.1
 *   scene/flag data shape; this e2e is its on-canvas counterpart. Run by
 *   `bun run test` — referenced here so the evidence manifest is complete.
 * - [cold-start-clean] AC1: a new game boots into the Marrow at 384×216
 *   integer-scaled, with no console errors, and Wren can move/interact.
 * - [sable-reveal-ambush] AC2: advancing reaches the drop, the cargo opens to
 *   reveal Sable (the `sable-revealed` flag folds), and the ambush begins
 *   immediately after (the Battle scene takes over) — observed on the live canvas.
 * - [grist-pool-drawdown] AC3: the ambush is won via the action menu, then a grist
 *   spend draws down the SHARED HUD pool by exactly the spend (a before/after delta
 *   on the same run-state wallet the win credited — never a battle-local copy).
 *
 * Every action is routed through the same semantic bus path live input uses, so a
 * bridge-driven change is end-to-end proof. The default Battle boot is left intact,
 * so the existing battle/field/dialogue/slice specs stay green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
const FIXED_SEED = 12345;
/** Funds the shared wallet at boot so the AC3 bench spend is affordable in one page. */
const SEED_GRIST = 100;
/** Runner's Reflex bench-sink cost — the exact draw-down AC3 asserts (content/bench). */
const RUNNERS_REFLEX_COST = 25;
/** house-enforcer loot the ambush win credits to the shared wallet (content/enemies). */
const AMBUSH_LOOT = 4;

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** Wren's logical position in the opening snapshot. */
interface OpeningPosition {
  readonly x: number;
  readonly y: number;
}

/** The Ch.1 opening snapshot exposed by the verification bridge. */
interface OpeningState {
  readonly scene: string;
  readonly wren: OpeningPosition;
  readonly speaker: string;
  readonly caption: string;
  readonly sableRevealed: boolean;
  readonly done: boolean;
  readonly grist: number;
}

/** Attach console + pageerror capture; returns the live error sink. */
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
 * Boot the cold-start opening at a fixed seed + a funded wallet, with the bridge
 * enabled. The `?scene=opening` query makes the Preloader start Opening instead of
 * the default Battle.
 * @param page - The Playwright page.
 */
async function bootOpening(page: Page): Promise<void> {
  await page.goto(
    `/?scene=opening&uat=1&seed=${FIXED_SEED}&grist=${SEED_GRIST}`
  );
  await waitForScene(page, "Opening");
}

/** Read the live Ch.1 opening snapshot from the bridge. */
async function openingState(page: Page): Promise<OpeningState | null> {
  return page.evaluate(() => window.__VERIFY__?.opening() ?? null);
}

/**
 * Advance the opening dialogue until the Sable reveal folds, the narrative ends, or
 * a hard step cap is hit (guards against a runaway). Returns the last snapshot.
 * @param page - The Playwright page.
 */
async function advanceToReveal(page: Page): Promise<OpeningState | null> {
  let snap = await openingState(page);
  for (let step = 0; step < 20 && snap && !snap.sableRevealed; step += 1) {
    await page.evaluate(() => window.__VERIFY__?.advanceOpening());
    snap = await openingState(page);
  }
  return snap;
}

test.describe("GRIST — Ch.1 'The delivery' opening verification (UAT)", () => {
  test("[cold-start-clean] AC1: boots into the Marrow at 384x216, integer-scaled, no errors, can move", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await bootOpening(page);
    await expect(page.locator("canvas")).toBeVisible();

    // The opening renders Wren in the Marrow with the hook line on screen.
    const snap = await openingState(page);
    expect(snap?.scene).toBe("Opening");
    expect(snap?.speaker).toBe("wren");
    expect(snap?.caption.length ?? 0).toBeGreaterThan(0);
    expect(snap?.sableRevealed).toBe(false);

    // Native 384x216 at an integer zoom (decision 0006, V2).
    const resolution = (await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    )) as Resolution | null | undefined;
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(resolution?.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);

    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });

    // Wren can MOVE: hold a movement key and assert her logical position changes.
    const before = snap?.wren ?? { x: 0, y: 0 };
    await page.locator("canvas").click();
    await page.keyboard.down("KeyD");
    await expect
      .poll(async () => (await openingState(page))?.wren.x ?? before.x, {
        timeout: SEEN_TIMEOUT,
      })
      .toBeGreaterThan(before.x);
    await page.keyboard.up("KeyD");

    expect(errors).toEqual([]);
  });

  test("[sable-reveal-ambush] AC2: reaching the drop reveals Sable, then the ambush begins", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await bootOpening(page);

    // Drive the cold-start dialogue to the cargo-opens reveal beat: the flag folds.
    const revealed = await advanceToReveal(page);
    expect(revealed?.sableRevealed).toBe(true);
    // The reveal beat names Sable (the cargo is a person) — the hook landing.
    expect(revealed?.caption.toLowerCase()).toContain("sable");

    // Continue past the reveal → Sable stirs → the klaxon: the narrative ends and
    // the opening hands off to the tutorial ambush, which takes over the canvas.
    for (let step = 0; step < 20; step += 1) {
      const snap = await openingState(page);
      if (!snap || snap.done) {
        break;
      }
      await page.evaluate(() => window.__VERIFY__?.advanceOpening());
    }
    // The ambush begins immediately after — the Battle scene is now live, running
    // the single-enemy tutorial ambush (the drop-goes-wrong fight).
    await waitForScene(page, "Battle");
    const enemies = await page.evaluate(
      () => window.__VERIFY__?.state()?.enemies.map(enemy => enemy.ref) ?? []
    );
    expect(enemies).toEqual(["house-enforcer"]);

    // Determinism: the launched ambush exposes a stable state hash (DoD play-through).
    const hash = await page.evaluate(() => window.__VERIFY__?.hash() ?? "");
    expect(hash.length).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("[grist-pool-drawdown] AC3: win the ambush, then a grist spend draws down the shared HUD pool", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await bootOpening(page);

    // Walk the opening to its end so the tutorial ambush launches.
    await advanceToReveal(page);
    for (let step = 0; step < 20; step += 1) {
      const snap = await openingState(page);
      if (!snap || snap.done) {
        break;
      }
      await page.evaluate(() => window.__VERIFY__?.advanceOpening());
    }
    await waitForScene(page, "Battle");

    // Win the ambush via the action menu (the deterministic autoWin policy: the
    // same Strike/Craft path the menu drives); control returns to the Field.
    const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
    expect(phase).toBe("won");
    await waitForScene(page, "Field");

    // The win credited the ambush loot to the SHARED run-state wallet: the funded
    // 100 + the house-enforcer's 4 loot = 104 on the Field's shared pool.
    const fieldGrist = await page.evaluate(
      () => window.__VERIFY__?.field()?.grist ?? -1
    );
    expect(fieldGrist).toBe(SEED_GRIST + AMBUSH_LOOT);

    // Move to the growth screen in the SAME page session and spend grist on a sink:
    // the Bench reads the very same registry wallet, so the spend draws down the
    // SAME shared pool the ambush credited — provable as an exact before/after delta.
    await page.evaluate(() => window.__VERIFY__?.growAtBench());
    await waitForScene(page, "Bench");

    const beforeSpend = await page.evaluate(
      () => window.__VERIFY__?.bench()?.grist ?? -1
    );
    expect(beforeSpend).toBe(SEED_GRIST + AMBUSH_LOOT);

    await page.evaluate(() => window.__VERIFY__?.buyRunnersReflex());
    const afterSpend = await page.evaluate(
      () => window.__VERIFY__?.bench()?.grist ?? -1
    );
    // The shared HUD pool drew down by EXACTLY the sink cost — the spend half of AC3.
    expect(afterSpend).toBe(beforeSpend - RUNNERS_REFLEX_COST);

    expect(errors).toEqual([]);
  });
});
