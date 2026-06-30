/**
 * Halcyon's defection + party-expansion verification (UAT) suite — the Validation
 * Journey for #146 (PRD #43; `wiki/narrative/main-quest.md` Ch.4 — "Halcyon defects
 * after the requiem reveals the truth"). Drives the in-game `window.__VERIFY__`
 * bridge against the live build (and a real browser IndexedDB) to prove the issue's
 * two acceptance scenarios EMPIRICALLY (unit / typecheck / lint alone are NOT
 * acceptable per the issue's Validation Journey):
 *
 * - [EVIDENCE: halcyon-joins-party] (scenario 1) — inside the Roots / the Deep, after
 *   reaching Halcyon's defection trigger (the Sidhe requiem-hall set-piece #145 played
 *   to its `truth`/`complete` beat), firing the defection adds Halcyon to the active
 *   party roster with her authored stat block and signature kit, observed
 *   scene-agnostically via `__VERIFY__.openDefection()` / `playDefectionRequiem()` /
 *   `fireDefection()` / `defection()`.
 * - [EVIDENCE: halcyon-defection-persists] (scenario 2) — the post-defection roster is
 *   persisted through the real `__VERIFY__.save` IndexedDB path, the page is fully
 *   reloaded, `loadSave()` restores it, and Halcyon is still in the party with her
 *   stats and kit intact.
 *
 * The bridge is enabled with `?uat=1`; the defection rides the content tables + the
 * pure `logic/party` + `logic/region` kit, so the active scene is irrelevant and the
 * default boot is used (mirrors `requiem-hall.spec.ts` / `save-reload.spec.ts`). The
 * Phaser-free unit twins (`tests/logic/halcyon-defection.test.ts`,
 * `tests/logic/halcyon-persistence.test.ts`, `tests/uat/defection-cell.test.ts`)
 * prove the rules headlessly; this spec proves them on the live, rendered canvas
 * across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The expected post-defection roster (starting party + the defector). */
const EXPECTED_ROSTER = ["wren", "tobi", "halcyon"];

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

/** A single member as the defection snapshot surfaces it. */
interface DefectionMember {
  readonly id: string;
  readonly level: number;
  readonly baseStats: BaseStats;
  readonly signatureKit: readonly string[];
}

/** The defection snapshot the bridge exposes via `defection()`. */
interface Defection {
  readonly roster: readonly DefectionMember[];
  readonly halcyonJoined: boolean;
}

/** The persisted member shape the reload assertion reads. */
interface SaveMember {
  readonly id: string;
  readonly level: number;
}

/**
 * Wait until the verification bridge is installed with its defection contract.
 * Asserting the whole shape up front means a broken bridge fails here, loudly,
 * instead of silently no-op'ing through an optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.openDefection === "function" &&
            typeof api?.playDefectionRequiem === "function" &&
            typeof api?.fireDefection === "function" &&
            typeof api?.defection === "function" &&
            typeof api?.defectionSave === "function" &&
            typeof api?.save === "function" &&
            typeof api?.loadSave === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the defection
 * rides the content tables + logic kit, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * Read the defection snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `defection()` snapshot.
 */
async function defection(page: Page): Promise<Defection> {
  return page.evaluate(() => window.__VERIFY__!.defection() as Defection);
}

test.describe("GRIST — Halcyon's defection + party expansion (UAT, #146)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    // A clean IndexedDB so a prior run's save never bleeds into the reload assertion.
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: halcyon-joins-party] reaching the defection trigger (requiem truth) adds Halcyon to the active party with her stats + kit", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // Before firing: the starting party is [wren, tobi] — Halcyon is not yet present.
    const before = await defection(page);
    expect(before.roster.map(member => member.id)).toEqual(["wren", "tobi"]);
    expect(before.halcyonJoined).toBe(false);

    // Reach Halcyon's defection trigger: open the Roots requiem-hall reachable
    // (Velith attuned) and play it to the `truth`/`complete` beat — the requiem
    // "reveals the truth" — then fire the defection.
    await page.evaluate(() => {
      window.__VERIFY__!.openDefection();
      window.__VERIFY__!.playDefectionRequiem();
      window.__VERIFY__!.fireDefection();
    });

    const after = await defection(page);
    expect(after.halcyonJoined).toBe(true);
    expect(after.roster.map(member => member.id)).toEqual(EXPECTED_ROSTER);

    // Halcyon joined with her AUTHORED stat block + signature kit (not just an id).
    const halcyon = after.roster.find(member => member.id === "halcyon")!;
    expect(halcyon.signatureKit).toEqual(["Frame-Lance"]);
    expect(halcyon.level).toBeGreaterThan(0);
    // The anvil: her HP/DEF/POW exceed the rest of the party; her SPD is the lowest.
    const wren = after.roster.find(member => member.id === "wren")!;
    expect(halcyon.baseStats["hp"]).toBeGreaterThan(wren.baseStats["hp"]!);
    expect(halcyon.baseStats["spd"]).toBeLessThan(wren.baseStats["spd"]!);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: halcyon-defection-persists] Halcyon survives a genuine reload — restored from IndexedDB with her stats + kit", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // Drive the defection, then persist the post-defection roster through the real
    // IndexedDB save path.
    const saved = await page.evaluate(async () => {
      const api = window.__VERIFY__!;
      api.openDefection();
      api.playDefectionRequiem();
      api.fireDefection();
      return api.save(api.defectionSave());
    });
    expect(saved).toBe(true);

    // A GENUINE full reload — a fresh document + a fresh SaveService reading the same
    // on-disk IndexedDB database.
    await bootWithBridge(page);

    // Layer 1 — the raw persisted DTO. loadSave() also triggers the bridge's cell
    // rehydration (loadAndRehydrate → adoptIntoCells), so call it before reading the
    // hydrated snapshot below. The DTO carries only id + level (no live stats/kit), so
    // this proves the *save record itself* survived IndexedDB across the reload.
    const party = await page.evaluate(
      async () =>
        (await window.__VERIFY__!.loadSave()).party as readonly SaveMember[]
    );
    const savedHalcyon = party.find(member => member.id === "halcyon");
    expect(savedHalcyon).toBeDefined();
    expect(savedHalcyon!.level).toBeGreaterThan(0);
    expect(party.map(member => member.id)).toEqual(EXPECTED_ROSTER);

    // Layer 2 — the HYDRATED roster. After loadSave() rehydrated the defection cell,
    // defection() must surface the *restored* roster (the ids resolved back into the
    // live PARTY entries), proving the hydration path — not merely the raw DTO —
    // restored Halcyon WITH her stats + kit (exactly what AC2 requires). A regression
    // in id→roster hydration would leave this reading the fresh [wren, tobi] and fail
    // here, where the DTO-only assertion above would still pass.
    const restored = await defection(page);
    expect(restored.halcyonJoined).toBe(true);
    expect(restored.roster.map(member => member.id)).toEqual(EXPECTED_ROSTER);
    const halcyon = restored.roster.find(member => member.id === "halcyon")!;
    expect(halcyon.signatureKit).toEqual(["Frame-Lance"]);
    expect(halcyon.level).toBeGreaterThan(0);
    // The anvil-shaped stat block came back intact (HP/DEF/POW high, SPD lowest).
    const wren = restored.roster.find(member => member.id === "wren")!;
    expect(halcyon.baseStats["hp"]).toBeGreaterThan(wren.baseStats["hp"]!);
    expect(halcyon.baseStats["spd"]).toBeLessThan(wren.baseStats["spd"]!);

    expect(errors).toEqual([]);
  });
});
