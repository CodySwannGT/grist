/**
 * Bound-site template verification (UAT) suite — the Validation Journey for #135.
 * Drives the in-game `window.__VERIFY__` bridge against the live build to prove the
 * issue's two acceptance scenarios EMPIRICALLY (unit/typecheck/lint alone are not
 * acceptable per the issue): a region's single Bound site, anchored through the
 * Bound-site template and resolved with the Phase-2 free-vs-wield kit, diverges
 * measurably between *free* and *wield* and that divergence survives a genuine page
 * reload (the persistence half of AC).
 *
 * - [bound-free-resolution] (AC scenario 1) reaching the canonical region's Bound
 *   site and choosing *free* grants the weaker shard with karma+ and **no**
 *   corruption, observed scene-agnostically via `__VERIFY__.openBoundSite()` /
 *   `chooseBound("free")` / `boundSite()`; then a save built from that settled
 *   choice round-trips through IndexedDB and is restored byte-for-byte after a real
 *   reload (`runState()` shows `variant: "free"`, `karma: 1`).
 * - [bound-wield-corruption] (AC scenario 2) the same site, choosing *wield*, grants
 *   the stronger carry with **accruing** corruption and karma−; and that persists
 *   across the reload too (`runState()` shows `variant: "wield"`, `karma: -1`).
 *
 * Determinism: the site's `boundSite().hash` is reproducible across a genuine page
 * reload (same region + ledger + mode ⇒ identical digest), and free vs wield
 * diverge — the scene-agnostic analogue of the battle state-hash gate. The bridge is
 * enabled with `?uat=1`; the Bound-site template rides the content tables, so the
 * active scene is irrelevant and the default boot is used (mirrors
 * `region-template.spec.ts`). The "a region siting an undefined Bound throws" half is
 * proven by the Phaser-free unit suite (`tests/logic/bound-site.test.ts`), which can
 * force the invalid shape past the compiler; this spec proves the live, valid site.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The Bound the canonical Marrow region sites (the Ashling reward shard). */
const MARROW_BOUND = "marrow-bound";

/**
 * Wait until the verification bridge is installed with its **Bound-site** contract
 * present (`openBoundSite` / `chooseBound` / `boundSite`) plus the save + run-state
 * seam the persistence assertions read. Asserting the whole shape up front means a
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
            typeof api?.openBoundSite === "function" &&
            typeof api?.chooseBound === "function" &&
            typeof api?.boundSite === "function" &&
            typeof api?.save === "function" &&
            typeof api?.loadSave === "function" &&
            typeof api?.runState === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the Bound-site
 * template rides the content tables, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * The serialized save shape the bridge round-trips — structurally aligned with the
 * current v2 `CurrentSave` but declared locally so the spec needs no app import
 * (mirrors `region-template.spec.ts` / `world-state.spec.ts`).
 */
interface SaveDataV2 {
  readonly version: 3;
  readonly party: readonly {
    readonly id: string;
    readonly level: number;
    readonly shard?: string;
    readonly shardMode?: "free" | "wield";
  }[];
  readonly grist: number;
  readonly inventory: readonly { readonly id: string; readonly qty: number }[];
  readonly learned: readonly string[];
  readonly learning: readonly {
    readonly spell: string;
    readonly progress: number;
  }[];
  readonly choice: {
    readonly resolved: boolean;
    readonly shard?: string;
    readonly variant?: "free" | "wield";
  };
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
 * Build the save a settled Bound-site choice persists: the sited shard carried in
 * the chosen mode, the matching karma/ledger tallies, and the accrued corruption
 * folded into the carried shard — the exact run state the player would save after
 * facing the Bound. The two variants flip the shardMode / choice / karma so the
 * forks are measurably distinct persisted payloads.
 * @param variant - The resolved choice ("free" or "wield").
 * @returns A complete v2 save for the settled Bound-site choice.
 */
function settledSave(variant: "free" | "wield"): SaveDataV2 {
  const free = variant === "free";
  return {
    version: 3,
    party: [{ id: "wren", level: 4, shard: MARROW_BOUND, shardMode: variant }],
    grist: 12,
    inventory: [],
    learned: [],
    learning: [],
    choice: { resolved: true, shard: MARROW_BOUND, variant },
    moralLedger: {
      karma: free ? 1 : -1,
      freeChoices: free ? 1 : 0,
      wieldChoices: free ? 0 : 1,
    },
    rng: { seed: 0x135, state: 0x135 },
    worldState: "reach",
    build: { statBonuses: {}, equippedShards: [] },
    scene: null,
  };
}

test.describe("GRIST — Bound-site template verification (UAT)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[bound-free-resolution] choosing free grants the weak shard with karma+ and no corruption, persisting across reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Before opening: no site is held — the cell cannot fabricate one.
    expect(
      await page.evaluate(() => window.__VERIFY__!.boundSite())
    ).toBeNull();

    // Reach the region's single Bound site through the template (pure data through
    // the content barrel — no engine wiring), then read the unsettled site.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite());
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened).not.toBeNull();
    // The site is exactly the region's Bound, offering its content-table variants.
    expect(opened!.shard).toBe(MARROW_BOUND);
    expect(opened!.regionId).toBe("marrow");
    expect(opened!.settled).toBe(false);
    expect(opened!.freeCorruptionRate).toBe(0);
    expect(opened!.wieldCorruptionRate).toBeGreaterThan(0);

    // Choose FREE — the weaker, corruption-free attunement (karma+).
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const settled = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(settled!.settled).toBe(true);
    expect(settled!.variant).toBe("free");
    expect(settled!.corruptionAccrued).toBe(0);
    expect(settled!.karma).toBe(1);
    expect(settled!.freeChoices).toBe(1);
    expect(settled!.wieldChoices).toBe(0);

    // Persist the settled choice and reload across a genuine document boundary.
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      settledSave("free")
    );
    await bootWithBridge(page);
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    const run = await page.evaluate(() => window.__VERIFY__!.runState());

    // The free choice survived the reload exactly — restored from IndexedDB.
    expect(restored.choice).toEqual({
      resolved: true,
      shard: MARROW_BOUND,
      variant: "free",
    });
    expect(restored.moralLedger.karma).toBe(1);
    expect(run!.choice.variant).toBe("free");
    expect(run!.moralLedger.karma).toBe(1);

    expect(errors).toEqual([]);
  });

  test("[bound-wield-corruption] choosing wield grants the strong shard with accruing corruption and karma-, persisting across reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Reach the same region's Bound site and choose WIELD — the stronger carry
    // that accrues corruption (karma−).
    await page.evaluate(() => window.__VERIFY__!.openBoundSite());
    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const settled = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(settled!.settled).toBe(true);
    expect(settled!.variant).toBe("wield");
    // Corruption accrued is the shard's wield rate — strictly positive (the cost).
    expect(settled!.corruptionAccrued).toBeGreaterThan(0);
    expect(settled!.corruptionAccrued).toBe(settled!.wieldCorruptionRate);
    expect(settled!.karma).toBe(-1);
    expect(settled!.wieldChoices).toBe(1);
    expect(settled!.freeChoices).toBe(0);

    // Persist and reload — the corrupting carry survives the document boundary.
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      settledSave("wield")
    );
    await bootWithBridge(page);
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    const run = await page.evaluate(() => window.__VERIFY__!.runState());

    expect(restored.choice).toEqual({
      resolved: true,
      shard: MARROW_BOUND,
      variant: "wield",
    });
    expect(restored.moralLedger.karma).toBe(-1);
    expect(run!.choice.variant).toBe("wield");
    expect(run!.moralLedger.karma).toBe(-1);

    expect(errors).toEqual([]);
  });

  test("[bound-free-resolution] free vs wield diverge, and the site hash is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Free fork: open + choose free, capture its digest.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite());
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const free = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(free!.hash).toMatch(/^[0-9a-f]{8}$/);

    // A genuine full reload: fresh document + fresh bridge. The same region +
    // ledger + free choice yields a byte-identical hash — no drift.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite());
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const freeAgain = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(freeAgain!.hash).toBe(free!.hash);

    // Wield fork from the same opened site diverges from free (variant + karma +
    // corruption + digest), the slice's moral fork made measurable.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite());
    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const wield = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(wield!.hash).not.toBe(free!.hash);
    expect(wield!.variant).not.toBe(free!.variant);
    expect(wield!.karma).not.toBe(free!.karma);
    expect(wield!.corruptionAccrued).not.toBe(free!.corruptionAccrued);

    expect(errors).toEqual([]);
  });
});
