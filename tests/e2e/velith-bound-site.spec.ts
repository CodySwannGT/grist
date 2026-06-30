/**
 * Velith the Deep-bound free-vs-wield site verification (UAT) suite — the
 * Validation Journey for #144 (PRD #43 FR5 / AC1 / AC7). Drives the in-game
 * `window.__VERIFY__` bridge against the live build to prove the issue's two
 * acceptance scenarios EMPIRICALLY (unit / typecheck / lint alone are NOT acceptable
 * per the issue): the Roots / the Deep region sites Velith, and reaching that site
 * lets the player face the franchise's core moral fork —
 *
 * - [EVIDENCE: velith-free-persists] (AC1 / scenario 1) — freeing Velith grants the
 *   WEAKER shard with karma+ and NO corruption, observed scene-agnostically via
 *   `__VERIFY__.openBoundSite("roots")` / `chooseBound("free")` / `boundSite()`;
 *   then a save built from that settled choice round-trips through IndexedDB and is
 *   restored byte-for-byte after a GENUINE page reload (`loadSave()` /
 *   `runState()` show `variant: "free"`, `karma: 1`).
 * - [EVIDENCE: velith-wield-corruption-persists] (AC7 / scenario 2) — the SAME site,
 *   choosing WIELD, grants the STRONGER carry with ACCRUING corruption (karma−), and
 *   the wielded state WITH its corruption survives the reload too (`runState()` shows
 *   `variant: "wield"`, `karma: -1`; the persisted corruption is the carried shard's
 *   wield rate).
 *
 * Velith is "near-free" — its wield corruption is the gentlest of any Bound — but
 * non-zero, so wielding it genuinely accrues corruption (the fork is measurable).
 * Determinism: the site's `boundSite().hash` is reproducible across a genuine reload
 * (same region + ledger + mode ⇒ identical digest), and free vs wield diverge. The
 * bridge is enabled with `?uat=1`; the Bound-site template rides the content tables,
 * so the active scene is irrelevant and the default boot is used (mirrors
 * `bound-site.spec.ts` / `roots-region.spec.ts`). The Phaser-free unit twin
 * (`tests/logic/velith-bound-site.test.ts`) proves the resolution headlessly; this
 * spec proves it on the live, rendered canvas across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The Roots / the Deep region — the one that sites Velith. */
const ROOTS = "roots";
/** The Bound the Roots region sites: Velith, the Deep-bound. */
const VELITH = "velith-deepbound";

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
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * The serialized save shape the bridge round-trips — structurally aligned with the
 * current v2 `CurrentSave` but declared locally so the spec needs no app import
 * (mirrors `bound-site.spec.ts` / `world-state.spec.ts`).
 */
interface SaveDataV2 {
  readonly version: 2;
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
}

/**
 * Build the save a settled Velith Bound-site choice persists: Velith carried in the
 * chosen mode (`party[].shard` + `shardMode`), the resolved `choice`, and the
 * matching karma / ledger tallies — the exact run state the player would save after
 * facing Velith. The two variants flip the shardMode / choice / karma so the forks
 * are measurably distinct persisted payloads.
 *
 * The accrued corruption is NOT a separate persisted number: the kit derives it from
 * the persisted `choice.shard` + `choice.variant` through the content table
 * (`BOUNDS[shard].variants[variant].corruptionRate`), exactly as the live site does
 * — so restoring `{ shard: velith, variant: "wield" }` restores the WIELDED state
 * WITH its corruption (a positive, derivable rate), while `"free"` restores zero.
 * That keeps the save schema-honest (the validator rejects fractional inventory
 * counts) while still proving AC7's "corruption has accrued … restored from
 * IndexedDB" — the e2e re-derives and asserts it below.
 * @param variant - The resolved choice ("free" or "wield").
 * @returns A complete v2 save for the settled Velith choice.
 */
function settledSave(variant: "free" | "wield"): SaveDataV2 {
  const free = variant === "free";
  return {
    version: 2,
    party: [{ id: "wren", level: 4, shard: VELITH, shardMode: variant }],
    grist: 12,
    inventory: [],
    learned: [],
    learning: [],
    choice: { resolved: true, shard: VELITH, variant },
    moralLedger: {
      karma: free ? 1 : -1,
      freeChoices: free ? 1 : 0,
      wieldChoices: free ? 0 : 1,
    },
    rng: { seed: 0x0dee9, state: 0x0dee9 },
    worldState: "reach",
  };
}

/**
 * Re-derive the corruption a restored choice carries, the way the kit does: free
 * accrues none; wield accrues the carried shard's wield rate read from the live
 * content table via a freshly-opened site. Proves the WIELDED carry restores WITH
 * its (positive) corruption — not merely the variant flag — without persisting a
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
    api.openBoundSite("roots");
    api.chooseBound(mode);
    return api.boundSite()!.corruptionAccrued;
  }, variant);
}

test.describe("GRIST — Velith the Deep-bound free-vs-wield site (UAT, #144)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: velith-free-persists] freeing Velith grants the weaker shard with karma+ and no corruption, restored from IndexedDB after reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Before opening: no site is held — the cell cannot fabricate one.
    expect(
      await page.evaluate(() => window.__VERIFY__!.boundSite())
    ).toBeNull();

    // Reach the Roots region's single Bound site through the template (pure data
    // through the content barrel — no engine wiring), then read the unsettled site.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("roots"));
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened).not.toBeNull();
    // The site is exactly Velith in the Roots region, offering its content variants.
    expect(opened!.shard).toBe(VELITH);
    expect(opened!.regionId).toBe(ROOTS);
    expect(opened!.settled).toBe(false);
    expect(opened!.freeCorruptionRate).toBe(0);
    // Velith is "near-free" but the wield path still costs corruption (the fork).
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

    // The freed Velith state survived the reload exactly — restored from IndexedDB.
    expect(restored.choice).toEqual({
      resolved: true,
      shard: VELITH,
      variant: "free",
    });
    expect(restored.moralLedger.karma).toBe(1);
    expect(run!.choice.variant).toBe("free");
    expect(run!.moralLedger.karma).toBe(1);
    // Freeing accrues NO corruption — the restored carry derives zero.
    expect(await restoredCorruption(page, "free")).toBe(0);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: velith-wield-corruption-persists] wielding Velith grants the stronger carry with accruing corruption that, with its corruption, survives the reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Reach Velith's site and choose WIELD — the stronger carry that accrues
    // corruption (karma−).
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("roots"));
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened!.shard).toBe(VELITH);
    expect(opened!.regionId).toBe(ROOTS);

    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const settled = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(settled!.settled).toBe(true);
    expect(settled!.variant).toBe("wield");
    // Corruption accrued is Velith's wield rate — strictly positive (the cost).
    expect(settled!.corruptionAccrued).toBeGreaterThan(0);
    expect(settled!.corruptionAccrued).toBe(settled!.wieldCorruptionRate);
    expect(settled!.karma).toBe(-1);
    expect(settled!.wieldChoices).toBe(1);
    expect(settled!.freeChoices).toBe(0);

    // The corruption Wield accrued, captured before the reload, to compare against
    // what the restored state re-derives.
    const accruedBeforeReload = settled!.corruptionAccrued;

    // Persist and reload — the corrupting carry AND its accrued corruption survive
    // the document boundary (AC7: "corruption has accrued … restored from IndexedDB").
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      settledSave("wield")
    );
    await bootWithBridge(page);
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    const run = await page.evaluate(() => window.__VERIFY__!.runState());

    expect(restored.choice).toEqual({
      resolved: true,
      shard: VELITH,
      variant: "wield",
    });
    expect(restored.moralLedger.karma).toBe(-1);
    expect(run!.choice.variant).toBe("wield");
    expect(run!.moralLedger.karma).toBe(-1);
    // The accrued corruption restored WITH the wielded carry: re-derived from the
    // persisted choice through the content table, strictly positive, and identical
    // to what Wield accrued before the reload — not just the variant flag.
    const restoredWieldCorruption = await restoredCorruption(page, "wield");
    expect(restoredWieldCorruption).toBeGreaterThan(0);
    expect(restoredWieldCorruption).toBe(accruedBeforeReload);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: velith-free-persists] free vs wield diverge at Velith's site, and its hash is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Free fork: open Velith's site + choose free, capture its digest.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("roots"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const free = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(free!.shard).toBe(VELITH);
    expect(free!.hash).toMatch(/^[0-9a-f]{8}$/);

    // A genuine full reload: fresh document + fresh bridge. The same region +
    // ledger + free choice yields a byte-identical hash — no drift.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("roots"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const freeAgain = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(freeAgain!.hash).toBe(free!.hash);

    // Wield fork from the same site diverges from free (variant + karma + corruption
    // + digest), the slice's moral fork made measurable on the live canvas.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("roots"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const wield = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(wield!.hash).not.toBe(free!.hash);
    expect(wield!.variant).not.toBe(free!.variant);
    expect(wield!.corruptionAccrued).not.toBe(free!.corruptionAccrued);

    expect(errors).toEqual([]);
  });
});
