/**
 * Demo-polish end-to-end verification (UAT) suite — the manifest for PD-3.9 / #114
 * ("desaturation/grist-gold palette pass + readable scene transitions + the Sable-
 * reveal quiet beat"). Where the unit suites prove the pure palette/transition/beat
 * logic headless, this spec proves the pass is REAL on the live production preview,
 * driven through `window.__VERIFY__` — the three acceptance criteria as observable
 * behavior at 384×216 (decision 0006), with no console/page errors:
 *
 *   AC1 [palette-grist-gold]: the Marrow field cold-boots at the integer-scaled
 *     384×216 baseline, interactive and error-free, and a committed frame shows the
 *     desaturated structural tones lit by the grist-gold HUD/interactable accents.
 *     [EVIDENCE: palette-before-after]
 *   AC2 [readable-transition]: a Field→Battle→Field round trip (engage → autoWin →
 *     return) completes across the readable fade cut and the render resolution is
 *     preserved through the transition (the fade never changes the 384×216 baseline).
 *     [EVIDENCE: scene-transition]
 *   AC3 [sable-reveal-beat]: advancing the Ch.1 opening reaches the `cargo-opens`
 *     reveal (the caption names SABLE, the `sable-revealed` flag flips), the reveal
 *     holds its deliberate quiet beat, and the narrative still hands off to the
 *     tutorial ambush after the beat. [EVIDENCE: sable-reveal-beat]
 *
 * These reuse the existing bridge seams (`scene`, `resolution`, `field`, `dialogue`,
 * `advanceDialogue`, `engage`, `autoWin`) — zero new production wiring is added for
 * the test. The palette/beat changes must not regress the reachability or the
 * 384×216 baseline the earlier specs lock.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** The fixed seed these deterministic checks boot under. */
const FIXED_SEED = 0x1234;
/** The native (internal) render resolution locked by decision 0006. */
const BASE_WIDTH = 384;
const BASE_HEIGHT = 216;
/** The Ch.1 reveal node id and the ledger flag it folds (authoritative in content/scenes/ch1). */
const REVEAL_NODE_CAPTION_TOKEN = "SABLE";
const SABLE_REVEALED_FLAG = "sable-revealed";

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** The deterministic beat hold seeded on the reveal (authoritative in content/scenes/ch1). */
const REVEAL_BEAT_MS = 900;
/** The canonical grist-gold highlight (authoritative in logic/render/palette). */
const GRIST_GOLD = 0xffd166;
/** The readable-fade ceiling AC2 is held to (authoritative in logic/render/transition). */
const TRANSITION_MAX_MS = 1200;

/** The resolved-palette snapshot exposed by the render verification seam (#114 AC1). */
interface PaletteSnap {
  readonly highlight: number;
  readonly base: number;
  readonly floor: number;
  readonly wall: number;
  readonly baseChroma: number;
  readonly highlightChroma: number;
}

/** One sampled transition frame (#114 AC2). */
interface TransitionFrame {
  readonly phase: string;
  readonly opacity: number;
}

/** The transition-trajectory snapshot exposed by the render verification seam (#114 AC2). */
interface TransitionSnap {
  readonly totalMs: number;
  readonly frames: readonly TransitionFrame[];
}

/** The dialogue snapshot exposed by the verification bridge. */
interface DialogueSnap {
  readonly caption: string;
  readonly speaker: string;
  readonly portraitSlot: string;
  readonly done: boolean;
  readonly revealBeatGating: boolean;
  readonly flags: Readonly<Record<string, boolean | string | number>>;
}

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - The expected scene key.
 * @returns A promise that resolves once the scene is active.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Read the live render resolution snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The resolution snapshot, or null when unavailable.
 */
async function resolution(page: Page): Promise<Resolution | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.resolution() ?? null) as Resolution | null
  );
}

/**
 * Read the live dialogue snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The dialogue snapshot, or null when not on the Dialogue scene.
 */
async function dialogue(page: Page): Promise<DialogueSnap | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.dialogue() ?? null) as DialogueSnap | null
  );
}

/** Collect console + page errors on a page for the "no errors" assertions. */
function collectErrors(page: Page): readonly string[] {
  const errors: string[] = [];
  page.on("console", m => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", e => errors.push(String(e)));
  return errors;
}

test.describe("GRIST — demo polish: palette + transitions + Sable-reveal beat (UAT, #114)", () => {
  test("[palette-grist-gold] the Marrow renders the desaturated grist-gold palette at 384x216, error-free (AC1)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Field");
    // Let the readable fade-in settle before sampling the frame.
    await page.waitForTimeout(400);

    const res = await resolution(page);
    expect(res?.width).toBe(BASE_WIDTH);
    expect(res?.height).toBe(BASE_HEIGHT);
    // Integer-scaled per decision 0006 — the palette pass must not disturb it.
    expect(Number.isInteger(res?.zoom ?? 0.5)).toBe(true);

    // The palette the Marrow actually consumes is the desaturation + grist-gold grade:
    // the highlight is the canonical grist-gold, and the structural base is drained
    // (near-grey — low chroma) so the gold glows against it.
    const palette = (await page.evaluate(
      () => window.__VERIFY__?.palette() ?? null
    )) as PaletteSnap | null;
    expect(palette?.highlight).toBe(GRIST_GOLD);
    // The gold is vivid; the base/floor/wall are desaturated well below it.
    expect(palette?.highlightChroma ?? 0).toBeGreaterThan(100);
    expect(palette?.baseChroma ?? 999).toBeLessThan(
      palette?.highlightChroma ?? 0
    );

    // A committed frame is the visual evidence the Marrow reads drained with grist-gold
    // accents (the grist readout / room banner / interactable sign).
    await expect(page.locator("canvas")).toBeVisible();
    await page.locator("canvas").screenshot();

    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("[transition-fade-trajectory] a scene cut runs a bounded, readable fade-out->hold->fade-in (AC2)", async ({
    page,
  }) => {
    await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Field");

    // The pure transition machine the scenes drive: a bounded fade whose overlay covers
    // (opacity rises to 1), holds, then clears (opacity falls to 0) — never an instant snap.
    const trajectory = (await page.evaluate(
      () => window.__VERIFY__?.transition(24) ?? null
    )) as TransitionSnap | null;
    expect(trajectory).not.toBeNull();
    expect(trajectory?.totalMs ?? 0).toBeGreaterThan(0);
    // Readable ceiling (AC2): legible but not sluggish.
    expect(trajectory?.totalMs ?? 9999).toBeLessThanOrEqual(TRANSITION_MAX_MS);

    const phases = (trajectory?.frames ?? []).map(f => f.phase);
    expect(phases).toContain("fade-out");
    expect(phases).toContain("hold");
    expect(phases).toContain("fade-in");
    // The overlay fully covers the screen at some point (opacity 1) and ends clear.
    const opacities = (trajectory?.frames ?? []).map(f => f.opacity);
    expect(Math.max(...opacities)).toBeCloseTo(1, 1);
    expect(opacities[opacities.length - 1] ?? 1).toBeCloseTo(0, 5);
  });

  test("[readable-transition] a Field->Battle->Field round trip preserves the 384x216 baseline through the fade (AC2)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Field");

    // Engage the Room-A encounter: the Field fades out to the Battle (the readable
    // outgoing cut). The bridge poll tolerates the fade latency.
    await page.evaluate(() => window.__VERIFY__?.engage());
    await waitForScene(page, "Battle");

    // The resolution is unchanged across the transition — the fade is an overlay/camera
    // effect, never a resolution change (decision 0006 preserved).
    const battleRes = await resolution(page);
    expect(battleRes?.width).toBe(BASE_WIDTH);
    expect(battleRes?.height).toBe(BASE_HEIGHT);

    // Drive the battle to a win; control returns to the Field behind the incoming cut.
    const outcome = await page.evaluate(
      () => window.__VERIFY__?.autoWin() ?? ""
    );
    expect(outcome).toBe("won");
    await waitForScene(page, "Field");

    const fieldRes = await resolution(page);
    expect(fieldRes?.width).toBe(BASE_WIDTH);
    expect(fieldRes?.height).toBe(BASE_HEIGHT);

    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });

  test("[sable-reveal-beat] the reveal holds its quiet beat, then releases into the ambush (AC3)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(`/?scene=opening&uat=1&seed=${FIXED_SEED}`);
    await waitForScene(page, "Dialogue");

    // Walk the linear opening to the reveal via the GATED live path: hook ->
    // cargo-reached -> pry -> cargo-opens. These ordinary lines are never gated.
    for (let step = 0; step < 3; step++) {
      await page.evaluate(() => window.__VERIFY__?.advanceDialogueLive());
    }

    // At the reveal: the caption names SABLE, the ledger flag has flipped, and the
    // deliberate quiet beat is now HOLDING (revealBeatGating is true).
    const reveal = await dialogue(page);
    expect(reveal?.caption).toContain(REVEAL_NODE_CAPTION_TOKEN);
    expect(reveal?.flags?.[SABLE_REVEALED_FLAG]).toBe(true);
    expect(reveal?.revealBeatGating).toBe(true);

    // Block: a live advance while the beat holds is DEFERRED — the reveal caption is
    // still on screen (the moment lands before the ambush).
    await page.evaluate(() => window.__VERIFY__?.advanceDialogueLive());
    const held = await dialogue(page);
    expect(held?.caption).toContain(REVEAL_NODE_CAPTION_TOKEN);
    expect(held?.revealBeatGating).toBe(true);

    // Release: deterministically elapse the full beat, then the gate opens.
    await page.evaluate(
      ms => window.__VERIFY__?.tickRevealBeat(ms),
      REVEAL_BEAT_MS
    );
    const released = await dialogue(page);
    expect(released?.revealBeatGating).toBe(false);

    // Now the live advance walks off the reveal and the narrative reaches its end,
    // handing off to the tutorial ambush (Field -> already-pending -> Battle).
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.__VERIFY__?.advanceDialogueLive());
          return page.evaluate(() => window.__VERIFY__?.scene() ?? "");
        },
        { timeout: SEEN_TIMEOUT }
      )
      .toBe("Battle");

    expect(errors, `unexpected page errors: ${errors.join("; ")}`).toEqual([]);
  });
});
