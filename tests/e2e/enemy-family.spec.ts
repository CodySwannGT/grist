/**
 * Enemy-family verification (UAT) suite — the Validation Journey for #138. Drives
 * the in-game `window.__VERIFY__` bridge against the live build to prove the
 * issue's two acceptance scenarios empirically:
 *
 * - [enemy-family-schema-valid] (AC scenario 1) a family authored against the
 *   {@link EnemyFamilyDef} schema loads through the content barrel and boots via
 *   `__VERIFY__` — observed scene-agnostically with `__VERIFY__.loadEnemy()` /
 *   `enemy()`, with no engine-code edit and (the build proves) zero Phaser imports
 *   in `content/enemies`. Its per-region stat block validates against the schema.
 *   The "an entry with an unknown family tag fails validation" half is proven by
 *   the Phaser-free unit suite (`tests/logic/enemy-family.test.ts`), which can force
 *   the invalid shape past the compiler; this spec proves the live, valid family.
 * - [ashfall-variant-gloom-attack] (AC scenario 2) once the world-state is
 *   `ashfall`, the SAME family resolves to its warped variant with a drained-palette
 *   marker and at least one new entropy/Gloom attack distinct from its Reach block —
 *   the Reckoning warp, read through the live world-state flag.
 *
 * Determinism: the family's `__VERIFY__.enemy().hash` is reproducible across a
 * genuine page reload (same family + same world-state ⇒ identical digest), the
 * scene-agnostic analogue of the battle state-hash gate. The bridge is enabled with
 * `?uat=1`; the family schema rides the content tables, so the scene is irrelevant
 * and the default boot is used.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/**
 * Wait until the verification bridge is installed with its **enemy** contract
 * present (`loadEnemy` + `enemy`) plus the world-state seam the Ashfall warp reads
 * (`save` / `worldState` / `reckon`). Asserting the whole shape up front means a
 * broken bridge fails here, loudly, instead of silently no-op'ing through an
 * optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.loadEnemy === "function" &&
            typeof api?.enemy === "function" &&
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
 * Boot the app with the verification bridge enabled (scene-agnostic — the family
 * schema rides the content tables, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * The serialized save shape the bridge round-trips — structurally aligned with the
 * current v2 `CurrentSave` (carrying the world-state flag) but declared locally so
 * the spec needs no app import (mirrors `region-template.spec.ts`).
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
 * family resolves its Reach stat block before the Reckoning. Minimal but complete
 * so it validates and persists (structurally aligned with the v2 `CurrentSave`).
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

test.describe("GRIST — enemy-family verification (UAT)", () => {
  // Collected page errors for the current test. Registered BEFORE boot in the
  // beforeEach so a boot-time exception is captured, not missed.
  let errors: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[enemy-family-schema-valid] a schema-authored family loads and its per-region block validates", async ({
    page,
  }) => {
    // Before loading: no family is held — the cell cannot fabricate one.
    expect(await page.evaluate(() => window.__VERIFY__!.enemy())).toBeNull();

    // Load the canonical example family authored against the schema. This is pure
    // data flowing through the content barrel — no engine wiring.
    await page.evaluate(() => window.__VERIFY__!.loadEnemy());

    const loaded = await page.evaluate(() => window.__VERIFY__!.enemy());
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe("marrow-gangs");
    // It loaded as a valid family with a known tag: schema validation passed.
    expect(loaded!.knownTag).toBe(true);
    expect(loaded!.complete).toBe(true);
    expect(loaded!.errors).toEqual([]);
    // Before the Reckoning it resolves its Reach block (no drained palette / no
    // Gloom attacks) — a real per-region block surfaced through the barrel.
    expect(loaded!.worldState).toBe("reach");
    expect(loaded!.isAshfall).toBe(false);
    expect(loaded!.drainedPalette).toBeNull();
    expect(loaded!.lootGrist).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test("[ashfall-variant-gloom-attack] the family warps to its drained Ashfall variant with a Gloom attack when the Reckoning fires", async ({
    page,
  }) => {
    // Seed Act I reach and load the schema-authored family.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    await page.evaluate(() => window.__VERIFY__!.loadEnemy());

    // Before the Reckoning: the Reach block, no drained palette, no Gloom attacks.
    const before = await page.evaluate(() => window.__VERIFY__!.enemy());
    expect(before!.worldState).toBe("reach");
    expect(before!.isAshfall).toBe(false);
    expect(before!.drainedPalette).toBeNull();
    expect(before!.gloomAttacks).toEqual([]);

    // Fire the Reckoning world-turn (the in-memory flip; consumes no RNG).
    await page.evaluate(() => window.__VERIFY__!.reckon());

    // The SAME authored family now resolves its warped Ashfall variant: a
    // drained-palette marker plus at least one new Gloom attack distinct from its
    // Reach block (the Reckoning warp, the both-states thesis for enemies).
    const after = await page.evaluate(() => window.__VERIFY__!.enemy());
    expect(after!.worldState).toBe("ashfall");
    expect(after!.isAshfall).toBe(true);
    expect(after!.drainedPalette).not.toBeNull();
    expect(after!.drainedPalette!.length).toBeGreaterThan(0);
    expect(after!.gloomAttacks.length).toBeGreaterThan(0);
    // The warped variant is distinct from the Reach read — a different hash.
    expect(after!.hash).not.toBe(before!.hash);
    // Still a valid, complete family after the flip.
    expect(after!.complete).toBe(true);

    expect(errors).toEqual([]);
  });

  test("[ashfall-variant-gloom-attack] the family hash is deterministic and reproducible across a reload", async ({
    page,
  }) => {
    // Seed a fixed world-state and load the family; capture its determinism hash.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    await page.evaluate(() => window.__VERIFY__!.loadEnemy());
    const first = await page.evaluate(() => window.__VERIFY__!.enemy());
    expect(first!.hash).toMatch(/^[0-9a-f]{8}$/);

    // A genuine full reload: a fresh document and a fresh bridge. The same family
    // resolved through the same world-state yields a byte-identical hash — same
    // world-state + same family ⇒ identical digest, no drift.
    await bootWithBridge(page);
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    await page.evaluate(() => window.__VERIFY__!.loadEnemy());
    const second = await page.evaluate(() => window.__VERIFY__!.enemy());
    expect(second!.hash).toBe(first!.hash);
    expect(second!.id).toBe(first!.id);

    expect(errors).toEqual([]);
  });
});
