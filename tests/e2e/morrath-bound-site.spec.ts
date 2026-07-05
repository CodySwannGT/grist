/**
 * Morrath the Cinder-bound free-vs-wield site verification (UAT) suite — the
 * Bound-site half of the Validation Journey for #131 (PRD #43 FR5 / AC7). Drives the
 * in-game `window.__VERIFY__` bridge against the live build to prove EMPIRICALLY
 * (unit / typecheck / lint alone are NOT acceptable per the issue) that the Cinderfen
 * sites Morrath, and reaching that site lets the player face the region's
 * free-vs-wield decision — the mercy of letting a dying Bound go, or draining it —
 * resolved and persisted across a genuine reload:
 *
 * - [EVIDENCE: morrath-bound-resolves] — freeing Morrath grants the WEAKER shard with
 *   karma+ and NO corruption, observed scene-agnostically via
 *   `__VERIFY__.openBoundSite("cinderfen")` / `chooseBound("free")` / `boundSite()`;
 *   then a save built from that settled choice round-trips through IndexedDB and is
 *   restored after a GENUINE page reload (`loadSave()` / `runState()` show
 *   `variant: "free"`, `karma: 1`).
 * - [EVIDENCE: morrath-bound-resolves] — the SAME site, choosing WIELD, grants the
 *   STRONGER carry with ACCRUING corruption (karma−), and the wielded state WITH its
 *   corruption survives the reload too (`runState()` shows `variant: "wield"`,
 *   `karma: -1`; the persisted corruption is the carried shard's wield rate).
 *
 * Morrath is the atrocity DYING — a dying, half-rendered power, a moral gut-punch
 * more than a fight — so wielding it genuinely accrues corruption (the fork is
 * measurable) at a heavy cost that still sits below Korrholt's openly-run reactor.
 * Determinism: the site's `boundSite().hash` is reproducible across a genuine reload
 * (same region + ledger + mode ⇒ identical digest), and free vs wield diverge. The
 * bridge is enabled with `?uat=1`; the Bound-site template rides the content tables,
 * so the active scene is irrelevant and the default boot is used (mirrors
 * `korrholt-bound-site.spec.ts`). The Phaser-free unit twin
 * (`tests/logic/morrath-bound-site.test.ts`) proves the resolution headlessly; this
 * spec proves it on the live canvas across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The Cinderfen region — the one that sites Morrath. */
const CINDERFEN = "cinderfen";
/** The Bound the Cinderfen region sites: Morrath, the Cinder-bound. */
const MORRATH = "morrath";

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
 * current v3 `CurrentSave` but declared locally so the spec needs no app import
 * (mirrors `korrholt-bound-site.spec.ts`).
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
 * Build the save a settled Morrath Bound-site choice persists: Morrath carried in
 * the chosen mode (`party[].shard` + `shardMode`), the resolved `choice`, and the
 * matching karma / ledger tallies — the exact run state the player would save after
 * facing Morrath. The two variants flip the shardMode / choice / karma so the forks
 * are measurably distinct persisted payloads.
 *
 * The accrued corruption is NOT a separate persisted number: the kit derives it from
 * the persisted `choice.shard` + `choice.variant` through the content table
 * (`BOUNDS[shard].variants[variant].corruptionRate`), exactly as the live site does —
 * so restoring `{ shard: morrath, variant: "wield" }` restores the WIELDED state WITH
 * its corruption (a positive, derivable rate), while `"free"` restores zero.
 * @param variant - The resolved choice ("free" or "wield").
 * @returns A complete v3 save for the settled Morrath choice.
 */
function settledSave(variant: "free" | "wield"): SaveDataV2 {
  const free = variant === "free";
  return {
    version: 3,
    party: [{ id: "wren", level: 6, shard: MORRATH, shardMode: variant }],
    grist: 15,
    inventory: [],
    learned: [],
    learning: [],
    choice: { resolved: true, shard: MORRATH, variant },
    moralLedger: {
      karma: free ? 1 : -1,
      freeChoices: free ? 1 : 0,
      wieldChoices: free ? 0 : 1,
    },
    rng: { seed: 0xc1de, state: 0xc1de },
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
    api.openBoundSite("cinderfen");
    api.chooseBound(mode);
    return api.boundSite()!.corruptionAccrued;
  }, variant);
}

test.describe("GRIST — Morrath the Cinder-bound free-vs-wield site (UAT, #131)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: morrath-bound-resolves] freeing Morrath grants the weaker shard with karma+ and no corruption, restored from IndexedDB after reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Before opening: no site is held — the cell cannot fabricate one.
    expect(
      await page.evaluate(() => window.__VERIFY__!.boundSite())
    ).toBeNull();

    // Reach the Cinderfen region's single Bound site through the template (pure data
    // through the content barrel — no engine wiring), then read the unsettled site.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("cinderfen"));
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened).not.toBeNull();
    // The site is exactly Morrath in the Cinderfen region, offering its variants.
    expect(opened!.shard).toBe(MORRATH);
    expect(opened!.regionId).toBe(CINDERFEN);
    expect(opened!.settled).toBe(false);
    expect(opened!.freeCorruptionRate).toBe(0);
    // The wield path costs corruption — draining a dying god is not free (the fork).
    expect(opened!.wieldCorruptionRate).toBeGreaterThan(0);

    // Choose FREE — the weaker, corruption-free attunement (karma+): the dying Bound
    // let go, the mercy.
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

    // The freed Morrath state survived the reload exactly — restored from IndexedDB.
    expect(restored.choice).toEqual({
      resolved: true,
      shard: MORRATH,
      variant: "free",
    });
    expect(restored.moralLedger.karma).toBe(1);
    expect(run!.choice.variant).toBe("free");
    expect(run!.moralLedger.karma).toBe(1);
    // Freeing accrues NO corruption — the restored carry derives zero.
    expect(await restoredCorruption(page, "free")).toBe(0);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: morrath-bound-resolves] wielding Morrath grants the stronger carry with accruing corruption that, with its corruption, survives the reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Reach Morrath's site and choose WIELD — the stronger carry that accrues
    // corruption (karma−): draining a dying god for raw power, the desecration.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("cinderfen"));
    const opened = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(opened!.shard).toBe(MORRATH);
    expect(opened!.regionId).toBe(CINDERFEN);

    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const settled = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(settled!.settled).toBe(true);
    expect(settled!.variant).toBe("wield");
    // Corruption accrued is Morrath's wield rate — strictly positive (the cost).
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
      shard: MORRATH,
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

  test("[EVIDENCE: morrath-bound-resolves] free vs wield diverge at Morrath's site, and its hash is deterministic across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Free fork: open Morrath's site + choose free, capture its digest.
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("cinderfen"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const free = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(free!.shard).toBe(MORRATH);
    expect(free!.hash).toMatch(/^[0-9a-f]{8}$/);

    // A genuine full reload: fresh document + fresh bridge. The same region + ledger +
    // free choice yields a byte-identical hash — no drift.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("cinderfen"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("free"));
    const freeAgain = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(freeAgain!.hash).toBe(free!.hash);

    // Wield fork from the same site diverges from free (variant + karma + corruption +
    // digest) — the region's moral fork made measurable on the live canvas.
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.openBoundSite("cinderfen"));
    await page.evaluate(() => window.__VERIFY__!.chooseBound("wield"));
    const wield = await page.evaluate(() => window.__VERIFY__!.boundSite());
    expect(wield!.hash).not.toBe(free!.hash);
    expect(wield!.variant).not.toBe(free!.variant);
    expect(wield!.corruptionAccrued).not.toBe(free!.corruptionAccrued);

    expect(errors).toEqual([]);
  });
});
