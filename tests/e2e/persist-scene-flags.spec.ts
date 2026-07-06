/**
 * Dialogue-scene moral-choice **persistence** verification (UAT) suite — the manifest
 * for bug #223 (follow-up on #221/PR #222). Proves, empirically against the live
 * canvas and across GENUINE IndexedDB reloads, that the two dialogue-scene moral
 * flags — the Ch.1 Sable reveal (`sable-revealed`) and Wren's mill render-or-not
 * choice (`mill-rendered`) — are written THROUGH to the persisted save when the player
 * records them in live play, so the Ledger codex (`menuLedgerCodex()`, shipped in PR
 * #222) records both entries after a reload instead of leaving them pending forever.
 *
 * The seam under test is the write-through the Dialogue scene performs at the moment it
 * folds each flag: it merges the presenter's cursor + flags into `SaveDataV3.scene.flags`
 * (the same ledger the Reckoning/reunion beats persist through) via the pure
 * `foldSceneProgress` projection. This spec drives BOTH beats through the real bridge on
 * separate document loads (each `page.goto` is a genuine reload), never seeds the flags
 * itself, and reads the codex the Menu panel projects from the reloaded save:
 *
 * - [persist-live-play] play the Ch.1 reveal, reload into the mill and make the choice,
 *   reload into the Menu → the codex records BOTH `The Delivery` and `What the Mill
 *   Took`, each with its recorded line, and the tally counts them.
 *
 * The codex projection rules and the pure fold are proven exhaustively and
 * deterministically by the headless suites (`tests/logic/scene-progress`,
 * `tests/logic/ledger-codex`, `tests/content/ledger-codex`); this spec proves the live
 * scenes wire the fold to real IndexedDB persistence through the real input path. It
 * leaves the default boot unchanged so every existing spec stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The zero-based row of the **Ledger** entry (Party, Builds, Items, Ledger, …). */
const LEDGER_ROW = 3;
/** A short dwell between keystrokes so each keydown lands in its own Phaser tick. */
const KEY_DWELL = 150;

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

/** The persisted scene sub-shape `loadSave()` round-trips (v3), declared locally. */
interface LoadedSave {
  readonly scene: {
    readonly flags: Readonly<Record<string, boolean | string | number>>;
  } | null;
}

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
 * Wait until the Dialogue bridge (advance/branch + save read/write) is wired.
 * @param page - The Playwright page.
 */
async function waitForDialogueBridge(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof window.__VERIFY__?.advanceDialogue === "function" &&
          typeof window.__VERIFY__?.branchDialogue === "function" &&
          typeof window.__VERIFY__?.loadSave === "function" &&
          typeof window.__VERIFY__?.clearSave === "function"
      )
    )
    .toBe(true);
}

/**
 * Read the persisted scene flag ledger straight from IndexedDB via the real bridge.
 * @param page - The Playwright page.
 * @returns The persisted `scene.flags` (empty when no scene progress is stored yet).
 */
async function persistedFlags(
  page: Page
): Promise<Readonly<Record<string, boolean | string | number>>> {
  const save = (await page.evaluate(() =>
    window.__VERIFY__!.loadSave()
  )) as LoadedSave;
  return save.scene?.flags ?? {};
}

/**
 * Drive the presenter's advance N times, one keydown-tick apart, through the ungated
 * bridge advance (the reveal-beat gate is proven separately in `reveal-beat`).
 * @param page - The Playwright page.
 * @param steps - How many advances to emit.
 */
async function advance(page: Page, steps: number): Promise<void> {
  for (let step = 0; step < steps; step += 1) {
    await page.evaluate(() => window.__VERIFY__!.advanceDialogue());
    await page.waitForTimeout(KEY_DWELL);
  }
}

/**
 * Boot the Ch.1 opening, clear any prior save, and play through the Sable reveal — the
 * beat that folds AND persists `sable-revealed`. Polls IndexedDB until the write
 * commits so the reload that follows reads a settled store.
 * @param page - The Playwright page.
 */
async function playCh1Reveal(page: Page): Promise<void> {
  await page.goto("/?scene=opening&uat=1");
  await waitForScene(page, "Dialogue");
  await waitForDialogueBridge(page);
  await page.evaluate(() => window.__VERIFY__!.clearSave());
  // hook → cargo-reached → pry → cargo-opens (the reveal node folds + persists).
  await advance(page, 3);
  await expect
    .poll(async () => (await persistedFlags(page))["sable-revealed"] ?? null, {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(true);
}

/**
 * Reload into the mill side-story and take the render branch — the beat that folds AND
 * persists `mill-rendered`. Polls IndexedDB until both flags are present, proving the
 * write MERGED over the reload-restored `sable-revealed` rather than replacing it.
 * @param page - The Playwright page.
 */
async function playMillChoice(page: Page): Promise<void> {
  await page.goto("/?scene=mill&uat=1");
  await waitForScene(page, "Dialogue");
  await waitForDialogueBridge(page);
  // found → ledger → the-mark → mill-choice (the fork), then take the render branch.
  await advance(page, 3);
  await page.evaluate(() => window.__VERIFY__!.branchDialogue("render"));
  await expect
    .poll(
      async () => {
        const flags = await persistedFlags(page);
        return (
          flags["mill-rendered"] === "render" &&
          flags["sable-revealed"] === true
        );
      },
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Reload into the Menu, route to the Ledger, and read back the codex the panel
 * projected from the reloaded save.
 * @param page - The Playwright page.
 * @returns The projected codex view.
 */
async function openLedgerAfterReload(page: Page): Promise<CodexView> {
  await page.goto("/?scene=menu&uat=1");
  await waitForScene(page, "Menu");
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
  return (await page.evaluate(() =>
    window.__VERIFY__!.menuLedgerCodex()
  )) as CodexView;
}

test.describe("GRIST — dialogue moral-choice persistence verification (UAT)", () => {
  test("[persist-live-play] Ch.1 reveal + mill choice survive a genuine reload and record in the codex", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await playCh1Reveal(page);
    await playMillChoice(page);
    const codex = await openLedgerAfterReload(page);

    const byFlag = (flag: string): CodexRow | undefined =>
      codex.rows.find(row => row.flag === flag);

    // Both dialogue-scene beats are recorded in live play — with their lines — after
    // the reload (no longer 'pending'), from the persisted save the codex projects.
    const reveal = byFlag("sable-revealed");
    expect(reveal?.recorded).toBe(true);
    expect(reveal?.line).not.toBeNull();

    const mill = byFlag("mill-rendered");
    expect(mill?.recorded).toBe(true);
    expect(mill?.line).not.toBeNull();

    // The tally counts them.
    expect(codex.recorded).toBeGreaterThanOrEqual(2);
    expect(codex.tally).toBe(`Recorded: ${codex.recorded} of ${codex.total}`);

    expect(errors).toEqual([]);
  });
});
