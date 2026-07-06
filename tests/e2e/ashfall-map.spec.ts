/**
 * Ashfall transformed-map verification (UAT) suite — the Validation Journey for #139
 * (PRD #43 AC6, Scope-IN 7). Drives the in-game `window.__VERIFY__` bridge against the
 * live built game and a real browser IndexedDB to prove GRIST's defining structural
 * move — *one map, two states* — empirically, not by unit tests alone:
 *
 * - [ashfall-map-transformed] the SAME authored map, once the world turns, renders as
 *   Ashfall: `world-state = ashfall` everywhere (every region reads its ashen variant),
 *   the palette drained to grey at FULL strength (the dimming-of-color motif), and the
 *   region ids unchanged across the flag — the same map, transformed, not a second map.
 * - [ashfall-loved-place-mourned] a place the player loved in Act I (the Sylvemarch's
 *   Sidhe Enclave — the brightest place in Act I, #129) is observably mourned once the
 *   world turns: its live name shifts to its mourned form and its `mourned` flag flips.
 *
 * The world-state flag rides the persisted save (`__VERIFY__.save`), so the whole map is
 * resolved scene-agnostically through the same flag the Reckoning flips — the bridge is
 * enabled with `?uat=1` and the default (scene-agnostic) boot is used, mirroring
 * `world-state.spec.ts`. The `__VERIFY__.worldMap().hash` determinism read proves the
 * transformed map reproduces identically across a genuine page reload.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/**
 * The serialized save shape the bridge round-trips (v3, carrying the world-state flag).
 * Declared locally so the spec needs no app import — structurally assignable to the
 * versioned `CurrentSave` the `__VERIFY__.save` bridge expects, exactly as
 * `world-state.spec.ts` does.
 */
interface SaveDataV3 {
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
 * A representative save in Act I `reach` — the start-of-run world-state the transform
 * test seeds, then drives the Reckoning against.
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

/** The same representative save flipped to Act II `ashfall`. */
function ashfallSave(): SaveDataV3 {
  return { ...reachSave(), worldState: "ashfall" };
}

/**
 * Wait until the verification bridge is installed with the world-state + transformed-map
 * contract present (`save` to seed the flag, `reckon` to turn the world, `worldMap` to
 * read the transformed map). Asserting the whole shape up front fails here, loudly, on a
 * broken bridge rather than silently no-op'ing.
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
            typeof api?.clearSave === "function" &&
            typeof api?.reckon === "function" &&
            typeof api?.worldMap === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the world-state
 * flag rides the persisted save, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?scene=battle&uat=1");
  await waitForBridge(page);
}

test.describe("GRIST — Ashfall transformed-map verification (UAT)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[ashfall-map-transformed] the Reckoning renders the SAME map as Ashfall — desaturated at full strength, world-state ashfall everywhere", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Seed a known Act I reach world-state.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());

    // Before the Reckoning: Act I reach — full colour, not turned everywhere.
    const before = await page.evaluate(() => window.__VERIFY__!.worldMap());
    expect(before.worldState).toBe("reach");
    expect(before.desaturation).toBe(0);
    expect(before.greyed).toBe(false);
    expect(before.allAshen).toBe(false);
    // The verdant land tone reads un-drained in Act I.
    expect(before.palette.land).toBe(0x3f7d3a);
    expect(before.regionCount).toBeGreaterThanOrEqual(7);
    const reachIds = before.regions.map(region => region.id);

    // Fire the Reckoning world-turn (the in-memory flip; consumes no RNG).
    await page.evaluate(() => window.__VERIFY__!.reckon());

    // After the Reckoning: the SAME map, transformed to Ashfall.
    const after = await page.evaluate(() => window.__VERIFY__!.worldMap());
    // world-state = ashfall everywhere: the flag it resolved through, and every region
    // reads its ashen variant.
    expect(after.worldState).toBe("ashfall");
    expect(after.allAshen).toBe(true);
    // Desaturated palette at FULL strength — every structural tone drained to grey.
    expect(after.desaturation).toBe(1);
    expect(after.greyed).toBe(true);
    // The one warm grist signal survives the turn.
    expect(after.palette.highlight).toBe(0xffd166);
    // The SAME map — identical region ids across the flag; only the read changed.
    expect(after.regions.map(region => region.id)).toEqual(reachIds);
    // Observably transformed: the loved region's name changed under the turn.
    const reachName = before.regions.find(r => r.id === "sylvemarch")?.name;
    const ashfallName = after.regions.find(r => r.id === "sylvemarch")?.name;
    expect(ashfallName).not.toBe(reachName);
    expect(ashfallName).toBe("The Sylvemarch Ashfall");

    expect(errors).toEqual([]);
  });

  test("[ashfall-loved-place-mourned] a place the player loved in Act I is observably mourned in Ashfall, reproducibly", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // Seed Act I reach and read the loved place while it is still loved.
    await page.evaluate(save => window.__VERIFY__!.save(save), reachSave());
    const loved = await page.evaluate(
      () => window.__VERIFY__!.worldMap().lovedPlace
    );
    expect(loved.regionId).toBe("sylvemarch");
    expect(loved.locationId).toBe("sidhe-enclave");
    expect(loved.mourned).toBe(false);
    expect(loved.name).toBe("The Sidhe Enclave");
    expect(loved.name).toBe(loved.lovedName);

    // Turn the world and stand at the loved place: it resolves to its mourned variant.
    await page.evaluate(() => window.__VERIFY__!.reckon());
    const mourned = await page.evaluate(
      () => window.__VERIFY__!.worldMap().lovedPlace
    );
    expect(mourned.mourned).toBe(true);
    expect(mourned.lovedName).toBe("The Sidhe Enclave");
    expect(mourned.name).toBe("The Sidhe Enclave (fled)");
    // Observably mourned: the live name diverges from what it was called when loved.
    expect(mourned.name).not.toBe(mourned.lovedName);

    // Determinism: the transformed map's digest reproduces identically across a genuine
    // page reload of the same ashfall save (same flag ⇒ identical worldMap hash).
    const firstHash = await page.evaluate(
      () => window.__VERIFY__!.worldMap().hash
    );
    await page.evaluate(save => window.__VERIFY__!.save(save), ashfallSave());
    await bootWithBridge(page);
    // Rehydrate the bridge cells from the persisted save (a fresh document starts them
    // empty), so the world-state flag the transformed map resolves through is the
    // restored ashfall — the same loadSave rehydration `world-state.spec` performs.
    await page.evaluate(() => window.__VERIFY__!.loadSave());
    const reloaded = await page.evaluate(() => window.__VERIFY__!.worldMap());
    expect(reloaded.worldState).toBe("ashfall");
    expect(reloaded.hash).toBe(firstHash);
    expect(reloaded.lovedPlace.mourned).toBe(true);

    expect(errors).toEqual([]);
  });
});
