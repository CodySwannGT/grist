/**
 * Verification (UAT) suite for the `__VERIFY__` run-state surface (#88). Drives the
 * in-game `window.__VERIFY__` bridge against the live production preview build to
 * prove the issue's two acceptance scenarios empirically — the slice e2e (#89)
 * consumes this same surface as part of the full UAT 1-9 journey; this spec is
 * #88's own focused proof that the surface it adds is readable on the live build
 * and stays off in a normal build.
 *
 * - [run-state-surfaces] (AC scenario 1) loaded with `?uat=1`, the bridge can read
 *   the resolved free-vs-wield choice + moralLedger/karma, the learning progress
 *   (learned + in-progress), and the shared grist wallet — the scene-agnostic
 *   `runState()` snapshot seeded by the adopted save. The world-state flag and the
 *   save/reload methods (the rest of the field/economy/choice/learning/save
 *   surface the title names) are asserted present alongside it.
 * - [bridge-off-normal-build] (AC scenario 2) a normal build (no `?uat=1`) does not
 *   expose `window.__VERIFY__` at all.
 *
 * The preview is a real production build, so the bridge is gated purely on `?uat=1`
 * (no dev override) — the off-in-normal-build assertion is genuine. Mirrors the
 * structure of `save-reload.spec.ts` / `world-state.spec.ts`.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const MARROW = "marrow-bound";

/**
 * The serialized save shape the bridge round-trips. Structurally aligned with the
 * current `CurrentSave` (v2) but declared locally so the spec needs no app import.
 */
interface SaveDataV2 {
  // The literal `2` so this structural shape is assignable to the versioned
  // `CurrentSave` the `__VERIFY__.save` bridge expects.
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
 * A representative mid-run slice payload with a resolved *wield* choice: a spent
 * wallet, an in-progress spell, a learned spell, the resolved choice, and the
 * matching ledger — exercising every axis the `runState()` snapshot surfaces.
 * @returns A complete v2 save in a resolved-wield mid-run state.
 */
function wieldSave(): SaveDataV2 {
  return {
    version: 2,
    party: [{ id: "wren", level: 4, shard: MARROW, shardMode: "wield" }],
    grist: 7,
    inventory: [{ id: "salve", qty: 3 }],
    learned: ["cinder"],
    learning: [{ spell: "render", progress: 0.5 }],
    choice: { resolved: true, shard: MARROW, variant: "wield" },
    moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
    rng: { seed: 12345, state: 987654321 },
    worldState: "reach",
  };
}

/**
 * Wait until the verification bridge is installed with the **run-state** contract
 * present (`save` to seed it, `runState` to read it) plus the save/world-state
 * methods the title's full surface names. Asserting the whole shape up front means
 * a broken bridge fails here, loudly, instead of silently no-op'ing.
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
            typeof api?.runState === "function" &&
            typeof api?.field === "function" &&
            typeof api?.worldState === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the
 * run-state snapshot rides the adopted save, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

test.describe("GRIST — __VERIFY__ run-state surface (UAT)", () => {
  test("[run-state-surfaces] AC1: the bridge reads choice + moralLedger + learning + wallet", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());

    // Before any save is adopted, the snapshot is null (a read on a fresh boot
    // cannot fabricate a run state).
    expect(await page.evaluate(() => window.__VERIFY__!.runState())).toBeNull();

    // Adopt a resolved-wield mid-run save through the real save bridge.
    const saved = await page.evaluate(
      save => window.__VERIFY__!.save(save),
      wieldSave()
    );
    expect(saved).toBe(true);

    // The bridge now surfaces the choice + moralLedger/karma, the learning
    // progress (learned + in-progress), and the shared grist wallet — read
    // scene-agnostically from the default boot, no battle/field/bench scene.
    const runState = await page.evaluate(() => window.__VERIFY__!.runState());
    expect(runState).toEqual({
      choice: { resolved: true, shard: MARROW, variant: "wield" },
      moralLedger: { karma: -1, freeChoices: 0, wieldChoices: 1 },
      learned: ["cinder"],
      learning: [{ spell: "render", progress: 0.5 }],
      grist: 7,
    });

    // The rest of the field/economy/choice/learning/save surface the title names
    // is reachable in the same session: the world-state flag (adopted alongside)
    // and the save round-trip both read back.
    expect(await page.evaluate(() => window.__VERIFY__!.worldState())).toBe(
      "reach"
    );
    expect(await page.evaluate(() => window.__VERIFY__!.hasSave())).toBe(true);

    expect(errors).toEqual([]);
  });

  test("[bridge-off-normal-build] AC2: a normal build does not expose window.__VERIFY__", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    // A normal load — no `?uat=1`, and the preview is a real production build, so
    // the dev override does not apply. The bridge must not be installed at all.
    await page.goto("/");

    // Give bootstrap time to run; the bridge install is synchronous at startup, so
    // if it were going to appear it would be here. Assert it stays absent.
    await expect
      .poll(() => page.evaluate(() => typeof window.__VERIFY__), {
        timeout: SEEN_TIMEOUT,
      })
      .toBe("undefined");

    expect(errors).toEqual([]);
  });
});
