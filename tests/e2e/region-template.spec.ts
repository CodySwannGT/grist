/**
 * Region-template verification (UAT) suite — the Validation Journey for #133.
 * Drives the in-game `window.__VERIFY__` bridge against the live build to prove
 * the issue's two acceptance scenarios empirically:
 *
 * - [region-template-loads] (AC scenario 1) a region authored against the
 *   {@link RegionDef} template loads through the content barrel and boots via
 *   `__VERIFY__` — observed scene-agnostically with `__VERIFY__.loadRegion()` /
 *   `region()`, with no engine-code edit and (the build proves) zero Phaser imports
 *   in `content/regions`.
 * - [region-both-states-present] (AC scenario 2) the loaded region exposes BOTH an
 *   Act I Reach variant and an Act II Ashfall variant and passes both-states
 *   validation; and the SAME region resolves a different variant the instant the
 *   Reckoning flips the world-state flag (the both-states thesis). The "a region
 *   missing a variant fails validation" half is proven by the Phaser-free unit
 *   suite (`tests/logic/region-template.test.ts`), which can force the invalid
 *   shape past the compiler; this spec proves the live, complete region.
 *
 * Determinism: the region's `__VERIFY__.region().hash` is reproducible across a
 * genuine page reload (same region + same world-state ⇒ identical digest), the
 * scene-agnostic analogue of the battle state-hash gate. The bridge is enabled with
 * `?uat=1`; the region template rides the content tables, so the scene is irrelevant
 * and the default boot is used.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/**
 * Wait until the verification bridge is installed with its **region** contract
 * present (`loadRegion` + `region`) plus the world-state seam the both-states flip
 * reads (`save` / `worldState` / `reckon`). Asserting the whole shape up front
 * means a broken bridge fails here, loudly, instead of silently no-op'ing through
 * an optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.loadRegion === "function" &&
            typeof api?.region === "function" &&
            typeof api?.save === "function" &&
            typeof api?.worldState === "function" &&
            typeof api?.reckon === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the region
 * template rides the content tables, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * The serialized save shape the bridge round-trips — structurally aligned with the
 * current v2 `CurrentSave` (carrying the world-state flag) but declared locally so
 * the spec needs no app import (mirrors `world-state.spec.ts`).
 */
interface SaveDataV2 {
  readonly version: 3;
  readonly party: readonly { readonly id: string; readonly level: number }[];
  readonly grist: number;
  readonly inventory: readonly { readonly id: string; readonly qty: number }[];
  readonly learned: readonly string[];
  readonly learning: readonly {
    readonly spell: string;
    readonly progress: number;
  }[];
  readonly choice: { readonly resolved: boolean };
  readonly moralLedger: {
    readonly karma: number;
    readonly freeChoices: number;
    readonly wieldChoices: number;
  };
  readonly rng: { readonly seed: number; readonly state: number };
  readonly worldState: "reach" | "ashfall";
  readonly build: {
    readonly statBonuses: Readonly<Record<string, number>>;
    readonly equippedShards: readonly string[];
  };
  readonly scene: {
    readonly sceneId: string;
    readonly nodeId: string;
    readonly flags: Readonly<Record<string, boolean | string | number>>;
  } | null;
}

/**
 * A representative save in Act I `reach`: seeds the bridge-held world-state so the
 * region resolves its Reach variant before the Reckoning. Minimal but complete so
 * it validates and persists (structurally aligned with the v2 `CurrentSave`).
 * @returns A complete v2 save in the reach world-state.
 */
function reachSave(): SaveDataV2 {
  return {
    version: 3,
    party: [{ id: "wren", level: 1 }],
    grist: 0,
    inventory: [],
    learned: [],
    learning: [],
    choice: { resolved: false },
    moralLedger: { karma: 0, freeChoices: 0, wieldChoices: 0 },
    rng: { seed: 4242, state: 4242 },
    worldState: "reach",
    build: { statBonuses: {}, equippedShards: [] },
    scene: null,
  };
}

test.describe("GRIST — region-template verification (UAT)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[region-template-loads] a template-authored region loads through the content barrel and boots via __VERIFY__", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Before loading: no region is held — the cell cannot fabricate one.
    expect(await page.evaluate(() => window.__VERIFY__!.region())).toBeNull();

    // Load the canonical example region authored against the template. This is
    // pure data flowing through the content barrel — no engine wiring.
    await page.evaluate(() => window.__VERIFY__!.loadRegion());

    const loaded = await page.evaluate(() => window.__VERIFY__!.region());
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("marrow");
    // It loaded as a valid region: both-states validation passed, no errors.
    expect(loaded!.complete).toBe(true);
    expect(loaded!.errors).toEqual([]);
    // A non-empty resolved variant proves the region surfaced real authored data
    // through the barrel.
    expect(loaded!.variantName.length).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("[region-both-states-present] the region exposes both Reach and Ashfall, switching variant when the Reckoning fires", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Seed Act I reach and load the template-authored region.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    await page.evaluate(() => window.__VERIFY__!.loadRegion());

    // Both world-state variants are present (the both-states schema) and the
    // region resolves its Reach (verdant) variant before the Reckoning.
    const before = await page.evaluate(() => window.__VERIFY__!.region());
    expect(before!.hasReach).toBe(true);
    expect(before!.hasAshfall).toBe(true);
    expect(before!.complete).toBe(true);
    expect(before!.worldState).toBe("reach");
    expect(before!.tone).toBe("verdant");

    // Fire the Reckoning world-turn (the in-memory flip; consumes no RNG).
    await page.evaluate(() => window.__VERIFY__!.reckon());

    // The SAME authored region now resolves its Ashfall (ashen) variant — proving
    // a region reads as two states through the live flag (the both-states thesis).
    const after = await page.evaluate(() => window.__VERIFY__!.region());
    expect(after!.worldState).toBe("ashfall");
    expect(after!.tone).toBe("ashen");
    expect(after!.variantName).not.toBe(before!.variantName);
    // Still complete and still exposing both variants after the flip.
    expect(after!.hasReach).toBe(true);
    expect(after!.hasAshfall).toBe(true);
    expect(after!.complete).toBe(true);

    expect(errors).toEqual([]);
  });

  test("[region-both-states-present] the region hash is deterministic and reproducible across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Seed a fixed world-state and load the region; capture its determinism hash.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    await page.evaluate(() => window.__VERIFY__!.loadRegion());
    const first = await page.evaluate(() => window.__VERIFY__!.region());
    expect(first!.hash).toMatch(/^[0-9a-f]{8}$/);

    // A genuine full reload: a fresh document and a fresh bridge. The same region
    // resolved through the same world-state yields a byte-identical hash — same
    // seed/state + same region ⇒ identical digest, no drift.
    await bootWithBridge(page);
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    await page.evaluate(() => window.__VERIFY__!.loadRegion());
    const second = await page.evaluate(() => window.__VERIFY__!.region());
    expect(second!.hash).toBe(first!.hash);
    expect(second!.id).toBe(first!.id);

    expect(errors).toEqual([]);
  });
});
