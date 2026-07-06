/**
 * The Phase-3 encounter-escalation verification (UAT) suite — the live-build half of
 * the Validation Journey for #108. Boots the real built game with the verification
 * bridge enabled (`?uat=1`) and reads the shipped escalation ladder scene-agnostically
 * through `window.__VERIFY__.encounterLadder()` to prove, empirically against the live
 * app, the two halves of the #108 acceptance criteria:
 *   - ">=4 distinct ATB encounters are playable across the run", and
 *   - "difficulty escalates while running entirely on the reused Phase-2 sim
 *     (no combat-math change)".
 *
 * Mirrors `tests/e2e/enemy-family.spec.ts` (the #138 data-only twin): the escalation
 * ladder is authored DATA on the existing `EncounterDef` schema, not a new engine, so
 * the same scene-agnostic bridge-read shape verifies it with no engine-code edit. The
 * Phaser-free unit twin (`tests/logic/encounter-escalation.test.ts`) proves the
 * ladder + metric + validators headlessly; this spec proves the SAME shipped data is
 * present and strictly-escalating on the live built game, and is deterministic across
 * a genuine page reload.
 *
 * Evidence markers (the required test titles):
 * - [EVIDENCE: encounter-ladder-escalates] — ≥4 distinct encounters, strictly escalating.
 * - [EVIDENCE: encounter-ladder-deterministic] — the ladder digest is reproducible across a reload.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/** One rung of the ladder snapshot the bridge exposes via `encounterLadder()`. */
interface EncounterRung {
  readonly id: string;
  readonly enemies: readonly string[];
  readonly difficulty: number;
}

/** The escalation-ladder snapshot the bridge exposes via `encounterLadder()`. */
interface EncounterLadder {
  readonly count: number;
  readonly distinct: boolean;
  readonly escalates: boolean;
  readonly rungs: readonly EncounterRung[];
  readonly enemiesResolved: boolean;
  readonly hash: string;
}

/**
 * Wait until the bridge installs with the encounter-ladder read present — proof the
 * `?uat=1` surface is up and the #108 entry is wired (a broken bridge fails here,
 * loudly, instead of silently no-op'ing through an optional chain).
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => typeof window.__VERIFY__?.encounterLadder === "function"
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Boot the app with the verification bridge enabled (scene-agnostic — the ladder
 * rides the shipped content tables, not the active scene).
 * @param page - The Playwright page.
 */
async function bootWithBridge(page: Page): Promise<void> {
  await page.goto("/?scene=battle&uat=1");
  await waitForBridge(page);
}

/**
 * Read the escalation-ladder snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The `encounterLadder()` snapshot.
 */
async function readLadder(page: Page): Promise<EncounterLadder> {
  return page.evaluate(
    () => window.__VERIFY__!.encounterLadder() as EncounterLadder
  );
}

test.describe("GRIST — the Phase-3 encounter-escalation verification (UAT, #108)", () => {
  test("[EVIDENCE: encounter-ladder-escalates] the live build ships >=4 distinct ATB encounters whose difficulty strictly escalates on the reused Phase-2 core", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootWithBridge(page);

    const ladder = await readLadder(page);

    // ">=4 distinct ATB encounters are playable across the run".
    expect(ladder.count).toBeGreaterThanOrEqual(4);
    expect(ladder.distinct).toBe(true);
    expect(ladder.rungs).toHaveLength(ladder.count);
    expect(new Set(ladder.rungs.map(rung => rung.id)).size).toBe(ladder.count);

    // Every rung is a real encounter with at least one enemy, and every enemy is
    // drawn from the existing ENEMIES table — the "reuses the Phase-2 core, no new
    // engine / no parallel combat schema" structural proof.
    for (const rung of ladder.rungs) {
      expect(rung.enemies.length).toBeGreaterThanOrEqual(1);
    }
    expect(ladder.enemiesResolved).toBe(true);

    // "difficulty escalates": the bridge's pure verdict AND the raw adjacent scores.
    expect(ladder.escalates).toBe(true);
    for (let i = 1; i < ladder.rungs.length; i += 1) {
      expect(ladder.rungs[i]!.difficulty).toBeGreaterThan(
        ladder.rungs[i - 1]!.difficulty
      );
    }

    expect(ladder.hash).toMatch(/^[0-9a-f]{8}$/);
    // The whole point of the success path: zero console errors booting the build.
    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: encounter-ladder-deterministic] the shipped ladder digest is byte-identical across a genuine reload", async ({
    page,
  }) => {
    await bootWithBridge(page);
    const first = await readLadder(page);

    // A GENUINE full reload re-reads the SAME shipped content tables and must
    // reproduce a byte-identical ladder snapshot — the determinism thesis for a
    // pure, RNG-free content ordering.
    await bootWithBridge(page);
    const second = await readLadder(page);

    expect(second.hash).toBe(first.hash);
    expect(second.count).toBe(first.count);
    expect(second.rungs.map(rung => rung.id)).toEqual(
      first.rungs.map(rung => rung.id)
    );
    expect(second.rungs.map(rung => rung.difficulty)).toEqual(
      first.rungs.map(rung => rung.difficulty)
    );
  });
});
