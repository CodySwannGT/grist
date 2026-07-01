/**
 * Traversal + fast-travel + soft-gate verification (UAT) suite — the Validation
 * Journey for #136 (PRD #43 FR4 / Scope-IN 3 / AC4). Drives the in-game
 * `window.__VERIFY__` bridge against the live build to prove the issue's two
 * acceptance scenarios empirically (unit tests / lint / typecheck alone are NOT
 * acceptable):
 *
 * - [traversal-tier-unlocks] (AC scenario 1) the earned-freedom mobility chain
 *   unlocks in the authored order — the skiff opens regional travel and the airship
 *   opens the full Reach, each gated by capability/knowledge rather than a clock —
 *   observed in-memory via `__VERIFY__.earnSkiff()` / `earnAirship()` / `travel()`.
 * - [fast-travel-deducts-grist] (AC scenario 2) fast-travel between two discovered
 *   safehouses deducts grist from the shared wallet, and a hop with insufficient
 *   grist is refused with the balance unchanged.
 *
 * Determinism: the same action sequence reproduces an identical `travel().hash`
 * progression across two runs (the issue's "same seed + same actions ⇒ identical
 * `__VERIFY__.hash()`" assertion, on the scene-agnostic travel cell). The bridge is
 * enabled with `?uat=1`; the mobility chain is scene-agnostic (a bridge-held cell
 * delegating to `logic/travel`), so the default boot is used — mirroring
 * `world-state.spec.ts` (#134).
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

// Two distinct safehouses the e2e discovers and hops between. Opaque ids — the
// service treats a safehouse as any string the content layer authors later.
const MARROW = "marrow-safehouse";
const VALE = "vale-safehouse";

/**
 * The serialized save shape the bridge round-trips. Structurally aligned with the
 * current `CurrentSave` (v2) but declared locally so the spec needs no app import —
 * mirroring `world-state.spec.ts` / `verify-bridge-run-state.spec.ts`.
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
 * A minimal but complete v2 save seeding the **shared grist wallet** at a chosen
 * balance, so `runState()` is non-null and reports that wallet — the balance a
 * fast-travel hop must draw down (proving the single-shared-wallet contract, #136).
 * @param grist - The shared wallet balance to seed.
 * @returns A complete v2 save at the given grist.
 */
function saveWithGrist(grist: number): SaveDataV2 {
  return {
    version: 3,
    party: [{ id: "wren", level: 1 }],
    grist,
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

/**
 * Wait until the verification bridge is installed with its **travel** contract
 * present (plus the run-state/save seam used to assert the shared wallet). Asserting
 * the whole shape up front means a broken bridge fails here, loudly, instead of
 * silently no-op'ing through an optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.earnSkiff === "function" &&
            typeof api?.earnAirship === "function" &&
            typeof api?.discoverSafehouse === "function" &&
            typeof api?.fastTravel === "function" &&
            typeof api?.travel === "function" &&
            typeof api?.clearSave === "function" &&
            typeof api?.save === "function" &&
            typeof api?.runState === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the mobility
 * chain rides a bridge-held cell, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

test.describe("GRIST — traversal + fast-travel verification (UAT)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    // Reset the travel cell to a fresh foot-tier run (known origin).
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[traversal-tier-unlocks] tiers unlock in the authored order, gated by capability not a clock", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // On foot: only local travel; regional and full-Reach are gated.
    const onFoot = await page.evaluate(() => window.__VERIFY__!.travel());
    expect(onFoot.tier).toBe("foot");
    expect(onFoot.canRegional).toBe(false);
    expect(onFoot.canFullReach).toBe(false);

    // Earning the airship BEFORE the skiff is refused — the chain is gated by the
    // authored order (capability), never a clock. The state stays on foot.
    await page.evaluate(() => window.__VERIFY__!.earnAirship());
    const stillFoot = await page.evaluate(() => window.__VERIFY__!.travel());
    expect(stillFoot.tier).toBe("foot");
    expect(stillFoot.canFullReach).toBe(false);

    // Earn the skiff → regional travel opens.
    await page.evaluate(() => window.__VERIFY__!.earnSkiff());
    const withSkiff = await page.evaluate(() => window.__VERIFY__!.travel());
    expect(withSkiff.tier).toBe("skiff");
    expect(withSkiff.canRegional).toBe(true);
    expect(withSkiff.canFullReach).toBe(false);

    // Earn the airship (now after the skiff) → the full Reach opens.
    await page.evaluate(() => window.__VERIFY__!.earnAirship());
    const withAirship = await page.evaluate(() => window.__VERIFY__!.travel());
    expect(withAirship.tier).toBe("airship");
    expect(withAirship.canRegional).toBe(true);
    expect(withAirship.canFullReach).toBe(true);

    expect(errors).toEqual([]);
  });

  test("[fast-travel-deducts-grist] fast-travel deducts grist; an insufficient-grist hop is refused unchanged", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Seed the SHARED grist wallet via a persisted save so runState() reports it.
    // The fast-travel spend must draw down THIS wallet (the single-shared-wallet
    // contract), not a private balance hidden inside the travel cell.
    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      saveWithGrist(10)
    );
    const seededRun = await page.evaluate(() => window.__VERIFY__!.runState());
    expect(seededRun?.grist).toBe(10);
    // The travel snapshot reads the SAME shared wallet the run-state reports.
    const seededTravel = await page.evaluate(() => window.__VERIFY__!.travel());
    expect(seededTravel.grist).toBe(10);

    // Reach the fast-travel capability: airship + two discovered safehouses.
    await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.earnSkiff();
      api.earnAirship();
      api.discoverSafehouse("marrow-safehouse");
      api.discoverSafehouse("vale-safehouse");
    });
    const ready = await page.evaluate(() => window.__VERIFY__!.travel());
    expect(ready.canFastTravel).toBe(true);

    // Capture the SHARED run-state wallet before the hop.
    const runBefore = await page.evaluate(() => window.__VERIFY__!.runState());
    const startGrist = runBefore!.grist;
    expect(startGrist).toBe(10);

    // A successful hop deducts grist and relocates the party. Assert the deduction
    // landed on the SHARED wallet that runState() reports — not just the travel
    // snapshot — so a private bridge-local wallet could not make this pass.
    const spent = await page.evaluate(
      ({ from, to }) => window.__VERIFY__!.fastTravel(from, to),
      { from: MARROW, to: VALE }
    );
    expect(spent).toBeGreaterThan(0);
    const afterHopTravel = await page.evaluate(() =>
      window.__VERIFY__!.travel()
    );
    const afterHopRun = await page.evaluate(() =>
      window.__VERIFY__!.runState()
    );
    expect(afterHopTravel.grist).toBe(startGrist - spent);
    expect(afterHopTravel.location).toBe(VALE);
    // THE shared wallet decreased by exactly the spend (the integration proof).
    expect(afterHopRun!.grist).toBe(startGrist - spent);
    expect(afterHopRun!.grist).toBe(afterHopTravel.grist);

    // Drain the shared wallet below the hop cost, then assert an insufficient-grist
    // hop is REFUSED with the SHARED balance unchanged (the edge path).
    await page.evaluate(
      ({ from, to }) => {
        // Keep hopping until the next hop would be unaffordable.
        let guard = 0;
        while (window.__VERIFY__!.travel().grist >= 4 && guard < 10) {
          window.__VERIFY__!.fastTravel(to, from);
          window.__VERIFY__!.fastTravel(from, to);
          guard += 1;
        }
      },
      { from: MARROW, to: VALE }
    );
    const drainedRun = await page.evaluate(() => window.__VERIFY__!.runState());
    expect(drainedRun!.grist).toBeLessThan(4);

    const balanceBefore = drainedRun!.grist;
    const refusedSpend = await page.evaluate(
      ({ from, to }) => window.__VERIFY__!.fastTravel(from, to),
      { from: MARROW, to: VALE }
    );
    expect(refusedSpend).toBe(0);
    const afterRefusalRun = await page.evaluate(() =>
      window.__VERIFY__!.runState()
    );
    const afterRefusalTravel = await page.evaluate(() =>
      window.__VERIFY__!.travel()
    );
    // The SHARED wallet is untouched by the refused hop.
    expect(afterRefusalRun!.grist).toBe(balanceBefore);
    expect(afterRefusalTravel.grist).toBe(balanceBefore);

    expect(errors).toEqual([]);
  });

  test("[determinism] the same action sequence reproduces an identical hash progression", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    /**
     * Drive a fixed mobility sequence from a fresh cell and collect the per-step
     * determinism digests. Resets first so the run starts from the known origin.
     * @returns The ordered digests after each step.
     */
    const driveSequence = (): Promise<readonly string[]> =>
      page.evaluate(async () => {
        const api = window.__VERIFY__!;
        await api.clearSave();
        const digests: string[] = [api.travel().hash];
        api.earnSkiff();
        digests.push(api.travel().hash);
        api.earnAirship();
        digests.push(api.travel().hash);
        api.discoverSafehouse("marrow-safehouse");
        api.discoverSafehouse("vale-safehouse");
        digests.push(api.travel().hash);
        api.fastTravel("marrow-safehouse", "vale-safehouse");
        digests.push(api.travel().hash);
        return digests;
      });

    const firstRun = await driveSequence();
    const secondRun = await driveSequence();

    // Same actions ⇒ identical hash progression, and each step changed the digest.
    expect(secondRun).toEqual(firstRun);
    expect(new Set(firstRun).size).toBe(firstRun.length);

    expect(errors).toEqual([]);
  });
});
