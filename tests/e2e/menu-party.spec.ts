/**
 * Party roster panel verification (UAT) suite — the manifest for sub-task #249. Boots
 * the Menu scene via `?scene=menu&uat=1`, seeds a persisted save through the real
 * `__VERIFY__.save` bridge, drives the menu through the *real keyboard* to the **Party**
 * route (the first entry), and reads the roster the panel rendered through the menu
 * bridge seam (`menuParty()`) — proving, empirically against the live canvas, both of
 * the parent's Gherkin scenarios:
 *
 * - [menu-party-panel] a run with Wren + Tobi opens a Party panel that lists each
 *   member with at least name and HP/AP (not the old one-line stub).
 * - after a reunion completes (driven through the shipped reunion seam and persisted via
 *   the real save path), reopening the panel shows the reunited member in the roster.
 *
 * The roster rules (order, fallback-to-starting-party, stat/shard/build projection) are
 * proven exhaustively and deterministically by the headless unit suites
 * (`tests/logic/party-roster`, `tests/ui/party-roster`); this spec proves the live scene
 * wires that model to the canvas from the persisted save through the real input path.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;

/**
 * The serialized save shape the bridge round-trips — declared locally (no app import)
 * and structurally aligned with the current `CurrentSave` (v3), like `ledger-codex`.
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

/** One projected roster member, as `menuParty()` surfaces it. */
interface PartyMember {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly hp: number;
  readonly ap: number;
  readonly shard: string | null;
}

/** The projected roster view the menu bridge surfaces. */
interface PartyView {
  readonly members: readonly PartyMember[];
  readonly count: number;
}

/** A save with Wren + Tobi in the party (the AC's starting party). */
const WREN_TOBI_SAVE: SaveDataV3 = {
  version: 3,
  party: [
    { id: "wren", level: 3, shard: "emberwisp", shardMode: "wield" },
    { id: "tobi", level: 3 },
  ],
  grist: 0,
  inventory: [],
  learned: [],
  learning: [],
  choice: { resolved: false },
  moralLedger: { karma: 0, freeChoices: 0, wieldChoices: 0 },
  rng: { seed: 1, state: 1 },
  worldState: "reach",
  build: { statBonuses: {}, equippedShards: [] },
  scene: null,
};

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - The expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Boot the Menu scene with the bridge, asserting the save + party seam is present.
 * @param page - The Playwright page.
 */
async function bootMenu(page: Page): Promise<void> {
  await page.goto("/?scene=menu&uat=1");
  await waitForScene(page, "Menu");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof window.__VERIFY__?.save === "function" &&
          typeof window.__VERIFY__?.clearSave === "function" &&
          typeof window.__VERIFY__?.menuParty === "function"
      )
    )
    .toBe(true);
}

/**
 * Persist a fixture save through the real bridge, from a cleaned store.
 * @param page - The Playwright page.
 * @param save - The save fixture to persist.
 */
async function seedSave(page: Page, save: SaveDataV3): Promise<void> {
  await page.evaluate(() => window.__VERIFY__!.clearSave());
  const persisted = await page.evaluate(
    saveArg => window.__VERIFY__!.save(saveArg as never),
    save
  );
  expect(persisted).toBe(true);
}

/**
 * Focus the canvas and confirm the **Party** entry (the first entry — no navigation) —
 * then read back the roster the panel rendered (polled until the async save load
 * resolves).
 * @param page - The Playwright page.
 * @returns The projected roster view.
 */
async function openParty(page: Page): Promise<PartyView> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__VERIFY__?.menuParty()?.members.length ?? 0
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBeGreaterThan(0);
  const view = await page.evaluate(() => window.__VERIFY__!.menuParty());
  expect(view).not.toBeNull();
  return view as PartyView;
}

/**
 * Re-open the Party panel after a save change: nudge the cursor off Party and back so
 * the confirm re-loads the (now updated) save, then read the fresh roster.
 * @param page - The Playwright page.
 * @param expectedId - A member id the reload must now surface.
 * @returns The refreshed roster view.
 */
async function reopenPartyUntil(
  page: Page,
  expectedId: string
): Promise<PartyView> {
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(KEY_DWELL);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(KEY_DWELL);
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () =>
        page.evaluate(
          id =>
            (window.__VERIFY__?.menuParty()?.members ?? []).some(
              member => member.id === id
            ),
          expectedId
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
  return (await page.evaluate(() =>
    window.__VERIFY__!.menuParty()
  )) as PartyView;
}

test.describe("GRIST — Party roster panel verification (UAT)", () => {
  test("[menu-party-panel] lists the real roster with names and HP/AP", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await seedSave(page, WREN_TOBI_SAVE);
    const view = await openParty(page);

    // The panel shows the real party — Wren + Tobi — not the one-line stub.
    expect(view.count).toBe(2);
    const byId = (id: string): PartyMember | undefined =>
      view.members.find(member => member.id === id);
    for (const id of ["wren", "tobi"]) {
      const member = byId(id);
      expect(member).toBeDefined();
      // Each member carries at least a name and HP/AP (the acceptance minimum).
      expect(member?.name.length ?? 0).toBeGreaterThan(0);
      expect(member?.hp ?? 0).toBeGreaterThan(0);
      expect(member?.ap ?? 0).toBeGreaterThan(0);
    }
    expect(byId("wren")?.name).toBe("Wren");
    expect(byId("tobi")?.name).toBe("Tobi");

    expect(errors).toEqual([]);
  });

  test("after a reunion completes, the reunited member appears in the roster", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await seedSave(page, WREN_TOBI_SAVE);
    const before = await openParty(page);
    expect(before.members.some(member => member.id === "quietus")).toBe(false);

    // Drive the shipped reunion seam: complete Quietus's reunion and persist the
    // recruited roster through the real save path (the same path the reunion e2e uses).
    const persisted = await page.evaluate(async () => {
      window.__VERIFY__!.openReunions();
      window.__VERIFY__!.completeReunion("quietus" as never);
      return window.__VERIFY__!.save(window.__VERIFY__!.reunionsSave());
    });
    expect(persisted).toBe(true);

    const after = await reopenPartyUntil(page, "quietus");
    const quietus = after.members.find(member => member.id === "quietus");
    expect(quietus?.name).toBe("Quietus");
    expect(quietus?.hp ?? 0).toBeGreaterThan(0);
    expect(quietus?.ap ?? 0).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });
});
