/**
 * Save-persistence verification (UAT) suite — the Validation Journey for #87.
 * Drives the real {@link import("../../src/services/save-service").SaveService}
 * through the in-game `window.__VERIFY__` bridge to prove, empirically against
 * the live build and a real browser IndexedDB, the issue's two persistence
 * acceptance criteria:
 *
 * - [save-roundtrip-reload] (AC7) a slice-in-progress snapshot — party, grist,
 *   inventory, learned/learning, shard choice, moralLedger, the rng lineage, and
 *   (added #116) the character build + scene progress — is saved, the page is
 *   fully reloaded, and every field is restored exactly from IndexedDB.
 * - [save-moral-choice] (AC5) the resolved free-or-wield choice (the shard variant
 *   plus the moralLedger / karma flag) survives the same save→reload cycle.
 * - [save-growth-persists] (#116 AC: "Growth persists") a character build grown
 *   before a reload — the bench stat augments + equipped shards — is exactly what
 *   the post-reload run loads, so the growth carries into a later battle.
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
 * with the current `CurrentSave` (now v3: the world-state flag #134, plus the
 * character build and scene progress #116) but declared locally so the spec needs
 * no app import.
 */
interface SaveDataV3 {
  // The literal `3` (not `number`) so this structural shape is assignable to the
  // app's versioned `CurrentSave` the `__VERIFY__.save` bridge expects.
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
  // The persisted character build (#116): the bench stat augments + equipped
  // shards the "growth persists" AC requires to survive a reload into battle.
  readonly build: {
    readonly statBonuses: Readonly<Record<string, number>>;
    readonly equippedShards: readonly string[];
  };
  // The persisted scene progress (#116): the narrative cursor + flag ledger, or
  // null before any scene is entered.
  readonly scene: {
    readonly sceneId: string;
    readonly nodeId: string;
    readonly flags: Readonly<Record<string, boolean | string | number>>;
  } | null;
}

/**
 * A representative slice-in-progress snapshot exercising every persisted axis:
 * a grown party member carrying a wielded shard, a spent grist wallet, inventory,
 * learned + in-progress-learning spells, a resolved free-or-wield choice with its
 * moral ledger, a non-trivial rng lineage, the character build (#116: a
 * bench-bought +3 SPD / +1 POW augment and two equipped shards — the growth that
 * must persist into a later battle), and a mid-story scene cursor + flag ledger.
 */
const SLICE_IN_PROGRESS: SaveDataV3 = {
  version: 3,
  party: [{ id: "wren", level: 4, shard: "emberwisp", shardMode: "wield" }],
  grist: 7,
  inventory: [{ id: "salve", qty: 3 }],
  learned: ["cinder", "ashfall"],
  learning: [{ spell: "renderburst", progress: 0.375 }],
  choice: { resolved: true, shard: "marrow-bound", variant: "wield" },
  moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
  rng: { seed: 12345, state: 987654321 },
  worldState: "reach",
  build: {
    statBonuses: { spd: 3, pow: 1 },
    equippedShards: ["emberwisp", "marrow-bound"],
  },
  scene: {
    sceneId: "ch1-marrow",
    nodeId: "node-12",
    flags: { metWren: true, shardChoice: "wield", visits: 2 },
  },
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
    // The #116 axes — character build + scene progress — come back exactly too.
    expect(restored?.build).toEqual({
      statBonuses: { spd: 3, pow: 1 },
      equippedShards: ["emberwisp", "marrow-bound"],
    });
    expect(restored?.scene).toEqual({
      sceneId: "ch1-marrow",
      nodeId: "node-12",
      flags: { metWren: true, shardChoice: "wield", visits: 2 },
    });
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

  test('[save-growth-persists] #116 AC "Growth persists": a build grown before a reload is exactly what a later battle loads', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Baseline (cleared store from beforeEach → empty build): the SPD the lead
    // combatant fields in a live battle with NO build grown yet. Read from the real
    // combat engine through the bridge so the proof below needs no hardcoded base
    // stat — the +5 is measured as a delta against the game's own base.
    const SPD_AUGMENT = 5;
    const baseline = await page.evaluate(() => window.__VERIFY__!.build());
    const baseSpd = baseline.battleParty[0]!.stats.spd;

    // A growth change: the bench buys a +5 SPD augment and equips a fresh shard —
    // a build measurably different from the slice baseline.
    const grown: SaveDataV3 = {
      ...SLICE_IN_PROGRESS,
      build: {
        statBonuses: { spd: SPD_AUGMENT },
        equippedShards: ["velith-deepbound"],
      },
    };

    const saved = await page.evaluate(
      save => window.__VERIFY__!.save(save),
      grown
    );
    expect(saved).toBe(true);

    // A genuine full reload — the "enter a later battle in a reopened game"
    // boundary: a fresh document + fresh SaveService reads the same IndexedDB.
    await bootWithBridge(page);

    // Rehydrate the bridge cells from the restored save (the post-reload read).
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    // The grown build is restored byte-for-byte: the augment and the equipped
    // shard the post-reload run reads are exactly what was saved — growth is data,
    // never re-derived. (The persistence half of the AC.)
    expect(restored?.build).toEqual({
      statBonuses: { spd: SPD_AUGMENT },
      equippedShards: ["velith-deepbound"],
    });
    expect(restored?.build.statBonuses.spd).toBe(SPD_AUGMENT);

    // The hydration half of the AC — "growth persists into a later battle": project
    // the restored build into a LIVE battle through the real combat engine and assert
    // the lead combatant actually fields the grown SPD (base + augment), and that the
    // equipped shard survived. A regression where reload keeps `build` in storage but
    // battle hydration drops the augment would leave the live SPD at `baseSpd` and
    // fail here — exactly the gap a DTO-only round-trip cannot catch.
    const fielded = await page.evaluate(() => window.__VERIFY__!.build());
    expect(fielded.statBonuses).toEqual({ spd: SPD_AUGMENT });
    expect(fielded.equippedShards).toEqual(["velith-deepbound"]);
    expect(fielded.battleParty[0]!.stats.spd).toBe(baseSpd + SPD_AUGMENT);
    // The run-wide augment reaches every fielded member, not only the lead.
    for (const member of fielded.battleParty) {
      expect(member.stats.spd).toBeGreaterThanOrEqual(SPD_AUGMENT);
    }

    expect(errors).toEqual([]);
  });
});
