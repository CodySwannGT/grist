/**
 * Wren's "What the mill took" side-story verification (UAT) suite — the Validation
 * Journey for #111 (Story #98, PRD #42 FR5/AC7). Drives the in-game
 * `window.__VERIFY__` bridge against the live build to prove the issue's binding
 * acceptance scenario EMPIRICALLY (unit/typecheck/lint alone are not acceptable):
 *
 *   Given Wren's "What the mill took" beat is reachable in the demo
 *   When the player makes the render-or-not choice
 *   Then a moral-ledger flag is persisted and survives save/reload
 *
 * - [choice-frame] the beat is REACHABLE: `?scene=mill` boots straight into the
 *   discoverable side-story beat, speaking as Wren, and advancing the discovery walk
 *   reaches the render-or-not fork — the presenter renders both choices (render /
 *   spare). This is the "the beat is reachable in the demo" half.
 * - [post-reload-state] the render-or-not choice folds the PERSISTED moral ledger
 *   (render → karma−/wield, spare → karma+/free — the only moral tally in the save
 *   schema), and that ledger survives a genuine page reload: a save the choice
 *   projects is written to IndexedDB and, after a real `page.goto`, `loadSave()` /
 *   `runState().moralLedger` return it byte-for-byte. The save/reload boundary is a
 *   true document reload (a fresh SaveService reading the same on-disk DB), not an
 *   in-memory round-trip (that is covered by `tests/logic/side-mill.test.ts`).
 *
 * CRITICAL: the persistence assertion rests on the PERSISTED `MoralLedger`
 * (`runState().moralLedger`), NOT on the narrative `flags` ledger — narrative flags
 * are not in the save schema (pending #116) and would silently fail save/reload. The
 * render-or-not fork therefore folds the free-vs-wield reducers (render = wield, the
 * corruption-cost spend; spare = free, the safe path), so each branch is a measurably
 * different persisted ledger. The bridge is enabled with `?uat=1`; the mill choice
 * logic rides the content tables, so the persisted-ledger drive is scene-agnostic and
 * the default boot is used (mirrors `bound-site.spec.ts`).
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The Bound the mill beat sites its render-or-not choice on (the Marrow Bound). */
const MILL_SHARD = "marrow-bound";
/** Wren is the side-story's POV speaker. */
const WREN = "wren";

/** The dialogue snapshot exposed by the verification bridge. */
interface DialogueState {
  readonly scene: string;
  readonly speaker: string;
  readonly caption: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly choices: readonly { readonly id: string; readonly label: string }[];
}

/**
 * The serialized save shape the bridge round-trips — a structural *subset* of the
 * current v3 `CurrentSave` (only the moral fields this spec asserts), declared
 * locally so the spec needs no app import (mirrors `bound-site.spec.ts` /
 * `save-reload.spec.ts`). Used only as a cast target for `loadSave()` reads, so it
 * lists just the `version` discriminant plus the choice + moralLedger it checks.
 */
interface SaveDataV3 {
  readonly version: 3;
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
}

/**
 * Wait until the verification bridge is installed with the **mill** contract present
 * (`openMill` / `chooseMill` / `millBeat` / `millSave`) plus the save + run-state seam
 * the persistence assertions read. Asserting the whole shape up front means a broken
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
            typeof api?.openMill === "function" &&
            typeof api?.chooseMill === "function" &&
            typeof api?.millBeat === "function" &&
            typeof api?.millSave === "function" &&
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
 * Boot the app with the verification bridge enabled (scene-agnostic — the mill choice
 * logic rides the content tables, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
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
 * Read the live dialogue snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The dialogue snapshot, or null if unavailable.
 */
async function dialogueState(page: Page): Promise<DialogueState | null> {
  return page.evaluate(
    () => (window.__VERIFY__?.dialogue() ?? null) as DialogueState | null
  );
}

test.describe("GRIST — 'What the mill took' side-story verification (UAT, #111)", () => {
  test("[choice-frame] the beat is reachable and advancing reaches the render-or-not fork", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });

    // The beat is REACHABLE in the demo: `?scene=mill` boots straight into Wren's
    // side-story, speaking as Wren (not the demo/ch1 scripts).
    await page.goto(`/?scene=mill&uat=1`);
    await waitForScene(page, "Dialogue");
    await expect(page.locator("canvas")).toBeVisible();
    const opening = await dialogueState(page);
    expect(opening?.speaker).toBe(WREN);
    expect((opening?.caption.length ?? 0) > 0).toBe(true);
    expect(opening?.branching).toBe(false);

    // Walk the discovery beats (found → ledger → the-mark) to the render-or-not fork;
    // the presenter renders BOTH choices, the moral fork made visible.
    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    }
    const fork = await dialogueState(page);
    expect(fork?.branching).toBe(true);
    expect(fork?.done).toBe(false);
    const choiceIds = (fork?.choices ?? [])
      .map(choice => choice.id)
      .sort((a, b) => a.localeCompare(b));
    expect(choiceIds).toEqual(["render", "spare"]);

    expect(errors).toEqual([]);
  });

  test("[post-reload-state] choosing render folds the persisted ledger and it survives save/reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());

    // Before opening: no beat is held — the cell cannot fabricate one.
    expect(await page.evaluate(() => window.__VERIFY__!.millBeat())).toBeNull();

    // Reach the beat (scene-agnostic, through the content tables) and read it unsettled.
    await page.evaluate(() => window.__VERIFY__!.openMill());
    const opened = await page.evaluate(() => window.__VERIFY__!.millBeat());
    expect(opened).not.toBeNull();
    expect(opened!.shard).toBe(MILL_SHARD);
    expect(opened!.settled).toBe(false);

    // Choose RENDER — the corruption-cost spend: the PERSISTED ledger folds karma
    // down with a wield tally and accruing corruption.
    await page.evaluate(() => window.__VERIFY__!.chooseMill("render"));
    const settled = await page.evaluate(() => window.__VERIFY__!.millBeat());
    expect(settled!.settled).toBe(true);
    expect(settled!.variant).toBe("wield");
    expect(settled!.karma).toBe(-1);
    expect(settled!.wieldChoices).toBe(1);
    expect(settled!.freeChoices).toBe(0);
    expect(settled!.corruptionAccrued).toBeGreaterThan(0);

    // Persist the save the settled choice projects, then reload across a GENUINE
    // document boundary (a fresh document + a fresh SaveService reading the same
    // on-disk IndexedDB) — the real "reopen the game" boundary.
    // millSave() returns the full CurrentSave the `save` path accepts; persist it
    // directly inside one evaluate so the projected save never crosses the boundary
    // as a narrowed shape.
    const saved = await page.evaluate(() =>
      window.__VERIFY__!.save(window.__VERIFY__!.millSave())
    );
    expect(saved).toBe(true);
    await bootWithBridge(page);

    // The persisted moral ledger survived the reload exactly — restored from
    // IndexedDB and surfaced scene-agnostically through runState().
    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    const run = await page.evaluate(() => window.__VERIFY__!.runState());
    expect((restored as SaveDataV3).moralLedger).toEqual({
      karma: -1,
      freeChoices: 0,
      wieldChoices: 1,
    });
    expect((restored as SaveDataV3).choice.variant).toBe("wield");
    expect(run!.moralLedger.karma).toBe(-1);
    expect(run!.choice.variant).toBe("wield");

    expect(errors).toEqual([]);
  });

  test("[post-reload-state] choosing spare yields the alternate persisted ledger across reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootWithBridge(page);
    await page.evaluate(() => window.__VERIFY__!.clearSave());

    // The alternate fork: SPARE — refusing to render is the safe path (karma+, a free
    // tally, no corruption) — a measurably DIFFERENT persisted ledger than render.
    await page.evaluate(() => window.__VERIFY__!.openMill());
    await page.evaluate(() => window.__VERIFY__!.chooseMill("spare"));
    const settled = await page.evaluate(() => window.__VERIFY__!.millBeat());
    expect(settled!.variant).toBe("free");
    expect(settled!.karma).toBe(1);
    expect(settled!.freeChoices).toBe(1);
    expect(settled!.wieldChoices).toBe(0);
    expect(settled!.corruptionAccrued).toBe(0);

    await page.evaluate(() =>
      window.__VERIFY__!.save(window.__VERIFY__!.millSave())
    );
    await bootWithBridge(page);

    const restored = await page.evaluate(() => window.__VERIFY__!.loadSave());
    const run = await page.evaluate(() => window.__VERIFY__!.runState());
    expect((restored as SaveDataV3).moralLedger).toEqual({
      karma: 1,
      freeChoices: 1,
      wieldChoices: 0,
    });
    expect(run!.moralLedger.karma).toBe(1);
    expect(run!.choice.variant).toBe("free");

    expect(errors).toEqual([]);
  });
});
