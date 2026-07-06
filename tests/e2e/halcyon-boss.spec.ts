/**
 * The Halcyon frame-knight boss verification (UAT) suite — the live-build half of
 * the Validation Journey for #109 (a `type:Sub-task` under Story #96, the Ch.2
 * chase climax). The Phaser-free unit twin (`tests/logic/halcyon-boss.test.ts`)
 * proves the boss EnemyDef, the Break-gated markers, the encounter/escalation
 * placement, the Break beat on the real sim, and the grist-spend tension
 * headlessly; THIS spec proves the SAME shipped content is present on the live,
 * rendered build and is deterministic across a genuine page reload.
 *
 * The boss is authored as DATA on the existing `EncounterDef` / `EnemyDef` schema
 * (no new engine, no combat-math change), so — exactly like the #108 escalation
 * twin (`encounter-escalation.spec.ts`) it reuses — the same scene-agnostic bridge
 * read (`window.__VERIFY__.encounterLadder()`) verifies it with no engine-code
 * edit. The Halcyon chase rides the shipped {@link ESCALATION_LADDER}, so it
 * surfaces automatically as the bridge resolves the live content tables.
 *
 * Evidence markers (the required test titles):
 * - [EVIDENCE: halcyon-boss-tops-ladder] — the Halcyon chase is the last rung of
 *   the live escalation ladder, references the distinct `halcyon-knight` enemy,
 *   and is strictly the hardest encounter of the run (the end-of-Ch.2 climax).
 * - [EVIDENCE: halcyon-boss-deterministic] — the shipped ladder digest (with the
 *   boss appended) is byte-identical across a genuine reload.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/** The Halcyon chase encounter id — the Ch.2 climax boss fight (#109). */
const HALCYON_CHASE = "halcyon-chase";
/** The Halcyon frame-knight boss enemy id — distinct from the playable defector. */
const HALCYON_KNIGHT = "halcyon-knight";

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
 * `?uat=1` surface is up (a broken bridge fails here, loudly, instead of silently
 * no-op'ing through an optional chain).
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

test.describe("GRIST — the Halcyon frame-knight boss verification (UAT, #109)", () => {
  test("[EVIDENCE: halcyon-boss-tops-ladder] the live build ships the Halcyon chase as the last, strictly-hardest rung referencing the distinct halcyon-knight enemy", async ({
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

    // The boss rides the shipped escalation ladder, which stays valid (≥4 distinct,
    // strictly escalating) with the climax appended — the structural proof it was
    // added by authoring data on the reused Phase-2 core.
    expect(ladder.count).toBeGreaterThanOrEqual(4);
    expect(ladder.distinct).toBe(true);
    expect(ladder.escalates).toBe(true);
    expect(ladder.enemiesResolved).toBe(true);

    // The Halcyon chase is the end-of-Ch.2 climax: it sits at the TOP of the ladder.
    const top = ladder.rungs[ladder.rungs.length - 1]!;
    expect(top.id).toBe(HALCYON_CHASE);

    // A solo-boss encounter that references the distinct frame-knight boss enemy
    // (the boss form — NOT the out-of-scope `halcyon` playable defector).
    expect(top.enemies).toEqual([HALCYON_KNIGHT]);

    // Strictly the hardest fight of the run — every other rung is easier.
    for (const rung of ladder.rungs) {
      if (rung.id !== HALCYON_CHASE) {
        expect(top.difficulty).toBeGreaterThan(rung.difficulty);
      }
    }

    // The success path: zero console errors booting the live build with the boss.
    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: halcyon-boss-deterministic] the shipped ladder digest with the boss appended is byte-identical across a genuine reload", async ({
    page,
  }) => {
    await bootWithBridge(page);
    const first = await readLadder(page);
    expect(first.rungs.map(rung => rung.id)).toContain(HALCYON_CHASE);

    // A GENUINE full reload re-reads the SAME shipped content tables and must
    // reproduce a byte-identical ladder snapshot — the determinism thesis for a
    // pure, RNG-free content ordering, now with the climax boss present.
    await bootWithBridge(page);
    const second = await readLadder(page);

    // The whole snapshot — hash, count, distinct/escalates/enemiesResolved flags,
    // and every rung's id + lineup + score — must be byte-identical across the
    // reload, not merely the digest and ids.
    expect(second).toEqual(first);
  });
});
