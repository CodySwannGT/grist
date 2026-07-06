/**
 * Ashfall enemy-variant + harsher-economy verification (UAT) suite — the Validation
 * Journey for #141. Drives the in-game `window.__VERIFY__` bridge against the live
 * build to prove the issue's acceptance scenario empirically, scene-agnostically:
 *
 * - [EVIDENCE: ashfall-variant-active] once the world-state is `ashfall`, a recurring
 *   encounter enemy resolves to its warped Ashfall variant — a drained-palette marker
 *   and at least one new entropy/Gloom attack distinct from its Reach read — observed
 *   with `__VERIFY__.ashfallEnemy()` through the live world-state flag.
 * - [EVIDENCE: harsher-economy-applies] in the SAME session, the Act II economy
 *   tightens versus the Act I baseline — an earn pays leaner and a cost runs harsher —
 *   observed with `__VERIFY__.ashfallEconomy()`.
 *
 * Determinism: both reads expose a `hash` reproducible across a genuine page reload
 * (same world-state ⇒ identical digest), the scene-agnostic analogue of the battle
 * state-hash gate. The bridge is enabled with `?uat=1`; the variant table + economy
 * ride the content tables, so the scene is irrelevant and the default boot is used.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/**
 * Wait until the verification bridge is installed with its Ashfall contract present
 * (`ashfallEnemy` + `ashfallEconomy`) plus the world-state seam the warp reads
 * (`save` / `worldState` / `reckon`). Asserting the whole shape up front means a
 * broken bridge fails here, loudly, instead of silently no-op'ing.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.ashfallEnemy === "function" &&
            typeof api?.ashfallEconomy === "function" &&
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
 * Boot the app with the verification bridge enabled (scene-agnostic — the variant
 * table + economy ride the content tables, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?scene=battle&uat=1");
  await waitForBridge(page);
}

/**
 * The serialized save shape the bridge round-trips — structurally aligned with the
 * current v3 `CurrentSave` (carrying the world-state flag) but declared locally so
 * the spec needs no app import (mirrors `enemy-family.spec.ts`).
 */
interface SaveDataV3 {
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
 * variant + economy resolve their Reach reads before the Reckoning.
 * @returns A complete v3 save in the reach world-state.
 */
function reachSave(): SaveDataV3 {
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

test.describe("GRIST — Ashfall variants + harsher economy verification (UAT)", () => {
  // Collected page errors for the current test, registered BEFORE boot so a
  // boot-time exception is captured, not missed.
  let errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: ashfall-variant-active] a recurring encounter enemy warps to its drained, Gloom-touched variant when the Reckoning fires", async ({
    page,
  }) => {
    // Seed Act I reach. Before the Reckoning: the base read — no drained palette,
    // no Gloom attacks.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    const before = await page.evaluate(() => window.__VERIFY__!.ashfallEnemy());
    expect(before.worldState).toBe("reach");
    expect(before.isAshfall).toBe(false);
    expect(before.drainedPalette).toBeNull();
    expect(before.gloomAttacks).toEqual([]);

    // Fire the Reckoning world-turn (the in-memory flip; consumes no RNG).
    await page.evaluate(() => window.__VERIFY__!.reckon());

    // The SAME encounter enemy now resolves its warped Ashfall variant: a
    // drained-palette marker plus at least one entropy/Gloom attack.
    const after = await page.evaluate(() => window.__VERIFY__!.ashfallEnemy());
    expect(after.worldState).toBe("ashfall");
    expect(after.isAshfall).toBe(true);
    expect(after.drainedPalette).not.toBeNull();
    expect(after.drainedPalette!.length).toBeGreaterThan(0);
    expect(after.gloomAttacks.length).toBeGreaterThan(0);
    // The warped read is distinct from the base read — a different hash.
    expect(after.hash).not.toBe(before.hash);
    // The ref is stable (the variant overlays the base battler ref).
    expect(after.ref).toBe(before.ref);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: harsher-economy-applies] the Act II economy pays leaner and costs harsher than the Act I baseline", async ({
    page,
  }) => {
    // Seed Act I reach. The neutral baseline: an earn pays in full, a cost is neutral.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    const before = await page.evaluate(() =>
      window.__VERIFY__!.ashfallEconomy()
    );
    expect(before.worldState).toBe("reach");
    expect(before.isAshfall).toBe(false);
    expect(before.rewardMultiplier).toBe(1);
    expect(before.costMultiplier).toBe(1);
    expect(before.sampleReward).toBe(before.baseReward);
    expect(before.sampleCost).toBe(before.baseCost);

    // Fire the Reckoning; the economy tightens in the SAME session.
    await page.evaluate(() => window.__VERIFY__!.reckon());

    const after = await page.evaluate(() =>
      window.__VERIFY__!.ashfallEconomy()
    );
    expect(after.worldState).toBe("ashfall");
    expect(after.isAshfall).toBe(true);
    // Rewards lean: the multiplier drops below 1 and a base earn pays strictly less.
    expect(after.rewardMultiplier).toBeLessThan(1);
    expect(after.sampleReward).toBeLessThan(before.sampleReward);
    // Costs strain: the multiplier rises above 1 and a base sink costs strictly more.
    expect(after.costMultiplier).toBeGreaterThan(1);
    expect(after.sampleCost).toBeGreaterThan(before.sampleCost);
    expect(after.hash).not.toBe(before.hash);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: ashfall-variant-active] the variant + economy hashes are deterministic across a reload", async ({
    page,
  }) => {
    // Seed Ashfall directly and capture both determinism hashes.
    const ashfallSave = { ...reachSave(), worldState: "ashfall" as const };
    await page.evaluate(save => window.__VERIFY__!.save(save), ashfallSave);
    const firstEnemy = await page.evaluate(() =>
      window.__VERIFY__!.ashfallEnemy()
    );
    const firstEconomy = await page.evaluate(() =>
      window.__VERIFY__!.ashfallEconomy()
    );
    expect(firstEnemy.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(firstEnemy.isAshfall).toBe(true);
    expect(firstEconomy.isAshfall).toBe(true);

    // A genuine full reload: a fresh document and a fresh bridge. The same
    // world-state yields byte-identical digests — no drift.
    await bootWithBridge(page);
    await page.evaluate(save => window.__VERIFY__!.save(save), ashfallSave);
    const secondEnemy = await page.evaluate(() =>
      window.__VERIFY__!.ashfallEnemy()
    );
    const secondEconomy = await page.evaluate(() =>
      window.__VERIFY__!.ashfallEconomy()
    );
    expect(secondEnemy.hash).toBe(firstEnemy.hash);
    expect(secondEconomy.hash).toBe(firstEconomy.hash);

    expect(errors).toEqual([]);
  });
});
