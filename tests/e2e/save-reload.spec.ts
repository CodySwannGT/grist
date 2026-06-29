/**
 * Save-persistence verification (UAT) suite — the Validation Journey for #87.
 * Drives the real {@link import("../../src/services/save-service").SaveService}
 * through the in-game `window.__VERIFY__` bridge to prove, empirically against
 * the live build and a real browser IndexedDB, the issue's two persistence
 * acceptance criteria:
 *
 * - [save-roundtrip-reload] (AC7) a slice-in-progress snapshot — party, grist,
 *   inventory, learned/learning, shard choice, moralLedger, and the rng lineage —
 *   is saved, the page is fully reloaded, and every field is restored exactly
 *   from IndexedDB.
 * - [save-moral-choice] (AC5) the resolved free-or-wield choice (the shard variant
 *   plus the moralLedger / karma flag) survives the same save→reload cycle.
 *
 * The reload is a genuine `page.goto` (a fresh document and a fresh `SaveService`
 * reading the same on-disk database), so this is the "save → reload → restored
 * from IndexedDB" definition of done — not an in-memory round-trip (that is
 * covered exhaustively by the unit + fake-indexeddb suites). The bridge is enabled
 * with `?uat=1`; the scene is irrelevant to persistence, so the default boot is
 * used and the battle/field specs are untouched.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/**
 * The serialized save shape the bridge round-trips. Kept structurally aligned
 * with the current `CurrentSave` (now v2, carrying the world-state flag #134) but
 * declared locally so the spec needs no app import.
 */
interface SaveDataV2 {
  // The literal `2` (not `number`) so this structural shape is assignable to the
  // app's versioned `CurrentSave` the `__VERIFY__.save` bridge expects.
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
 * A representative slice-in-progress snapshot exercising every persisted axis:
 * a grown party member carrying a wielded shard, a spent grist wallet, inventory,
 * learned + in-progress-learning spells, a resolved free-or-wield choice with its
 * moral ledger, and a non-trivial rng lineage.
 */
const SLICE_IN_PROGRESS: SaveDataV2 = {
  version: 2,
  party: [{ id: "wren", level: 4, shard: "emberwisp", shardMode: "wield" }],
  grist: 7,
  inventory: [{ id: "salve", qty: 3 }],
  learned: ["cinder", "ashfall"],
  learning: [{ spell: "renderburst", progress: 0.375 }],
  choice: { resolved: true, shard: "marrow-bound", variant: "wield" },
  moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
  rng: { seed: 12345, state: 987654321 },
  worldState: "reach",
};

/**
 * Wait until the verification bridge is installed on `window` with its **full**
 * persistence contract present (`save` / `loadSave` / `hasSave` / `clearSave`).
 * The bridge is attached at bootstrap when `?uat=1` is present, so this also
 * confirms the page loaded. Asserting the whole shape up front means the calls
 * below can invoke the methods directly — a broken bridge fails here, loudly,
 * instead of silently no-op'ing through an optional chain and leaking prior
 * IndexedDB state into a later assertion.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.save === "function" &&
            typeof api?.loadSave === "function" &&
            typeof api?.hasSave === "function" &&
            typeof api?.clearSave === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the save
 * bridge does not depend on the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

test.describe("GRIST — save persistence verification (UAT)", () => {
  test.beforeEach(async ({ page }) => {
    // Start each test from a clean store so a prior run never leaks into the
    // reload assertion. The bridge contract is asserted in waitForBridge, so the
    // method is invoked directly (a missing bridge would have already failed).
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[save-roundtrip-reload] AC7: a slice in progress is restored exactly after a page reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Persist the in-progress slice, then assert the write committed.
    const saved = await page.evaluate(
      save => window.__VERIFY__!.save(save),
      SLICE_IN_PROGRESS
    );
    expect(saved).toBe(true);
    expect(await page.evaluate(() => window.__VERIFY__!.hasSave())).toBe(true);

    // A genuine full reload: a new document and a new SaveService reading the
    // same on-disk IndexedDB — the real "reopen the game" boundary.
    await bootWithBridge(page);

    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    expect(restored).toEqual(SLICE_IN_PROGRESS);

    // The rng lineage in particular must come back verbatim (determinism): the
    // seed/state are persisted as data, never regenerated.
    expect(restored?.rng).toEqual({ seed: 12345, state: 987654321 });
    expect(errors).toEqual([]);
  });

  test("[save-moral-choice] AC5: the resolved free-or-wield choice + moral ledger survive the reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await page.evaluate(
      save => window.__VERIFY__!.save(save),
      SLICE_IN_PROGRESS
    );

    await bootWithBridge(page);

    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    // The shard variant the player committed to survives.
    expect(restored?.choice).toEqual({
      resolved: true,
      shard: "marrow-bound",
      variant: "wield",
    });
    // The moral ledger / karma flag the slice's thesis turns on survives.
    expect(restored?.moralLedger).toEqual({
      karma: -1,
      freeChoices: 0,
      wieldChoices: 1,
    });
    expect(errors).toEqual([]);
  });
});
