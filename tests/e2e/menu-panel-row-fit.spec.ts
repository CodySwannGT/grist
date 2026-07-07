/**
 * Menu detail-panel **row fit** verification (UAT) suite — the manifest for #265
 * ("…pried the cargo op…" clipped at the Ledger panel's right border, "*Emberwisp"
 * near-clipped in Party). Boots the Menu scene via `?scene=menu&uat=1`, seeds a save
 * whose Ledger records the *longest* authored codex line (the "The Long Way to Cal"
 * reunion), drives the real keyboard to open each panel, and reads the rendered fit
 * through the menu bridge seam (`menuPanelFit()`) — proving, empirically against the
 * live canvas, that the widest rendered row stays inside the panel's right border.
 *
 * The fit *rules* (each authored line wraps to its budget) are proven exhaustively and
 * headlessly by `tests/ui/menu-panel-fit`; this spec proves the live scene wires that
 * wrap to the canvas, so a regression that drops the `wordWrap` (or narrows the panel)
 * fails here against real Phaser text geometry.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;
/** The zero-based rows of the Party and Ledger entries (Party, Builds, Items, Ledger…). */
const PARTY_ROW = 0;
const LEDGER_ROW = 3;

/** The rendered fit of the open panel: widest line's right edge vs the inner bound. */
interface PanelFit {
  readonly right: number;
  readonly bound: number;
}

/**
 * The serialized save shape the bridge round-trips — declared locally (no app import),
 * structurally aligned with `CurrentSave` (v3), like the sibling `ledger-codex` spec.
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

/**
 * A save whose Ledger records every codex beat — including the longest authored line
 * ("The Long Way to Cal") — so the codex panel renders its widest possible rows; the
 * party carries Wren with her shard, the original near-clip case.
 */
const FULL_SAVE: SaveDataV3 = {
  version: 3,
  party: [{ id: "wren", level: 12 }],
  grist: 0,
  inventory: [],
  learned: [],
  learning: [],
  choice: { resolved: false },
  moralLedger: { karma: -3, freeChoices: 2, wieldChoices: 5 },
  rng: { seed: 1, state: 1 },
  worldState: "ashfall",
  build: { statBonuses: {}, equippedShards: [] },
  scene: {
    sceneId: "ashfall",
    nodeId: "node-0",
    flags: {
      "sable-revealed": true,
      "mill-rendered": "render",
      "sable-lost": true,
      "reunion:quietus": "completed",
      "reunion:asch": "completed",
      "reunion:cal": "completed",
      "reunion:shrike": "completed",
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
 * Boot the Menu scene with the bridge, asserting the save + panel-fit seam is present.
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
          typeof window.__VERIFY__?.menuPanelFit === "function"
      )
    )
    .toBe(true);
  await page.evaluate(() => window.__VERIFY__!.clearSave());
  const persisted = await page.evaluate(
    saveArg => window.__VERIFY__!.save(saveArg as never),
    FULL_SAVE
  );
  expect(persisted).toBe(true);
}

/**
 * Focus the canvas and step the cursor down to the given row, then confirm it.
 * @param page - The Playwright page.
 * @param row - The zero-based entry row to open.
 */
async function openEntry(page: Page, row: number): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
  for (let step = 0; step < row; step += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(KEY_DWELL);
  }
  await page.keyboard.press("Enter");
}

/**
 * Poll the menu bridge until the open panel reports a rendered fit, then return it.
 * @param page - The Playwright page.
 * @returns The panel's rendered fit.
 */
async function readPanelFit(page: Page): Promise<PanelFit> {
  await expect
    .poll(
      () => page.evaluate(() => window.__VERIFY__?.menuPanelFit() !== null),
      {
        timeout: SEEN_TIMEOUT,
      }
    )
    .toBe(true);
  const fit = await page.evaluate(() => window.__VERIFY__!.menuPanelFit());
  expect(fit).not.toBeNull();
  return fit as PanelFit;
}

test.describe("GRIST — menu detail-panel row fit verification (UAT)", () => {
  test("[EVIDENCE: menu-panel-row-fit] Ledger codex + Party rows render inside the panel's right border", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootMenu(page);

    // Ledger: the fully-recorded codex renders its longest authored line inside the
    // panel — the row no longer clips the right border (#265).
    await openEntry(page, LEDGER_ROW);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => window.__VERIFY__?.menuLedgerCodex()?.recorded ?? 0
          ),
        { timeout: SEEN_TIMEOUT }
      )
      .toBeGreaterThan(0);
    const ledgerFit = await readPanelFit(page);
    expect(ledgerFit.right).toBeLessThanOrEqual(ledgerFit.bound);

    // Move the cursor back up from Ledger (row 3) to Party (row 0) and open it — the
    // widest party stat line (name + stats + shard) must also render inside the border.
    for (let step = LEDGER_ROW; step > PARTY_ROW; step -= 1) {
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(KEY_DWELL);
    }
    await page.keyboard.press("Enter");
    await expect
      .poll(
        () => page.evaluate(() => window.__VERIFY__?.menuParty() !== null),
        {
          timeout: SEEN_TIMEOUT,
        }
      )
      .toBe(true);
    const partyFit = await readPanelFit(page);
    expect(partyFit.right).toBeLessThanOrEqual(partyFit.bound);

    expect(errors).toEqual([]);
  });
});
