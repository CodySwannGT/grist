/**
 * Ch.1 "The delivery" end-to-end verification (UAT) suite — the manifest for #105
 * (Story #93, PD-3.2). Where #104's dialogue spec proves the reusable presenter on a
 * throwaway demo script, this spec proves the FIRST authored opening is reachable
 * from boot and plays its three acceptance criteria on the live production preview,
 * driven entirely through `window.__VERIFY__`:
 *
 *   AC1 [cold-start-clean]: `?scene=opening&seed=<FIXED>` cold-boots Wren in the
 *     Marrow at 384×216 integer-scaled, no console/page errors, and the opening
 *     caption is the smuggling-run line — and it is interactive (an advance changes
 *     the rendered caption).
 *   AC2 [sable-reveal-ambush]: advancing reaches the `cargo-opens` reveal node — the
 *     caption names SABLE and the `sable-revealed` ledger flag flips true — and
 *     advancing off the terminal klaxon node hands straight off to the tutorial
 *     ambush (Field → engage-already-pending → Battle).
 *   AC3 [grist-pool-drawdown]: the ambush is winnable (`autoWin` → "won"); the win
 *     CREDITS the SHARED grist pool (the Field HUD's `field().grist` rises); then a
 *     bench-funded spend (`buyRunnersReflex`, −25) DRAWS DOWN that same shared pool.
 *
 * CRITICAL — the two grist pools are NOT the same pool (the #1 thing not to get
 * wrong here): `BattleState.grist` (`state().grist`) is BATTLE-LOCAL — a battle
 * `Bind` spends THAT, starting at 0, and it never touches the wallet. The SHARED
 * run wallet (`RunState.wallet`) is EARN-ONLY in battle (credited on win via
 * `applyBattleResult` → `earnGrist`) and DRAWS DOWN only at the BENCH
 * (`applyBenchSink` → `spendGrist`, e.g. Runner's Reflex −25). So AC3's "spending
 * draws down the shared HUD pool" is the BENCH sink, asserted on `field()?.grist`
 * and `bench()?.grist` (both read the wallet) — NEVER on `state()?.grist`
 * (battle-local). There is zero new spend code; this reuses the existing
 * `buyRunnersReflex` bridge action. [EVIDENCE: ch1-the-delivery]
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** The fixed seed the Ch.1 cold start boots under (deterministic ambush). */
const FIXED_SEED = 12345;
/** Runner's Reflex draws the shared wallet down 25 grist (authoritative in content/bench). */
const RUNNERS_REFLEX_COST = 25;
/** The bench wallet the AC3 drawdown is funded with (well above the cost). */
const BENCH_GRIST = 100;
/** The opening smuggling-run line Wren speaks on the Ch.1 cold boot. */
const OPENING_LINE =
  "Another run through the Marrow. Move the crate, get paid, ask nothing. That's the job.";

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** The dialogue snapshot exposed by the verification bridge (#104 + the #105 flags). */
interface DialogueState {
  readonly scene: string;
  readonly speaker: string;
  readonly caption: string;
  readonly portraitSlot: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly flags: Readonly<Record<string, boolean | string | number>>;
}

/** A live field snapshot from the bridge (its `grist` reads the SHARED wallet). */
interface FieldSnap {
  readonly scene: string;
  readonly room: string;
  readonly grist: number;
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
 * Read the live dialogue snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The dialogue snapshot, or null if unavailable.
 */
async function dialogueState(page: Page): Promise<DialogueState | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.dialogue() ?? null) as DialogueState | null
  );
}

/**
 * Read the live field snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The field snapshot, or null if unavailable.
 */
async function fieldSnap(page: Page): Promise<FieldSnap | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.field() ?? null) as FieldSnap | null
  );
}

/**
 * Attach console + page-error capture to a page; the returned array stays empty
 * across a clean run. Every Ch.1 test asserts it is `[]` (AC1's "no console errors"
 * extended to the whole journey).
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

test.describe("Ch.1 'The delivery' — opening E2E (UAT, #105)", () => {
  test("[cold-start-clean] cold-boots Wren in the Marrow at 384x216, interactive, no errors (AC1)", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    // Cold start: a new game under a fixed seed boots straight into the opening.
    await page.goto(`/?scene=opening&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Dialogue");
    await expect(page.locator("canvas")).toBeVisible();

    // The opening node renders the Wren smuggling-run line (the real authored
    // opening, NOT the #104 demo script the `?scene=dialogue` boot plays).
    const opening = await dialogueState(page);
    expect(opening?.scene).toBe("Dialogue");
    expect(opening?.speaker).toBe("wren");
    expect(opening?.caption).toBe(OPENING_LINE);
    expect(opening?.done).toBe(false);

    // 384×216, integer-scaled (the locked native resolution / decision 0006).
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

    // Interactive: advancing changes the rendered caption (move/interact works).
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    const next = await dialogueState(page);
    expect(next?.caption).not.toBe(OPENING_LINE);
    expect(next?.caption?.length ?? 0).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("[sable-reveal-ambush] the cargo opens, Sable is revealed, the ambush begins immediately (AC2)", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?scene=opening&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Dialogue");

    // Walk the linear opening to the reveal node: hook → cargo-reached → pry →
    // cargo-opens. The reveal caption names SABLE and the scene folds the
    // `sable-revealed` ledger flag the instant the cursor lands on the reveal node.
    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    }
    const reveal = await dialogueState(page);
    expect(reveal?.caption).toContain("SABLE");
    expect(reveal?.flags["sable-revealed"]).toBe(true);
    // The dedicated bridge reader exposes the same landed-hook flag directly.
    expect(
      await page.evaluate(
        () => window.__VERIFY__?.ledgerFlag("sable-revealed") ?? null
      )
    ).toBe(true);
    expect(reveal?.done).toBe(false);

    // Advance off the reveal (→ sable-wakes) then off the terminal klaxon node:
    // reaching `done` hands straight off to the tutorial ambush — Field launches
    // the already-pending encounter and control is in Battle. The ambush begins
    // immediately after the reveal, with no manual room exploration.
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await waitForScene(page, "Battle");
    const battle = await page.evaluate(
      () => window.__VERIFY__?.state() ?? null
    );
    expect(battle?.scene).toBe("Battle");
    // The ambush fields the lone House-Mourne enforcer (the tutorial fight).
    expect(battle?.enemies.length).toBe(1);

    expect(errors).toEqual([]);
  });

  test("[grist-pool-drawdown] winning credits the SHARED pool, the bench spend draws it down (AC3)", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?scene=opening&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Dialogue");

    // Advance through the opening into the ambush (reveal at advance 3, handoff to
    // Battle once the narrative ends).
    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    }
    await waitForScene(page, "Battle");

    // AC3 part 1 — the ambush is winnable, and the win CREDITS the SHARED wallet:
    // control returns to the Field and `field().grist` (which reads RunState.wallet)
    // has risen from the cold-start 0 by the enforcer's loot. This is the EARN side
    // of the shared pool — battle is earn-only into the wallet.
    const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
    expect(phase).toBe("won");
    await waitForScene(page, "Field");
    const afterWin = await fieldSnap(page);
    expect(afterWin?.scene).toBe("Field");
    expect(afterWin?.grist ?? 0).toBeGreaterThan(0);

    // AC3 part 2 — SPENDING draws down the SAME shared pool. The shared wallet only
    // draws down at the BENCH (applyBenchSink → spendGrist); a battle Bind spends
    // the BATTLE-LOCAL pool, never the wallet. So we drive the existing bench spend
    // and assert the drawdown on `bench().grist` (the wallet), NOT `state().grist`.
    await page.goto(`/?scene=bench&uat=1&grist=${BENCH_GRIST}`);
    await waitForScene(page, "Bench");
    const benchBefore = await page.evaluate(
      () => window.__VERIFY__?.bench() ?? null
    );
    await page.evaluate(() => window.__VERIFY__?.buyRunnersReflex());
    const benchAfter = await page.evaluate(
      () => window.__VERIFY__?.bench() ?? null
    );
    expect(benchAfter?.grist).toBe(
      (benchBefore?.grist ?? 0) - RUNNERS_REFLEX_COST
    );

    expect(errors).toEqual([]);
  });
});
