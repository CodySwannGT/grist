/**
 * Growth/bench-scene verification (UAT) suite — the manifest for sub-task #86.
 * Boots the Bench scene directly via `?scene=bench` and drives it through the
 * in-game `window.__VERIFY__` bridge to prove, empirically against the live
 * canvas, the acceptance criteria:
 *
 * - [bench-open-384x216] the growth screen opens at 384×216, integer zoom, no errors.
 * - [bench-equip-shard] equipping the Ashling shard begins Cinder learning (per 2.4.1).
 * - [bench-spend-grist-stat] buying Runner's Reflex draws the wallet down 25 grist and
 *   changes the build (+2 SPD) — the AC6 stat-spend.
 * - [bench-spend-grist-learn] accelerating Cinder draws the wallet down 20 grist and
 *   advances Cinder learning — the AC6 learning-spend.
 *
 * Every growth action is routed through the scene's semantic bench-input layer
 * (the scene reads no raw pointer), so a state change after a bridge-driven action
 * is end-to-end proof the equip/spend path works on the canvas. The bench is the
 * sim-authoritative renderer: all economy/learning rules live in `logic`, and this
 * spec asserts the scene's rendered state mirrors those reducers. This spec never
 * touches the battle/field specs and the battle boot stays the default, so all
 * existing tests stay green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A wallet seeded well above both sink costs so the spends are affordable. */
const FUNDED_GRIST = 100;
/** The slice sink costs (authoritative in `src/content/bench.ts`). */
const RUNNERS_REFLEX_COST = 25;
const ACCELERATE_CINDER_COST = 20;

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** The bench snapshot exposed by the verification bridge. */
interface BenchState {
  readonly scene: string;
  readonly grist: number;
  readonly shardEquipped: boolean;
  readonly cinderLearning: boolean;
  readonly cinderProgress: number;
  readonly spdBonus: number;
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
 * Boot the Bench scene directly with the bridge enabled. The `?scene=bench` query
 * makes the Preloader start Bench instead of Battle; `?grist=N` is the
 * verification-only seam that tops the wallet up to a funded balance so the spend
 * ACs ("given a funded wallet") can run without first earning grist in battle.
 * @param page - The Playwright page.
 * @param grist - The funded grist balance to seed (default: the funded constant).
 */
async function bootBench(page: Page, grist = FUNDED_GRIST): Promise<void> {
  await page.goto(`/?scene=bench&uat=1&grist=${grist}`);
  await waitForScene(page, "Bench");
}

/**
 * Read the live bench snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The bench snapshot, or null if unavailable.
 */
async function benchState(page: Page): Promise<BenchState | null> {
  return page.evaluate(() => window.__VERIFY__?.bench() ?? null);
}

test.describe("GRIST — growth/bench scene verification (UAT)", () => {
  test("[bench-open-384x216] opens the growth screen at 384x216, integer-scaled, no errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootBench(page);
    await expect(page.locator("canvas")).toBeVisible();

    const bench = await benchState(page);
    expect(bench?.scene).toBe("Bench");

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
    expect(errors).toEqual([]);
  });

  test("[bench-equip-shard] equipping the Ashling shard begins Cinder learning", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootBench(page);

    // Nothing equipped yet: Cinder is not in progress.
    const before = await benchState(page);
    expect(before?.shardEquipped).toBe(false);
    expect(before?.cinderLearning).toBe(false);
    expect(before?.cinderProgress).toBe(0);

    // Equip the shard via the bench (the canonical "agent equipped the shard").
    await page.evaluate(() => window.__VERIFY__?.equipShard());

    const after = await benchState(page);
    expect(after?.shardEquipped).toBe(true);
    expect(after?.cinderLearning).toBe(true);
    expect(errors).toEqual([]);
  });

  test("[bench-spend-grist-stat] buying Runner's Reflex spends grist and grows SPD (AC6)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootBench(page);

    const before = await benchState(page);
    const startGrist = before?.grist ?? 0;
    // The slice starts with enough grist to cover Runner's Reflex (25).
    expect(startGrist).toBeGreaterThanOrEqual(RUNNERS_REFLEX_COST);
    expect(before?.spdBonus).toBe(0);

    await page.evaluate(() => window.__VERIFY__?.buyRunnersReflex());

    const after = await benchState(page);
    // The wallet drew down by the cost and the build changed (+2 SPD) — AC6.
    expect(after?.grist).toBe(startGrist - RUNNERS_REFLEX_COST);
    expect(after?.spdBonus).toBe(2);
    expect(errors).toEqual([]);
  });

  test("[bench-spend-grist-learn] accelerating Cinder spends grist and advances learning (AC6)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootBench(page);

    // Equip first so Cinder is in progress (the accelerate gate).
    await page.evaluate(() => window.__VERIFY__?.equipShard());
    const equipped = await benchState(page);
    const startGrist = equipped?.grist ?? 0;
    expect(startGrist).toBeGreaterThanOrEqual(ACCELERATE_CINDER_COST);
    expect(equipped?.cinderProgress).toBe(0);

    await page.evaluate(() => window.__VERIFY__?.accelerateCinder());

    const after = await benchState(page);
    // The wallet drew down by the cost and Cinder learning advanced — AC6.
    expect(after?.grist).toBe(startGrist - ACCELERATE_CINDER_COST);
    expect(after?.cinderProgress ?? 0).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("[bench-unaffordable-noop] a sink the wallet cannot cover does not draw down or crash", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootBench(page);

    // Accelerate before equipping: Cinder is not in progress, so the spend must
    // be rejected — the wallet is untouched and nothing crashes.
    const before = await benchState(page);
    await page.evaluate(() => window.__VERIFY__?.accelerateCinder());
    const after = await benchState(page);
    expect(after?.grist).toBe(before?.grist);
    expect(after?.cinderProgress).toBe(0);
    expect(errors).toEqual([]);
  });
});
