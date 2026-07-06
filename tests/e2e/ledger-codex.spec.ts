/**
 * Moral-ledger **codex** panel verification (UAT) suite — the manifest for sub-task
 * #221 (Story #196 / #99, PRD #42). Boots the Menu scene via `?scene=menu&uat=1`,
 * seeds a persisted save through the real `__VERIFY__.save` bridge, drives the menu
 * through the *real keyboard* to the **Ledger** route, and reads the codex the panel
 * rendered through the menu bridge seam (`menuLedgerCodex()`) — proving, empirically
 * against the live canvas, both of the parent's Gherkin scenarios:
 *
 * - [codex-recorded-run] a run with some moral flags recorded opens a codex that lists
 *   every catalog choice in authored order, shows each recorded (with its line) or
 *   pending, and headers `Recorded: N of M`.
 * - [codex-fresh-run] a run that has recorded no moral choices shows every entry
 *   pending and the tally `Recorded: 0 of M`.
 *
 * The codex rules (order, recorded/pending, the tally) are proven exhaustively and
 * deterministically by the headless unit suites (`tests/logic/ledger-codex`,
 * `tests/content/ledger-codex`, `tests/ui/ledger-codex`); this spec proves the live
 * scene wires that model to the canvas from the persisted save through the real input
 * path. It leaves the default boot unchanged so every existing spec stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;
/** The zero-based row of the **Ledger** entry (Party, Builds, Items, Ledger, …). */
const LEDGER_ROW = 3;

/**
 * The serialized save shape the bridge round-trips — declared locally (no app import)
 * and structurally aligned with the current `CurrentSave` (v3), like `save-reload`.
 */
interface SaveDataV3 {
  readonly version: 3;
  readonly party: readonly { readonly id: string; readonly level: number }[];
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

/** One projected codex row, as `menuLedgerCodex()` surfaces it. */
interface CodexRow {
  readonly id: string;
  readonly flag: string;
  readonly title: string;
  readonly recorded: boolean;
  readonly line: string | null;
}

/** The projected codex view the menu bridge surfaces. */
interface CodexView {
  readonly rows: readonly CodexRow[];
  readonly recorded: number;
  readonly total: number;
  readonly tally: string;
}

/** A base save with no scene progress (a fresh run — `scene` is null). */
const FRESH_SAVE: SaveDataV3 = {
  version: 3,
  party: [{ id: "wren", level: 1 }],
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
 * A run with moral flags recorded: the Ch.1 reveal, the mill beat, and the Reckoning's
 * Sable-lost turn recorded, one reunion completed and one still available (pending),
 * over the exact flag keys/values the game persists into `scene.flags`.
 */
const RECORDED_SAVE: SaveDataV3 = {
  ...FRESH_SAVE,
  moralLedger: { karma: -1, freeChoices: 1, wieldChoices: 2 },
  scene: {
    sceneId: "ashfall",
    nodeId: "node-0",
    flags: {
      "sable-revealed": true,
      "mill-rendered": "render",
      "sable-lost": true,
      "reunion:quietus": "completed",
      "reunion:asch": "available",
    },
  },
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
 * Boot the Menu scene with the bridge, asserting the save + codex seam is present.
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
          typeof window.__VERIFY__?.menuLedgerCodex === "function"
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
 * Focus the canvas, navigate the cursor to the Ledger entry, and confirm it — then
 * read back the codex the panel rendered (polled until the async save load resolves).
 * @param page - The Playwright page.
 * @returns The projected codex view.
 */
async function openLedgerCodex(page: Page): Promise<CodexView> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
  for (let step = 0; step < LEDGER_ROW; step += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(KEY_DWELL);
  }
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.__VERIFY__?.menuLedgerCodex()?.rows.length ?? 0
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBeGreaterThan(0);
  const codex = await page.evaluate(() => window.__VERIFY__!.menuLedgerCodex());
  expect(codex).not.toBeNull();
  return codex as CodexView;
}

test.describe("GRIST — moral-ledger codex panel verification (UAT)", () => {
  test("[codex-recorded-run] lists every choice in authored order, recorded/pending, with Recorded: N of M", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await seedSave(page, RECORDED_SAVE);
    const codex = await openLedgerCodex(page);

    // Every catalog choice is listed, in a stable authored order (the reveal leads).
    expect(codex.total).toBe(codex.rows.length);
    expect(codex.rows[0]?.flag).toBe("sable-revealed");

    const byFlag = (flag: string): CodexRow | undefined =>
      codex.rows.find(row => row.flag === flag);

    // Recorded beats show recorded with their line.
    for (const flag of ["sable-revealed", "sable-lost", "reunion:quietus"]) {
      const row = byFlag(flag);
      expect(row?.recorded).toBe(true);
      expect(row?.line).not.toBeNull();
    }
    // A present-but-`available` reunion, and an entirely absent one, stay pending.
    expect(byFlag("reunion:asch")?.recorded).toBe(false);
    expect(byFlag("reunion:asch")?.line).toBeNull();
    expect(byFlag("reunion:shrike")?.recorded).toBe(false);

    // The tally headers Recorded: N of M with the four recorded beats counted.
    expect(codex.recorded).toBe(4);
    expect(codex.tally).toBe(`Recorded: 4 of ${codex.total}`);

    expect(errors).toEqual([]);
  });

  test("[codex-fresh-run] a run with no recorded choices shows every entry pending, Recorded: 0 of M", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);
    await seedSave(page, FRESH_SAVE);
    const codex = await openLedgerCodex(page);

    expect(codex.rows.length).toBeGreaterThan(0);
    expect(codex.rows.every(row => !row.recorded && row.line === null)).toBe(
      true
    );
    expect(codex.recorded).toBe(0);
    expect(codex.tally).toBe(`Recorded: 0 of ${codex.total}`);

    expect(errors).toEqual([]);
  });
});
