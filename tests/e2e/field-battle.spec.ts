/**
 * Field↔Battle wiring verification (UAT) suite — the manifest for sub-task #82.
 * Boots the Field scene (`?scene=field`) into Room A (`exploring`), engages the
 * encounter to launch the *existing* Phase-1 Battle scene, drives the real fight
 * to victory through the in-game `window.__VERIFY__` bridge, and asserts —
 * empirically against the live canvas — the acceptance markers:
 *
 * - [room-a-win-returns-to-field] Room A scrapper is winnable with Strike + Spark
 *   (AP visibly drops), control returns to the Field, and grist is credited (AC2).
 * - [room-b-two-enemy-fight-consumed] the Room B scrapper + render-construct
 *   encounter launches, is won, and its result is consumed (AC3 wiring). The
 *   Rendering / Pressure→Break mechanics it teaches are reused from Phase-1 and
 *   proven at the sim level by tests/verification/combat-rules.verify.test.ts —
 *   this ticket reuses, not re-specs, combat.
 * - [room-c-ashling-grist-shard-choice] the Ashling boss is beatable and yields
 *   the Marrow shard + surfaces the free-vs-wield choice, with 20+ grist (AC4).
 *
 * Each fight is driven by the bridge's `autoWin` (the same Strike/Spark policy the
 * play-to-victory spec proves wins); this spec only adds the Field launch/return
 * assertions, so the battle and field specs stay green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
const FIXED_SEED = 12345;

/** A live field snapshot from the bridge. */
interface FieldSnap {
  readonly scene: string;
  readonly room: string;
  readonly grist: number;
  readonly shards: readonly string[];
  readonly pendingChoiceShard: string | null;
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
 * Boot the Field scene at a fixed seed (it lands in Room A, `exploring`), then
 * engage Room A's encounter so the active scene settles on the launched Battle.
 * @param page - The Playwright page.
 */
async function bootFieldIntoBattle(page: Page): Promise<void> {
  await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Field");
  await page.evaluate(() => window.__VERIFY__?.engage());
  await waitForScene(page, "Battle");
}

/**
 * Drive the launched battle to a terminal phase via the bridge's deterministic
 * `autoWin`, then wait for control to return to the Field (the Field is visible
 * and `exploring` between fights — the descent does not auto-chain). Returns the
 * field snapshot after return.
 * @param page - The Playwright page.
 * @returns The field snapshot once control is back on the Field scene.
 */
async function winAndReturnToField(page: Page): Promise<FieldSnap | null> {
  const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
  expect(phase).toBe("won");
  await waitForScene(page, "Field");
  return page.evaluate(() => window.__VERIFY__?.field() ?? null);
}

/**
 * From the (visible) Field, traverse to the next room — firing its trigger and
 * launching the next encounter — then wait for the Battle scene to take over.
 * @param page - The Playwright page.
 */
async function traverseToNextBattle(page: Page): Promise<void> {
  await page.evaluate(() => window.__VERIFY__?.traverse());
  await waitForScene(page, "Battle");
}

test.describe("GRIST — Field↔Battle wiring verification (UAT)", () => {
  test("[room-a-win-returns-to-field] Room A: Spark drops AP, the win returns to the Field with grist (AC2)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootFieldIntoBattle(page);

    // Advance to Wren's opening decision and cast Spark; assert AP visibly dropped.
    const apDrop = await page.evaluate(() => {
      const verify = window.__VERIFY__;
      if (!verify) {
        throw new Error("bridge not installed");
      }
      verify.advanceTurn();
      const before = verify.state()?.party[0]?.ap ?? -1;
      verify.act({
        kind: "craft",
        id: "spark",
        actor: { side: "party", index: 0 },
        target: { side: "enemies", index: 0 },
      });
      // Read AP immediately after the cast — before any further turn advance — so
      // per-turn AP regen can't mask the Spark's spend.
      const after = verify.state()?.party[0]?.ap ?? -1;
      return { before, after };
    });
    // Spark costs 4 AP — the drop is exactly the Craft cost (no regen masking it).
    expect(apDrop.after).toBe(apDrop.before - 4);

    const field = await winAndReturnToField(page);
    expect(field?.scene).toBe("Field");
    // Exact single-consumption credit: starting grist 10 + Room A scrapper loot 6
    // = 16. The exact value catches a double-fold of the consumed battle result.
    expect(field?.grist).toBe(16);
    expect(errors).toEqual([]);
  });

  test("[room-b-rendering-break-finisher] Room B (scrapper + render-construct) launches the Rendering/Break encounter, is won, and is consumed (AC3)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootFieldIntoBattle(page);
    // Clear Room A (exact: 10 + 6 = 16), then walk to the Room B scrapper + Vesper
    // (render-construct) fight.
    const afterA = await winAndReturnToField(page);
    expect(afterA?.grist).toBe(16);
    await traverseToNextBattle(page);

    // AC3's content: Room B launches the *two-enemy* encounter (the scrapper +
    // the Flux render-construct that teaches Rendering/Break). This sub-task wires
    // and consumes that fight; the Rendering DoT + Pressure→Break→Severance
    // mechanics themselves are reused from Phase-1 (Epic #24) and are proven at the
    // sim level by tests/verification/combat-rules.verify.test.ts
    // ([EVIDENCE: break-severance] / Rendering DoT), per this ticket's "reuse, do
    // not re-spec" scope. Here we prove the leg: the right encounter launched.
    const launched = await page.evaluate(() => window.__VERIFY__?.state());
    expect(launched?.enemies.map(enemy => enemy.ref)).toEqual([
      "marrow-scrapper",
      "render-construct",
    ]);

    // Play it to victory; control returns to the Field with the loot consumed
    // exactly once: 16 + scrapper 6 + construct 10 = 32.
    const afterB = await winAndReturnToField(page);
    expect(afterB?.grist).toBe(32);
    expect(errors).toEqual([]);
  });

  test("[room-c-ashling-grist-shard-choice] the Ashling yields the shard + the choice, 20+ grist (AC4)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootFieldIntoBattle(page);

    // Room A → (walk) → Room B → (walk) → Room C: each fight is won, control
    // returns to the Field, and the player traverses to the next encounter. The
    // grist totals are exact (10 + 6 = 16, +16 = 32, +20 = 52) so a double-fold of
    // any consumed result would fail the chain.
    const afterA = await winAndReturnToField(page);
    expect(afterA?.grist).toBe(16);

    await traverseToNextBattle(page);
    const afterB = await winAndReturnToField(page);
    expect(afterB?.grist).toBe(32);

    await traverseToNextBattle(page);
    const afterC = await winAndReturnToField(page);

    // The Ashling dropped the Marrow shard and raised the free-vs-wield choice.
    expect(afterC?.shards).toEqual(["marrow-bound"]);
    expect(afterC?.pendingChoiceShard).toBe("marrow-bound");
    // Its 20-grist loot landed exactly once on top of the prior rooms (32 + 20).
    expect(afterC?.grist).toBe(52);
    expect(errors).toEqual([]);
  });
});
