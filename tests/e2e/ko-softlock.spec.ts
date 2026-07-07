/**
 * Region-play KO soft-lock regression (UAT) suite — the Validation Journey for
 * bug #243. Reproduces the exact QA repro on the live canvas: travel into a region
 * through the World Map front door, engage a REAL encounter battle, drive one party
 * member to 0 HP while the other survives, and prove the fight does NOT freeze —
 * the turn passes to the living ally, the command menu opens for them, and a command
 * lands (keyboard/mouse were dead in the QA repro; here the survivor acts). A second
 * scenario wipes the whole party and proves the battle resolves to Defeat and returns
 * the player to the region/map — never a frozen, input-dead battle.
 *
 * Root cause (fixed in src/logic/combat/turn-order.ts): a KO'd combatant keeps
 * ticking its ATB gauge to full, and `collectReady` mapped any full-gauge combatant
 * to the ready queue regardless of HP. A downed party member then sat at the head of
 * the turn queue — the runner paused for a player command the HP-gated HUD never
 * surfaced, and `resolveEnemyTurns` bailed on the corpse — an input-dead soft-lock.
 * The dead never act, so they are never ready. The pure-sim proof lives in
 * tests/logic/combat-ko-softlock.test.ts; this suite proves it end-to-end in play.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 20_000;
/** Dwell after a keystroke so the next one lands in its own tick. */
const KEY_DWELL = 120;
/** Hard cap on injected enemy strikes needed to fell one member (loop guard). */
const MAX_STRIKES = 400;

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
 * Wait until the verification bridge exposes the entry points this suite drives.
 * @param page - The Playwright page.
 */
async function waitForBridge(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            typeof window.__VERIFY__?.scene === "function" &&
            typeof window.__VERIFY__?.act === "function" &&
            typeof window.__VERIFY__?.advanceTurn === "function" &&
            typeof window.__VERIFY__?.state === "function" &&
            typeof window.__VERIFY__?.hud === "function"
        ),
      { timeout: SEEN_TIMEOUT }
    )
    .toBe(true);
}

/**
 * Focus the game canvas so real keyboard events reach Phaser.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Press a key, then dwell so the next keystroke lands in its own tick.
 * @param page - The Playwright page.
 * @param key - The key to press.
 */
async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/** Collect console + page errors so a test can assert the run stayed clean. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", m => {
    if (m.type() === "error") {
      errors.push(m.text());
    }
  });
  page.on("pageerror", e => errors.push(e.message));
  return errors;
}

/**
 * Enter through the real World Map front door and engage the first region
 * encounter as a REAL battle (returnTo: Region) — the exact path the QA player
 * took (Field → Map → travel → engage). Leaves the active scene on the launched
 * Battle.
 * @param page - The Playwright page.
 */
async function travelIntoRegionBattle(page: Page): Promise<void> {
  await page.goto("/?scene=worldmap&uat=1");
  await waitForBridge(page);
  await page.evaluate(() => window.__VERIFY__?.clearSave());
  await waitForScene(page, "WorldMap");
  await focusCanvas(page);
  // Travel into the first available region (the Marrow), then engage its encounter.
  await press(page, "Enter");
  await waitForScene(page, "Region");
  await focusCanvas(page);
  await press(page, "Enter");
  await waitForScene(page, "Battle");
}

/**
 * Reduce the given party member to 0 HP by injecting deterministic enemy strikes
 * against them through the bridge — the pure reducer applies each synchronously.
 * The member's own ATB gauge is left untouched (they never act), reproducing the
 * QA precondition: a downed member whose gauge is full. Returns the party HP vector
 * after the member falls.
 * @param page - The Playwright page.
 * @param partyIndex - The seat to fell.
 * @returns The party HP vector after the knockout.
 */
async function knockOut(
  page: Page,
  partyIndex: number
): Promise<readonly number[]> {
  return page.evaluate(
    ({ index, guard }) => {
      const verify = window.__VERIFY__!;
      // The first standing enemy is the attacker; a Strike costs no resources.
      const attacker = () =>
        verify.state()?.enemies.findIndex(e => e.hp > 0) ?? -1;
      let steps = 0;
      while ((verify.state()?.party[index]?.hp ?? 0) > 0 && steps < guard) {
        const enemyIndex = attacker();
        if (enemyIndex < 0) {
          break;
        }
        verify.act({
          kind: "strike",
          actor: { side: "enemies", index: enemyIndex },
          target: { side: "party", index },
        });
        steps += 1;
      }
      return (verify.state()?.party ?? []).map(seat => seat.hp);
    },
    { index: partyIndex, guard: MAX_STRIKES }
  );
}

test.describe("GRIST — region-play KO soft-lock regression (#243)", () => {
  test("[EVIDENCE: region-ko-survivor-plays-on] a KO'd member hands the turn to the living ally; commands respond", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await travelIntoRegionBattle(page);

    // Advance to the opening decision so the front member (Wren) is ready with a
    // FULL gauge — then fell her while the ally (Tobi) is untouched: the exact QA
    // state that used to freeze the fight (downed member parked at the queue head).
    await page.evaluate(() => window.__VERIFY__?.advanceTurn());
    const afterKo = await knockOut(page, 0);
    expect(afterKo[0]).toBe(0); // Wren is down
    expect(afterKo[1]).toBeGreaterThan(0); // Tobi still stands

    // The fix: advancing no longer parks on the corpse — it fills on to the living
    // ally's turn. A LIVING party member is the active actor and the menu is open.
    const decision = await page.evaluate(() => {
      const verify = window.__VERIFY__!;
      verify.advanceTurn();
      const hud = verify.hud();
      const state = verify.state();
      const active = hud?.activeActor ?? null;
      return {
        phase: state?.phase ?? "",
        active,
        menuOpen: hud?.menuOpen ?? false,
        activeHp: active === null ? -1 : (state?.party[active]?.hp ?? -1),
      };
    });
    expect(decision.phase).toBe("select");
    expect(decision.menuOpen).toBe(true);
    expect(decision.active).not.toBeNull();
    expect(decision.activeHp).toBeGreaterThan(0); // the ready actor is alive

    // Commands respond: the surviving ally strikes and an enemy takes damage — the
    // input-dead freeze is gone (keyboard/mouse/Esc were all dead in the QA repro).
    const struck = await page.evaluate(active => {
      const verify = window.__VERIFY__!;
      const enemyIndex = verify.state()?.enemies.findIndex(e => e.hp > 0) ?? -1;
      const before = verify.state()?.enemies[enemyIndex]?.hp ?? -1;
      verify.act({
        kind: "strike",
        actor: { side: "party", index: active },
        target: { side: "enemies", index: enemyIndex },
      });
      const after = verify.state()?.enemies[enemyIndex]?.hp ?? -1;
      return { before, after };
    }, decision.active as number);
    expect(struck.after).toBeLessThan(struck.before);

    expect(errors).toEqual([]);
  });

  test("[EVIDENCE: region-ko-full-wipe-defeat-returns] a full party wipe resolves to Defeat and returns to the region/map, never frozen", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await travelIntoRegionBattle(page);

    await page.evaluate(() => window.__VERIFY__?.advanceTurn());
    // Fell the front member, then the survivor — the whole party is wiped.
    await knockOut(page, 0);
    const wiped = await knockOut(page, 1);
    expect(wiped.every(hp => hp === 0)).toBe(true);

    // The wipe resolves the battle to Defeat (never a frozen, input-dead battle)...
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.state()?.phase ?? ""))
      .toBe("lost");

    // ...and the launched battle hands control back to a sane scene (the region it
    // came from, or the map) — the player is never stranded on a dead battle.
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
        timeout: SEEN_TIMEOUT,
      })
      .not.toBe("Battle");
    const landed = await page.evaluate(() => window.__VERIFY__?.scene() ?? "");
    expect(["Region", "WorldMap", "Field"]).toContain(landed);

    expect(errors).toEqual([]);
  });
});
