/**
 * The Reckoning world-turn verification (UAT) suite — the Validation Journey for #125
 * (PRD #43 FR7 / AC5 / Scope-IN 6; `wiki/narrative/main-quest.md` "The Reckoning — the
 * world-turn"; `wiki/narrative/themes-and-tone.md`). Drives the in-game
 * `window.__VERIFY__` bridge against the LIVE built game (and a real browser IndexedDB)
 * to prove Sallow's Second Sundering EMPIRICALLY — not merely compiled (the issue's
 * Validation Journey: "Unit tests / lint / typecheck ALONE are NOT acceptable
 * evidence"). It pins a fixed seed and asserts the issue's two binding evidence markers
 * across ALL FIVE acceptance clauses (before/after state + a determinism hash):
 *
 * - [EVIDENCE: reckoning-flips-world-state] — triggering the Reckoning flips world-state
 *   `reach → ashfall`, renders lower Vanta + a whole region to ash, and drains the
 *   overworld's color/music; the shipped Ashfall map (#139) reads the turned world at
 *   full desaturation; the transform is deterministic (identical `reckoning().hash`
 *   progression across two seeded drives and a genuine reload) and survives IndexedDB.
 * - [EVIDENCE: reckoning-party-scatter-sable-lost] — the turn scatters the party down to
 *   the POV survivor (Wren) with the rest scattered (reassembled by the Act II reunions),
 *   loses Sable, and seeds the reunion board; and the set-piece is keystone-gated — the
 *   trigger is derived from the Ch.5 Mourne keystone, and a set-piece opened un-triggered
 *   never turns the world (the soft-gate).
 *
 * The bridge is enabled with `?uat=1`; the world-turn rides the content tables + the pure
 * `logic/narrative/reckoning` kit (which composes the shipped world-flip, keystone, and
 * reunion systems), so the active scene is irrelevant and the default boot is used
 * (mirrors `world-state.spec.ts` / `act2-reunion.spec.ts`). The Phaser-free unit twin
 * (`tests/logic/reckoning.test.ts`) proves the rules headlessly; this spec proves they
 * integrate on the live game across a real document boundary.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
/** The full Act I party carried into the Reckoning (Wren + Tobi + Halcyon). */
const ACT_ONE_ROSTER = ["wren", "tobi", "halcyon"];
/** The swath the Second Sundering renders to ash: lower Vanta + the upper-Vanta region. */
const ASH_SWATH = ["lower-vanta", "upper-vanta"];

/** The Reckoning snapshot the bridge exposes via `reckoning()`. */
interface Reckoning {
  readonly triggered: boolean;
  readonly worldStateBefore: string;
  readonly worldState: string;
  readonly worldTurned: boolean;
  readonly ashedRegions: readonly string[];
  readonly rosterBefore: readonly string[];
  readonly roster: readonly string[];
  readonly scattered: readonly string[];
  readonly sableLost: boolean;
  readonly drained: boolean;
  readonly beat: number;
  readonly phase: string;
  readonly complete: boolean;
  readonly hash: string;
}

/** The transformed-map snapshot the bridge exposes via `worldMap()` (#139). */
interface WorldMap {
  readonly worldState: string;
  readonly desaturation: number;
}

/** The persisted member shape the reload assertion reads. */
interface SaveMember {
  readonly id: string;
}

/**
 * Wait until the verification bridge is installed with its Reckoning contract. Asserting
 * the whole shape up front means a broken bridge fails here, loudly, instead of silently
 * no-op'ing through an optional chain.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const api = window.__VERIFY__;
          return (
            typeof api?.openReckoning === "function" &&
            typeof api?.playReckoning === "function" &&
            typeof api?.playReckoningToCompletion === "function" &&
            typeof api?.reckoning === "function" &&
            typeof api?.reckoningSave === "function" &&
            typeof api?.worldMap === "function" &&
            typeof api?.save === "function" &&
            typeof api?.loadSave === "function"
          );
        }),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the world-turn
 * rides the content tables + logic kit, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?uat=1");
  await waitForBridge(page);
}

/**
 * Read the Reckoning snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `reckoning()` snapshot.
 */
async function reckoning(page: Page): Promise<Reckoning> {
  return page.evaluate(() => window.__VERIFY__!.reckoning() as Reckoning);
}

/**
 * Open the default (keystone-triggered) set-piece and sample the hash progression from
 * the sealed boot through each beat to completion — the determinism handle.
 * @param page - The Playwright page.
 * @returns The hash at boot and after each beat.
 */
async function sampleProgression(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const api = window.__VERIFY__!;
    api.openReckoning();
    const hashes = [api.reckoning().hash];
    for (let guard = 0; guard < 8; guard++) {
      if (api.reckoning().complete) break;
      api.playReckoning();
      hashes.push(api.reckoning().hash);
    }
    return hashes;
  });
}

test.describe("GRIST — the Reckoning world-turn (UAT, #125)", () => {
  test.beforeEach(async ({ page }) => {
    await bootWithBridge(page);
    // A clean IndexedDB so a prior run's save never bleeds into the reload assertion.
    await page.evaluate(() => window.__VERIFY__!.clearSave());
  });

  test("[EVIDENCE: reckoning-flips-world-state] triggering the Reckoning flips reach → ashfall, ashes a swath, and drains the overworld — deterministically and across a reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // ── Before the Reckoning ─────────────────────────────────────────────────
    await page.evaluate(() => window.__VERIFY__!.openReckoning());
    const before = await reckoning(page);
    // The Ch.5 keystone triggered it (the trigger is DERIVED from the keystone).
    expect(before.triggered).toBe(true);
    expect(before.worldState).toBe("reach");
    expect(before.worldTurned).toBe(false);
    expect(before.ashedRegions).toEqual([]);
    expect(before.roster).toEqual(ACT_ONE_ROSTER);
    expect(before.sableLost).toBe(false);
    expect(before.drained).toBe(false);

    // ── Trigger the world-turn ───────────────────────────────────────────────
    await page.evaluate(() => window.__VERIFY__!.playReckoningToCompletion());
    const after = await reckoning(page);
    // Clause 1 — the world flips reach → ashfall.
    expect(after.worldStateBefore).toBe("reach");
    expect(after.worldState).toBe("ashfall");
    expect(after.worldTurned).toBe(true);
    // Clause 2 — lower Vanta + a whole region rendered to ash.
    expect(after.ashedRegions).toEqual(ASH_SWATH);
    // Clause 5 — the overworld's color/music drain.
    expect(after.drained).toBe(true);
    expect(after.complete).toBe(true);
    // Observably transformed: the completed digest differs from the pre-turn digest.
    expect(after.hash).not.toBe(before.hash);
    expect(after.hash).toMatch(/^[0-9a-f]{8}$/);

    // The turned world reads through the shipped Ashfall map (#139) at full desaturation
    // once the Reckoning save is adopted — the color drain is real, not just a flag.
    await page.evaluate(async () => {
      const api = window.__VERIFY__!;
      api.openReckoning();
      api.playReckoningToCompletion();
      await api.save(api.reckoningSave());
    });
    const map = await page.evaluate(
      () => window.__VERIFY__!.worldMap() as WorldMap
    );
    expect(map.worldState).toBe("ashfall");
    expect(map.desaturation).toBe(1);

    // ── Determinism: identical hash progression across two drives + a reload ──
    const first = await sampleProgression(page);
    expect(first.every(hash => /^[0-9a-f]{8}$/.test(hash))).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(1);
    const second = await sampleProgression(page);
    expect(second).toEqual(first);
    // A GENUINE full reload reproduces the same progression byte-for-byte.
    await bootWithBridge(page);
    const afterReload = await sampleProgression(page);
    expect(afterReload).toEqual(first);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: reckoning-party-scatter-sable-lost] the turn scatters the party and loses Sable, is keystone-gated, and survives reload", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(error.message));

    // ── Soft-gate: opened un-triggered, firing never turns the world ──────────
    await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openReckoning({ triggered: false });
      api.playReckoningToCompletion();
    });
    const gated = await reckoning(page);
    expect(gated.triggered).toBe(false);
    expect(gated.phase).toBe("gated");
    expect(gated.worldState).toBe("reach");
    expect(gated.roster).toEqual(ACT_ONE_ROSTER);
    expect(gated.sableLost).toBe(false);

    // ── Triggered: the scatter + Sable-loss land ─────────────────────────────
    await page.evaluate(() => {
      const api = window.__VERIFY__!;
      api.openReckoning();
      api.playReckoningToCompletion();
    });
    const after = await reckoning(page);
    // Clause 3 — the party is scattered down to the POV survivor (Wren)...
    expect(after.roster).toEqual(["wren"]);
    // ...and everyone else is scattered (reassembled through the Act II reunions).
    expect(after.scattered).toEqual(["tobi", "halcyon"]);
    // Clause 4 — Sable is lost (a flag, not a roster removal).
    expect(after.sableLost).toBe(true);

    // ── Persist + genuine reload: the turned world survives IndexedDB ─────────
    const saved = await page.evaluate(async () => {
      const api = window.__VERIFY__!;
      api.openReckoning();
      api.playReckoningToCompletion();
      return api.save(api.reckoningSave());
    });
    expect(saved).toBe(true);

    await bootWithBridge(page);

    // Layer 1 — the raw persisted DTO: the scattered survivor + the turned world.
    const restored = await page.evaluate(
      async () => await window.__VERIFY__!.loadSave()
    );
    expect(
      (restored.party as readonly SaveMember[]).map(member => member.id)
    ).toEqual(["wren"]);
    expect(restored.worldState).toBe("ashfall");

    // Layer 2 — the HYDRATED Reckoning read: still turned, still scattered, Sable still
    // lost after the reload rehydrated the cell. The scattered-companion list survives
    // too (the pre-Reckoning roster is persisted, so a reload doesn't lose WHO scattered).
    const hydrated = await reckoning(page);
    expect(hydrated.worldState).toBe("ashfall");
    expect(hydrated.roster).toEqual(["wren"]);
    expect(hydrated.sableLost).toBe(true);
    expect(hydrated.scattered).toEqual(["tobi", "halcyon"]);

    expect(errors).toEqual([]);
  });
});
