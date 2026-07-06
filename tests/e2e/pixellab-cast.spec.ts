/**
 * Bespoke PixelLab cast verification (UAT, #203) — the live-build proof that the
 * AI pixel-art battlers and portraits render end-to-end with no missing frames.
 *
 * The asset-coverage unit contract (`tests/logic/asset-coverage.test.ts`) proves
 * every DERIVED frame name resolves in the committed atlas; this spec proves the
 * running game actually REQUESTS and draws them. Phaser reports a missing/renamed
 * atlas frame as a console warning ("... has no frame ...") and a NineSlice/anim
 * misuse as an error — so a broken frame contract (a mis-named idle/attack/walk-5
 * cycle frame, a party `dead` pose, or a swapped portrait) surfaces here as a
 * captured console message, not a silent black square. Each test drives the real
 * seams that request the new frames (idle on build, attack pose on a strike, walk
 * bob + spirit float, downed pose on a kill, FX, the dialogue portrait) and then
 * asserts nothing complained.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;

/**
 * The console messages a broken frame/anim contract surfaces — Phaser's
 * missing-frame warning and the missing-animation error — matched narrowly so
 * benign WebGL/browser "texture" noise never flakes the gate. Any `pageerror`
 * (a real thrown exception) is always a fault regardless of text.
 */
const FRAME_FAULT =
  /has no frame|frame missing|not found in texture|missing animation|__missing/i;

/**
 * Subscribe to the page's console + error channels, returning the mutable sink of
 * every frame/anim fault (empty at the end = the cast rendered clean): a matching
 * console error/warning, or ANY page exception.
 * @param page - The Playwright page.
 * @returns The array that accumulates fault messages.
 */
function trackFrameFaults(page: Page): string[] {
  const faults: string[] = [];
  page.on("console", message => {
    const type = message.type();
    const text = message.text();
    if ((type === "error" || type === "warning") && FRAME_FAULT.test(text)) {
      faults.push(`${type}: ${text}`);
    }
  });
  page.on("pageerror", error => faults.push(`pageerror: ${error.message}`));
  return faults;
}

/**
 * Wait until the running game reports the given scene key on the bridge.
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
 * Drive the launched battle to a terminal outcome (won/lost), which requests the
 * attack poses, walk cycles, downed poses, and FX of every combatant on screen.
 * @param page - The Playwright page.
 * @returns The terminal phase reached.
 */
async function playToEnd(page: Page): Promise<string> {
  return page.evaluate(() => window.__VERIFY__?.autoWin(200) ?? "");
}

test.describe("GRIST — bespoke PixelLab cast verification (UAT, #203)", () => {
  test("[pixellab-cast-renders-clean] the default battle plays a full fight requesting the new cast's frames with none missing", async ({
    page,
  }) => {
    const faults = trackFrameFaults(page);
    await page.goto(`/?uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Battle");
    // The bespoke cast is wired: both sides field combatants with content refs.
    const state = await page.evaluate(() => window.__VERIFY__?.state() ?? null);
    expect(state?.party.length ?? 0).toBeGreaterThan(0);
    expect(state?.enemies.length ?? 0).toBeGreaterThan(0);
    expect(state?.party.every(unit => unit.ref.length > 0)).toBe(true);
    // Play the whole fight — idle/attack/walk/downed poses + FX all get drawn.
    const outcome = await playToEnd(page);
    expect(["won", "lost"]).toContain(outcome);
    expect(faults).toEqual([]);
  });

  test("[pixellab-cast-spirit-floats-clean] a spirit encounter (the-ashling) builds its float and downs it with no missing frames", async ({
    page,
  }) => {
    const faults = trackFrameFaults(page);
    // `the-cage` fields the-ashling — a spirit-hover ref: its hover tween builds on
    // spawn and is settled again when it is downed. Both paths must draw clean.
    await page.goto(`/?uat=1&seed=${FIXED_SEED}&encounter=the-cage`);
    await waitForScene(page, "Battle");
    const state = await page.evaluate(() => window.__VERIFY__?.state() ?? null);
    expect(state?.enemies.some(unit => unit.ref === "the-ashling")).toBe(true);
    const outcome = await playToEnd(page);
    expect(["won", "lost"]).toContain(outcome);
    expect(faults).toEqual([]);
  });

  test("[pixellab-portrait-renders-clean] the dialogue portrait slot draws the bespoke bust with no missing frame", async ({
    page,
  }) => {
    const faults = trackFrameFaults(page);
    await page.goto("/?uat=1&scene=dialogue");
    await waitForScene(page, "Dialogue");
    // The presenter shows the speaker's PixelLab portrait in the 38px slot; a
    // swapped/renamed portrait frame would surface as a frame fault here.
    const speaker = await page.evaluate(
      () => window.__VERIFY__?.dialogue()?.speaker ?? ""
    );
    expect(speaker.length).toBeGreaterThan(0);
    expect(faults).toEqual([]);
  });
});
