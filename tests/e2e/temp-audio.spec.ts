/**
 * Temp-audio end-to-end verification (UAT) suite — the manifest for #115 (Story
 * #100, PD-3.9), PRD #42 Scope-IN "temp-but-intentional audio", FR11, and the
 * redundancy half of AC12. It proves, on the live production preview and driven
 * entirely through `window.__VERIFY__`, that the demo's audio hooks fire at their
 * moments and that no acceptance-relevant cue is conveyed by color or audio alone.
 *
 * Because a headless preview has no audio device, the proof is the deterministic
 * cue log the SoundService records (`__VERIFY__.audio()`) — "an agent heard it
 * fire" without a speaker — plus the redundant text/icon caption the same cue
 * drives (`__VERIFY__.audioCaption()`), captured as a canvas screenshot for visual
 * evidence.
 *
 *   AC-audio [choir]: `?scene=opening` starts the Choir leitmotif under the
 *     authored opening, logging the `choir` cue with its "♪ Choir leitmotif" caption.
 *   AC-audio [rendering + break]: in the default battle, a Render Craft logs the
 *     `rendering` stinger (the DoT lands), and a second Render drives the tanky
 *     render-construct past the Break threshold while alive, logging the `break`
 *     stinger — each with its redundant caption.
 *   AC-audio [grist-spend]: a funded bench sink (Runner's Reflex, −25) logs the
 *     `grist-spend` stinger with its "◆ Grist spent" caption.
 *   AC12 [redundancy]: every fired cue carries a non-null, non-color/non-audio
 *     text+icon caption. [EVIDENCE: temp-audio-cues-fire] [EVIDENCE: redundant-caption]
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** The fixed seed the opening + battle boot under (deterministic). */
const FIXED_SEED = 12345;
/** The bench wallet the grist-spend drawdown is funded with (above the cost). */
const BENCH_GRIST = 100;
/**
 * A single tanky enemy (the-ashling, 220 HP) booted via the `?encounter=` seam so a
 * Render lands + a second Render Breaks it while it is still alive — the low-HP
 * default-encounter enemies are one-shot by Wren's Craft.
 */
const TANKY_ENCOUNTER = "the-cage";
/** The-ashling is the lone enemy of `the-cage` — index 0. */
const TANKY_ENEMY = 0;

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
 * Attach console + page-error capture; the array stays empty across a clean run.
 * @param page - The Playwright page.
 * @returns The live error sink.
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

/** Read the SoundService cue log through the bridge. */
async function audioLog(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.__VERIFY__?.audio() ?? []);
}

/**
 * Cast a Render Craft from Wren (party 0) at an enemy. The bridge applies the
 * action immediately through the reducer (no ATB gate), so the Rendering status
 * lands at once; the scene's real-time mirror then observes the false→true status
 * edge on the next frame and fires the cue. (Deliberately NOT `advanceTurn` — that
 * fast-forwards ticks that would expire the DoT before a frame can observe it.)
 * @param page - The Playwright page.
 * @param enemyIndex - The target enemy index.
 */
async function castRender(page: Page, enemyIndex: number): Promise<void> {
  await page.evaluate(
    index =>
      window.__VERIFY__?.act({
        kind: "craft",
        id: "render",
        actor: { side: "party", index: 0 },
        target: { side: "enemies", index },
      }),
    enemyIndex
  );
}

/** Whether the given enemy is Broken. */
async function enemyBroken(page: Page, index: number): Promise<boolean> {
  return page.evaluate(
    i => window.__VERIFY__?.state()?.enemies[i]?.broken ?? false,
    index
  );
}

test.describe("Temp audio at its moments + redundancy (UAT, #115)", () => {
  test("[choir] the Choir leitmotif plays in the authored opening, with a redundant caption (AC12)", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?scene=opening&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Dialogue");

    // The leitmotif fires as its opening moment: the `choir` cue is logged and its
    // redundant, non-color/non-audio caption is present.
    await expect.poll(() => audioLog(page)).toContain("choir");
    const caption = await page.evaluate(
      () => window.__VERIFY__?.audioCaption() ?? null
    );
    expect(caption).toContain("Choir");

    await expect(page.locator("canvas")).toBeVisible();
    await page.locator("canvas").screenshot();
    expect(errors).toEqual([]);
  });

  test("[rendering + break] the Render + Break stingers fire at their combat moments, each with a caption (AC12)", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?uat=1&seed=${FIXED_SEED}&encounter=${TANKY_ENCOUNTER}`);
    await waitForScene(page, "Battle");

    // Render lands the Rendering DoT on the tanky construct → the `rendering`
    // stinger fires, and its redundant caption is present.
    await castRender(page, TANKY_ENEMY);
    await expect
      .poll(() => audioLog(page), { timeout: SEEN_TIMEOUT })
      .toContain("rendering");
    const renderCaption = await page.evaluate(
      () => window.__VERIFY__?.audioCaption() ?? null
    );
    expect(renderCaption).toContain("Rendering");

    // Further Renders drive it past the Break threshold (30 pressure per land) while
    // it is still alive (it survives several ~74-dmg Crafts of its 220 HP) → the
    // `break` stinger fires on the Break edge.
    for (
      let guard = 0;
      guard < 4 && !(await enemyBroken(page, TANKY_ENEMY));
      guard += 1
    ) {
      await castRender(page, TANKY_ENEMY);
    }
    await expect
      .poll(() => enemyBroken(page, TANKY_ENEMY), { timeout: SEEN_TIMEOUT })
      .toBe(true);
    await expect
      .poll(() => audioLog(page), { timeout: SEEN_TIMEOUT })
      .toContain("break");
    const breakCaption = await page.evaluate(
      () => window.__VERIFY__?.audioCaption() ?? null
    );
    expect(breakCaption).toContain("BREAK");

    await page.locator("canvas").screenshot();
    expect(errors).toEqual([]);
  });

  test("[grist-spend] a funded bench sink fires the grist-spend stinger with a redundant caption (AC12)", async ({
    page,
  }) => {
    const errors = captureErrors(page);

    await page.goto(`/?scene=bench&uat=1&grist=${BENCH_GRIST}`);
    await waitForScene(page, "Bench");

    // Spend grist on Runner's Reflex → the resonant `grist-spend` stinger fires and
    // its redundant caption is present.
    await page.evaluate(() => window.__VERIFY__?.buyRunnersReflex());
    await expect.poll(() => audioLog(page)).toContain("grist-spend");
    const caption = await page.evaluate(
      () => window.__VERIFY__?.audioCaption() ?? null
    );
    expect(caption).toContain("Grist");

    expect(errors).toEqual([]);
  });
});
