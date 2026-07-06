/**
 * Act II reunion-structure verification (UAT) suite — the Validation Journey for #140
 * (PRD #43; `wiki/narrative/main-quest.md` Ch.7 — "Gathering the lost"). Drives the
 * in-game `window.__VERIFY__` bridge against the live build (and a real browser
 * IndexedDB) to prove the issue's acceptance scenario EMPIRICALLY (unit / typecheck /
 * lint alone are NOT acceptable per the issue's Validation Journey):
 *
 * - [EVIDENCE: reunion-quest-optional-missable] — with the world turned to Ashfall,
 *   completing one reunion but bypassing another and reaching a later beat leaves the
 *   bypassed reunion flagged missed while play continues, observed scene-agnostically
 *   via `__VERIFY__.openReunions()` / `completeReunion()` / `bypassReunion()` /
 *   `advanceReunions()` / `reunions()`.
 * - [EVIDENCE: quietus-roster-joins] — completing the Quietus reunion (and another)
 *   adds the companion to the active roster with its authored stat block + signature
 *   kit; the determinism digest (`reunions().hash`) is identical across two identical
 *   seeded drives; and the recruited roster + reunion statuses survive a genuine reload
 *   from IndexedDB.
 *
 * The bridge is enabled with `?uat=1`; the reunion structure rides the content tables +
 * the pure `logic/party/reunion` kit, so the active scene is irrelevant and the default
 * boot is used (mirrors `halcyon-defection.spec.ts` / `world-state.spec.ts`). The
 * Phaser-free unit twins (`tests/logic/reunion.test.ts`, `tests/uat/reunion-cell.test.ts`)
 * prove the rules headlessly; this spec proves them on the live canvas across a real
 * document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The starting party carried into Act II (before any reunion). */
const STARTING_ROSTER = ["wren", "tobi"];

/** The 8-axis stat block a roster member carries (structurally the app's `Stats`). */
interface BaseStats {
  readonly hp: number;
  readonly ap: number;
  readonly pow: number;
  readonly foc: number;
  readonly def: number;
  readonly wrd: number;
  readonly spd: number;
  readonly lck: number;
}

/** A single member as the reunion snapshot surfaces it. */
interface ReunionMember {
  readonly id: string;
  readonly level: number;
  readonly baseStats: BaseStats;
  readonly signatureKit: readonly string[];
}

/** The reunion snapshot the bridge exposes via `reunions()`. */
interface Reunions {
  readonly roster: readonly ReunionMember[];
  readonly statuses: Readonly<Record<string, string>>;
  readonly reachable: boolean;
  readonly hash: string;
}

/** The persisted member shape the reload assertion reads. */
interface SaveMember {
  readonly id: string;
  readonly level: number;
}

/**
 * Wait until the verification bridge is installed with its reunion contract. Asserting
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
            typeof api?.openReunions === "function" &&
            typeof api?.completeReunion === "function" &&
            typeof api?.bypassReunion === "function" &&
            typeof api?.advanceReunions === "function" &&
            typeof api?.reunions === "function" &&
            typeof api?.reunionsSave === "function" &&
            typeof api?.save === "function" &&
            typeof api?.loadSave === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the reunion
 * structure rides the content tables + logic kit, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?scene=battle&uat=1");
  await waitForBridge(page);
}

/**
 * Read the reunion snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `reunions()` snapshot.
 */
async function reunions(page: Page): Promise<Reunions> {
  return page.evaluate(() => window.__VERIFY__!.reunions() as Reunions);
}

test.describe("GRIST — Act II reunion structure (UAT, #140)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    // A clean IndexedDB so a prior run's save never bleeds into the reload assertion.
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: reunion-quest-optional-missable] bypassing a reunion and reaching a later beat records it missed while play continues", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // Before any reunion: the starting party, an Ashfall-reachable board, all available.
    const before = await reunions(page);
    expect(before.roster.map(member => member.id)).toEqual(STARTING_ROSTER);
    expect(before.reachable).toBe(true);
    expect(before.statuses["quietus"]).toBe("available");
    expect(before.statuses["asch"]).toBe("available");

    // Complete one reunion (Quietus), bypass another (Asch), then reach a later beat.
    await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openReunions();
      api.completeReunion("quietus");
      api.bypassReunion("asch");
      api.advanceReunions();
    });

    const after = await reunions(page);
    // The bypassed reunion is recorded missed...
    expect(after.statuses["asch"]).toBe("missed");
    // ...advancing sealed the still-open reunions (Cal, the Shrike) missed too...
    expect(after.statuses["cal"]).toBe("missed");
    expect(after.statuses["shrike"]).toBe("missed");
    // ...the completed reunion joined its companion...
    expect(after.statuses["quietus"]).toBe("completed");
    // ...and play proceeds without the missed companions — the roster scales to who was
    // found (only Quietus joined; Asch / Cal / the Shrike are absent, not required).
    expect(after.roster.map(member => member.id)).toEqual([
      ...STARTING_ROSTER,
      "quietus",
    ]);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: quietus-roster-joins] completing the Quietus reunion joins the companion with stats + kit, deterministically, and survives reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // Complete the Quietus reunion and another (Cal) — an order-independent, nonlinear
    // pair — and read the recruited roster + the determinism digest.
    const firstHash = await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openReunions();
      api.completeReunion("quietus");
      api.completeReunion("cal");
      return api.reunions().hash;
    });

    const joined = await reunions(page);
    expect(joined.roster.map(member => member.id)).toEqual([
      ...STARTING_ROSTER,
      "quietus",
      "cal",
    ]);
    // Quietus joined with her AUTHORED stat block + signature kit (not just an id).
    const quietus = joined.roster.find(member => member.id === "quietus")!;
    expect(quietus.signatureKit).toEqual(["Soul-Chorus"]);
    expect(quietus.level).toBeGreaterThan(0);
    // The esper: her FOC exceeds Wren's; her DEF is the party's lowest.
    const wren = joined.roster.find(member => member.id === "wren")!;
    expect(quietus.baseStats.foc).toBeGreaterThan(wren.baseStats.foc);
    const cal = joined.roster.find(member => member.id === "cal")!;
    expect(cal.signatureKit).toEqual(["Long-Odds"]);
    expect(joined.hash).toMatch(/^[0-9a-f]{8}$/);

    // Determinism: the same seed + the same action sequence reproduce an identical hash.
    const secondHash = await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openReunions();
      api.completeReunion("quietus");
      api.completeReunion("cal");
      return api.reunions().hash;
    });
    expect(secondHash).toBe(firstHash);

    // Persist the recruited roster + reunion statuses through the real IndexedDB path.
    const saved = await page.evaluate(async () => {
      const api = window.__VERIFY__!;
      api.openReunions();
      api.completeReunion("quietus");
      api.completeReunion("cal");
      return api.save(api.reunionsSave());
    });
    expect(saved).toBe(true);

    // A GENUINE full reload — a fresh document + a fresh SaveService reading the same
    // on-disk IndexedDB database.
    await bootWithBridge(page);

    // Layer 1 — the raw persisted DTO survived IndexedDB across the reload.
    const party = await page.evaluate(
      async () =>
        (await window.__VERIFY__!.loadSave()).party as readonly SaveMember[]
    );
    expect(party.map(member => member.id)).toEqual([
      ...STARTING_ROSTER,
      "quietus",
      "cal",
    ]);

    // Layer 2 — the HYDRATED reunion read. After loadSave() rehydrated the reunion cell,
    // reunions() surfaces the RESTORED roster (companions resolved back into live PARTY
    // entries WITH stats + kit) and the persisted completed statuses.
    const restored = await reunions(page);
    expect(restored.roster.map(member => member.id)).toEqual([
      ...STARTING_ROSTER,
      "quietus",
      "cal",
    ]);
    expect(restored.statuses["quietus"]).toBe("completed");
    expect(restored.statuses["cal"]).toBe("completed");
    const restoredQuietus = restored.roster.find(
      member => member.id === "quietus"
    )!;
    expect(restoredQuietus.signatureKit).toEqual(["Soul-Chorus"]);

    expect(errors).toEqual([]);
  });
});
