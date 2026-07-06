/**
 * Standalone battle victory/defeat resolution verification (UAT) — sub-task #225.
 *
 * The bug: a *standalone* battle boot (`?scene=battle`, formerly the cold-boot
 * default) had no win/lose resolution — the resolved fight froze forever because
 * `#maybeReturnToField()` only routes a field-launched battle. This suite proves
 * the fix on the live production-style canvas: a resolved standalone battle now
 * presents a terminal Victory/Defeat summary that HOLDS the scene (so the existing
 * battle specs, which autoWin then read `state()` on the Battle scene, stay
 * intact), and a DELIBERATE advance (a real Enter, routed through the InputService
 * semantic bus) transitions to the Title front door.
 *
 * Both terminal journeys are driven end-to-end through the `window.__VERIFY__`
 * bridge + real keyboard input:
 * - [EVIDENCE: win-summary-enter-title] win → summary shown → Enter → Title.
 * - [EVIDENCE: lose-summary-enter-title] lose → summary shown → Enter → Title.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
const FIXED_SEED = 12345;

/** Wait until the running game reports the given scene key. */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/** Boot the standalone battle at a fixed seed with the bridge enabled. */
async function bootBattle(page: Page): Promise<void> {
  await page.goto(`/?scene=battle&uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Battle");
}

/** Poll until the standalone terminal summary is being presented, then return it. */
async function waitForSummary(page: Page): Promise<{
  outcome: string;
  won: boolean;
  title: string;
  stats: readonly string[];
}> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.summary() !== null), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(true);
  return page.evaluate(() => window.__VERIFY__!.summary()!);
}

test.describe("GRIST — standalone battle victory/defeat resolution (UAT #225)", () => {
  test("[EVIDENCE: win-summary-enter-title] winning shows the Victory summary, then Enter routes to the Title", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootBattle(page);

    // Play the seeded fight to VICTORY on the live canvas.
    const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
    expect(phase).toBe("won");

    // The summary HOLDS the Battle scene — it does not auto-transition (the compat
    // contract the existing battle specs rely on): the scene is still Battle and the
    // resolved state is still readable through the bridge.
    expect(await page.evaluate(() => window.__VERIFY__?.scene())).toBe(
      "Battle"
    );
    expect(await page.evaluate(() => window.__VERIFY__?.state()?.phase)).toBe(
      "won"
    );

    // The Victory summary is presented, surfacing the outcome + the grist earned.
    const summary = await waitForSummary(page);
    expect(summary.won).toBe(true);
    expect(summary.title).toBe("VICTORY");
    expect(summary.outcome).toBe("win");
    expect(summary.stats.some(line => /grist/i.test(line))).toBe(true);

    // A DELIBERATE advance — a real Enter routed through the InputService — leaves
    // the frozen dead-end behind and lands on the Title front door.
    await page.keyboard.press("Enter");
    await waitForScene(page, "Title");

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: lose-summary-enter-title] losing shows the Defeat summary, then Enter routes to the Title", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootBattle(page);

    // Play the seeded fight to DEFEAT on the live canvas: each turn, advance to the
    // next decision and spend every party member's ready turn on Defend (a
    // turn-ending, non-winning action), so the party never fells an enemy while the
    // enemies chip it down — a party that only defends loses every encounter (there
    // is no healing). Defending all seats also clears a slain member's still-ready
    // gauge so the turn order keeps flowing to the wipe. Bounded so a stall can never
    // hang the suite; drives the SAME `advanceTurn` + `act` bridge the play-to-victory
    // spec uses, no bespoke seam.
    const phase = await page.evaluate(() => {
      const verify = window.__VERIFY__;
      if (!verify) {
        throw new Error("verification bridge not installed");
      }
      for (let turn = 0; turn < 600; turn += 1) {
        verify.advanceTurn();
        const state = verify.state();
        const outcome = state?.phase ?? "";
        if (outcome === "won" || outcome === "lost") {
          return outcome;
        }
        (state?.party ?? []).forEach((_member, index) =>
          verify.act({ kind: "defend", actor: { side: "party", index } })
        );
      }
      return verify.state()?.phase ?? "";
    });
    expect(phase).toBe("lost");

    // The summary HOLDS the Battle scene here too — no auto-transition on a loss.
    expect(await page.evaluate(() => window.__VERIFY__?.scene())).toBe(
      "Battle"
    );
    expect(await page.evaluate(() => window.__VERIFY__?.state()?.phase)).toBe(
      "lost"
    );

    // The Defeat summary is presented (a clear next action, not a freeze).
    const summary = await waitForSummary(page);
    expect(summary.won).toBe(false);
    expect(summary.title).toBe("DEFEAT");
    expect(summary.outcome).toBe("lose");

    // A deliberate Enter routes the defeated player back to the Title.
    await page.keyboard.press("Enter");
    await waitForScene(page, "Title");

    expect(errors).toEqual([]);
  });
});
