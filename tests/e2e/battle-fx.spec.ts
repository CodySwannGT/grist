import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;

/** The color-language tints the render layer applies per element (see consts.ts). */
const FLUX_TINT = 0xaef7ff;
const ASH_TINT = 0xb7a2d6;

/** The FX selection the verification bridge exposes (`__VERIFY__.fx()`). */
interface FxSelection {
  readonly anim: string;
  readonly element: string | null;
  readonly tint: number;
}

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - Expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Boot the standalone battle (The Drip) at a fixed seed with the bridge enabled.
 * @param page - The Playwright page.
 */
async function bootBattle(page: Page): Promise<void> {
  await page.goto(`/?scene=battle&uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Battle");
}

/**
 * Drive a Craft of the given spell from Wren (party 0) at the first enemy, then
 * poll until the stage's last-played FX reports the expected element.
 * @param page - The Playwright page.
 * @param spellId - The spell id to cast (its element drives the FX).
 * @param element - The element the FX must read as.
 * @returns The recorded FX selection.
 */
async function craftAndReadFx(
  page: Page,
  spellId: string,
  element: string
): Promise<FxSelection> {
  await page.evaluate(
    id =>
      window.__VERIFY__?.act({
        kind: "craft",
        id,
        actor: { side: "party", index: 0 },
        target: { side: "enemies", index: 0 },
      }),
    spellId
  );
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.fx()?.element ?? null))
    .toBe(element);
  return (await page.evaluate(
    () => window.__VERIFY__?.fx() ?? null
  )) as FxSelection;
}

test.describe("GRIST — elemental battle FX (UAT, #201)", () => {
  test("a Flux Craft shows the Flux-tinted lightning FX (AC1)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", m => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", e => errors.push(e.message));

    await bootBattle(page);
    const fx = await craftAndReadFx(page, "spark", "flux");

    expect(fx.anim).toBe("anim-fx-flux");
    expect(fx.tint).toBe(FLUX_TINT);
    expect(errors).toEqual([]);
  });

  test("an Ash Craft shows a DISTINCT Ash-tinted FX (AC1: read by element)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", m => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", e => errors.push(e.message));

    await bootBattle(page);
    const fx = await craftAndReadFx(page, "cinder", "ash");

    expect(fx.anim).toBe("anim-fx-ash");
    expect(fx.tint).toBe(ASH_TINT);
    // The Ash strip is genuinely different from the Flux strip.
    expect(fx.anim).not.toBe("anim-fx-flux");
    expect(errors).toEqual([]);
  });

  test("a physical Strike shows the neutral (un-tinted) slash FX", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", m => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", e => errors.push(e.message));

    await bootBattle(page);
    await page.evaluate(() =>
      window.__VERIFY__?.act({
        kind: "strike",
        actor: { side: "party", index: 0 },
        target: { side: "enemies", index: 0 },
      })
    );
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.fx()?.anim ?? null))
      .toBe("anim-fx-slash");

    const fx = (await page.evaluate(
      () => window.__VERIFY__?.fx() ?? null
    )) as FxSelection;
    expect(fx.element).toBeNull();
    expect(fx.tint).toBe(0xffffff);
    expect(errors).toEqual([]);
  });

  test("the element-FX render pass keeps the sim deterministic (AC2)", async ({
    page,
  }) => {
    await bootBattle(page);

    // A fixed, wall-clock-free action sequence driven purely through the
    // deterministic bridge entry points: same seed + same sequence ⇒ identical
    // state-hash progression, proving the render-only element annotation never
    // perturbs the sim.
    const runHashes = () =>
      page.evaluate(seed => {
        const v = window.__VERIFY__;
        if (!v) {
          return [];
        }
        v.seed(seed);
        const hashes: (string | null)[] = [];
        const cast = () =>
          v.act({
            kind: "craft",
            id: "spark",
            actor: { side: "party", index: 0 },
            target: { side: "enemies", index: 1 },
          });
        cast();
        hashes.push(v.hash());
        v.advanceTurn();
        hashes.push(v.hash());
        cast();
        hashes.push(v.hash());
        return hashes;
      }, FIXED_SEED);

    const first = await runHashes();
    const second = await runHashes();
    expect(first).toEqual(second);
    expect(first.every(h => typeof h === "string")).toBe(true);
  });
});
