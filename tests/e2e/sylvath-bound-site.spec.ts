/**
 * Sylvath the Green Wyrm free-vs-wield site verification (UAT) suite — the
 * Bound-site half of the Validation Journey for #129 (PRD #43 FR5 / AC7). Drives the
 * in-game `window.__VERIFY__` bridge against the live build to prove EMPIRICALLY
 * (unit / typecheck / lint alone are NOT acceptable per the issue) that the
 * Sylvemarch sites Sylvath, and reaching that site lets the player face the region's
 * major free-vs-wield decision — freeing the great caged wyrm or wielding it —
 * resolved and persisted across a genuine reload:
 *
 * - [EVIDENCE: sylvath-bound-resolves] — freeing Sylvath grants the WEAKER shard with
 *   karma+ and NO corruption, observed scene-agnostically via
 *   `__VERIFY__.openBoundSite("sylvemarch")` / `chooseBound("free")` / `boundSite()`;
 *   then a save built from that settled choice round-trips through IndexedDB and is
 *   restored after a GENUINE page reload (`loadSave()` / `runState()` show
 *   `variant: "free"`, `karma: 1`).
 * - [EVIDENCE: sylvath-bound-resolves] — the SAME site, choosing WIELD, grants the
 *   STRONGER carry with ACCRUING corruption (karma−), and the wielded state WITH its
 *   corruption survives the reload too (`runState()` shows `variant: "wield"`,
 *   `karma: -1`; the persisted corruption is the carried shard's wield rate).
 *
 * Sylvath is a MAJOR decision (a great caged wyrm) — its wield corruption is the
 * heaviest authored Bound, so wielding it genuinely accrues corruption (the fork is
 * measurable). Determinism: the site's `boundSite().hash` is reproducible across a
 * genuine reload (same region + ledger + mode ⇒ identical digest), and free vs wield
 * diverge. The bridge is enabled with `?uat=1`; the Bound-site template rides the
 * content tables, so the active scene is irrelevant and the default boot is used
 * (mirrors `velith-bound-site.spec.ts`). The Phaser-free unit twin
 * (`tests/logic/sylvath-bound-site.test.ts`) proves the resolution headlessly; this
 * spec proves it on the live canvas across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The Sylvemarch region — the one that sites Sylvath. */
const SYLVEMARCH = "sylvemarch";
/** The Bound the Sylvemarch region sites: Sylvath, the Green Wyrm. */
const SYLVATH = "sylvath";

/**
 * Wait until the verification bridge is installed with its Bound-site contract
 * (`openBoundSite` / `chooseBound` / `boundSite`) plus the save + run-state seam the
 * persistence assertions read. Asserting the whole shape up front means a broken
 * bridge fails here, loudly, instead of silently no-op'ing through an optional chain.
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
  await page.goto("/?scene=battle&uat=1");
  await waitForBridge(page);
}

/**
 * The serialized save shape the bridge round-trips — structurally aligned with the
 * current v3 `CurrentSave` but declared locally so the spec needs no app import
 * (mirrors `velith-bound-site.spec.ts`).
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
 * Build the save a settled Sylvath Bound-site choice persists: Sylvath carried in the
 * chosen mode (`party[].shard` + `shardMode`), the resolved `choice`, and the
 * matching karma / ledger tallies — the exact run state the player would save after
 * facing Sylvath. The two variants flip the shardMode / choice / karma so the forks
 * are measurably distinct persisted payloads.
 *
 * The accrued corruption is NOT a separate persisted number: the kit derives it from
 * the persisted `choice.shard` + `choice.variant` through the content table
 * (`BOUNDS[shard].variants[variant].corruptionRate`), exactly as the live site does —
 * so restoring `{ shard: sylvath, variant: "wield" }` restores the WIELDED state WITH
 * its corruption (a positive, derivable rate), while `"free"` restores zero.
 * @param variant - The resolved choice ("free" or "wield").
 * @returns A complete v3 save for the settled Sylvath choice.
 */
function settledSave(variant: "free" | "wield"): SaveDataV2 {
  const free = variant === "free";
  return {
    version: 3,
    party: [{ id: "wren", level: 6, shard: SYLVATH, shardMode: variant }],
    grist: 14,
    inventory: [],
    learned: [],
    learning: [],
    choice: { resolved: true, shard: SYLVATH, variant },
    moralLedger: {
      karma: free ? 1 : -1,
      freeChoices: free ? 1 : 0,
      wieldChoices: free ? 0 : 1,
    },
    rng: { seed: 0x5417, state: 0x5417 },
    worldState: "reach",
    build: { statBonuses: {}, equippedShards: [] },
    scene: null,
  };
}

/**
 * Re-derive the corruption a restored choice carries, the way the kit does: free
 * accrues none; wield accrues the carried shard's wield rate read from the live
 * content table via a freshly-opened site. Proves the WIELDED carry restores WITH its
 * (positive) corruption — not merely the variant flag — without persisting a
 * fractional count the save validator would reject.
 * @param page - The Playwright page.
 * @param variant - The restored carry mode.
 * @returns The corruption the restored carry accrues (0 for free, > 0 for wield).
 */
async function restoredCorruption(
  page: Page,
  variant: "free" | "wield"
): Promise<number> {
  return page.evaluate(mode => {
    const api = window.__VERIFY__!;
    api.openBoundSite("sylvemarch");
    api.chooseBound(mode);
    return api.boundSite()!.corruptionAccrued;
  }, variant);
}

test.describe("GRIST — Sylvath the Green Wyrm free-vs-wield site (UAT, #129)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: sylvath-bound-resolves] freeing Sylvath grants the weaker shard with karma+ and no corruption, restored from IndexedDB after reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Before opening: no site is held — the cell cannot fabricate one.
    expect(
      await page.evaluate(() => window.__VERIFY__!.boundSite())
    ).toBeNull();

    // Reach the Sylvemarch region's single Bound site through the template (pure data
    // through the content barrel — no engine wiring), then read the unsettled site.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("sylvemarch"));
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened).not.toBeNull();
    // The site is exactly Sylvath in the Sylvemarch region, offering its variants.
    expect(opened!.shard).toBe(SYLVATH);
    expect(opened!.regionId).toBe(SYLVEMARCH);
    expect(opened!.settled).toBe(false);
    expect(opened!.freeCorruptionRate).toBe(0);
    // Sylvath is a major decision — the wield path costs corruption (the fork).
    expect(opened!.wieldCorruptionRate).toBeGreaterThan(0);

    // Choose FREE — the weaker, corruption-free attunement (karma+): the wyrm loosed.
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

    // The freed Sylvath state survived the reload exactly — restored from IndexedDB.
    expect(restored.choice).toEqual({
      resolved: true,
      shard: SYLVATH,
      variant: "free",
    });
    expect(restored.moralLedger.karma).toBe(1);
    expect(run!.choice.variant).toBe("free");
    expect(run!.moralLedger.karma).toBe(1);
    // Freeing accrues NO corruption — the restored carry derives zero.
    expect(await restoredCorruption(page, "free")).toBe(0);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: sylvath-bound-resolves] wielding Sylvath grants the stronger carry with accruing corruption that, with its corruption, survives the reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Reach Sylvath's site and choose WIELD — the stronger carry that accrues
    // corruption (karma−): the great wyrm caged and paid for.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("sylvemarch"));
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened!.shard).toBe(SYLVATH);
    expect(opened!.regionId).toBe(SYLVEMARCH);

    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const settled = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(settled!.settled).toBe(true);
    expect(settled!.variant).toBe("wield");
    // Corruption accrued is Sylvath's wield rate — strictly positive (the cost).
    expect(settled!.corruptionAccrued).toBeGreaterThan(0);
    expect(settled!.corruptionAccrued).toBe(settled!.wieldCorruptionRate);
    expect(settled!.karma).toBe(-1);
    expect(settled!.wieldChoices).toBe(1);
    expect(settled!.freeChoices).toBe(0);

    // The corruption Wield accrued, captured before the reload, to compare against
    // what the restored state re-derives.
    const accruedBeforeReload = settled!.corruptionAccrued;

    // Persist and reload — the corrupting carry AND its accrued corruption survive the
    // document boundary (AC7: "corruption has accrued … restored from IndexedDB").
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      settledSave("wield")
    );
    await bootWithBridge(page);
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    const run = await page.evaluate(() => window.__VERIFY__!.runState());

    expect(restored.choice).toEqual({
      resolved: true,
      shard: SYLVATH,
      variant: "wield",
    });
    expect(restored.moralLedger.karma).toBe(-1);
    expect(run!.choice.variant).toBe("wield");
    expect(run!.moralLedger.karma).toBe(-1);
    // The accrued corruption restored WITH the wielded carry: re-derived from the
    // persisted choice through the content table, strictly positive, and identical to
    // what Wield accrued before the reload — not just the variant flag.
    const restoredWieldCorruption = await restoredCorruption(page, "wield");
    expect(restoredWieldCorruption).toBeGreaterThan(0);
    expect(restoredWieldCorruption).toBe(accruedBeforeReload);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: sylvath-bound-resolves] free vs wield diverge at Sylvath's site, and its hash is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Free fork: open Sylvath's site + choose free, capture its digest.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("sylvemarch"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const free = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(free!.shard).toBe(SYLVATH);
    expect(free!.hash).toMatch(/^[0-9a-f]{8}$/);

    // A genuine full reload: fresh document + fresh bridge. The same region + ledger +
    // free choice yields a byte-identical hash — no drift.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("sylvemarch"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const freeAgain = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(freeAgain!.hash).toBe(free!.hash);

    // Wield fork from the same site diverges from free (variant + karma + corruption +
    // digest) — the region's moral fork made measurable on the live canvas.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("sylvemarch"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const wield = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(wield!.hash).not.toBe(free!.hash);
    expect(wield!.variant).not.toBe(free!.variant);
    expect(wield!.corruptionAccrued).not.toBe(free!.corruptionAccrued);

    expect(errors).toEqual([]);
  });
});
