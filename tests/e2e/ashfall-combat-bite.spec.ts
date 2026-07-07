/**
 * Ashfall combat-bite verification (UAT) — the live end-to-end proof for the #266
 * balance pass, and the sweep-driven exercise of #243's KO handling in real play.
 * Boots a standalone Ashfall boss fight through the gated `?world=ashfall` seam and
 * proves, on the production preview build, that:
 *
 *  1. The warped #141 Ashfall variant is actually FIELDED (the Ashling reads its
 *     guttering variant HP, not its base block) — the variants were authored but
 *     never fought before this pass.
 *  2. Naive Strike-spam BITES: a party member is driven to 0 HP (a real KO — play
 *     continues to the living ally, not a soft-lock) and the fight resolves to a
 *     Defeat. This is the first time #243's KO handling fires under real, lethal
 *     combat rather than a synthetic repro.
 *  3. The systems-literate line WINS the same seeded fight: the bridge's Spark
 *     (mixed) auto-play beats the boss that Strike-spam loses — Strike-spam is
 *     measurably inferior, exactly the ticket's thesis.
 *
 * The pinned target bands live in the headless harness (tests/logic/balance.test.ts);
 * this suite is the "an agent actually played the harder fight" layer above them.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Hard cap on driven decisions per fight (loop guard). */
const MAX_TURNS = 400;
/** The-ashling's base HP — the Ashfall variant must read strictly heavier. */
const ASHLING_BASE_HP = 220;

/**
 * Boot straight into a standalone Ashfall boss battle via the gated seams.
 * @param page - The Playwright page.
 * @param seed - The battle seed.
 */
async function bootAshfallBoss(page: Page, seed: number): Promise<void> {
  await page.goto(
    `/?scene=battle&uat=1&world=ashfall&encounter=the-cage&seed=${seed}`
  );
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe("Battle");
}

test.describe("GRIST — Ashfall combat bite (UAT, #266)", () => {
  test("[ashfall-variant-fielded] the fought boss reads its warped #141 variant, not the base block", async ({
    page,
  }) => {
    await bootAshfallBoss(page, 7);
    const enemyHp = await page.evaluate(
      () => window.__VERIFY__?.state()?.enemies[0]?.hp ?? 0
    );
    // The guttering Ashling variant is strictly heavier than the base Ashling.
    expect(enemyHp).toBeGreaterThan(ASHLING_BASE_HP);
  });

  test("[strike-spam-bites-and-loses] a KO fires (play continues) and Strike-spam is defeated", async ({
    page,
  }) => {
    await bootAshfallBoss(page, 7);
    const result = await page.evaluate(maxTurns => {
      const v = window.__VERIFY__!;
      const READY = 100;
      let koWithLivingAlly = false;
      for (let i = 0; i < maxTurns; i += 1) {
        v.advanceTurn();
        const s = v.state()!;
        if (s.phase === "won" || s.phase === "lost") {
          break;
        }
        const downed = s.party.filter(p => p.hp <= 0).length;
        const living = s.party.filter(p => p.hp > 0).length;
        if (downed > 0 && living > 0) {
          koWithLivingAlly = true;
        }
        // Act with whichever party member is ready — faithful Strike-spam.
        const idx = s.party.findIndex(p => p.hp > 0 && p.atb >= READY);
        if (idx < 0) {
          continue;
        }
        const tgt = s.enemies.findIndex(e => e.hp > 0);
        if (tgt < 0) {
          continue;
        }
        v.act({
          kind: "strike",
          actor: { side: "party", index: idx },
          target: { side: "enemies", index: tgt },
        });
      }
      return { phase: v.state()?.phase ?? "", koWithLivingAlly };
    }, MAX_TURNS);
    // A party member was KO'd while an ally still stood — play continued (#243)…
    expect(result.koWithLivingAlly).toBe(true);
    // …and naive Strike-spam is defeated by the Ashfall boss.
    expect(result.phase).toBe("lost");
  });

  test("[mixed-line-wins-same-seed] the Spark/mixed auto-play wins the fight Strike-spam lost", async ({
    page,
  }) => {
    await bootAshfallBoss(page, 7);
    const phase = await page.evaluate(
      maxTurns => window.__VERIFY__?.autoWin(maxTurns) ?? "",
      MAX_TURNS
    );
    expect(phase).toBe("won");
  });
});
