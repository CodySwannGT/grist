import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;
/** A wall-clock window long enough to fill several ATB ticks but not cap a gauge. */
const CADENCE_WINDOW_MS = 500;

/** The battle resolution snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/**
 * Wait until the running game reports the given scene key.
 * @param page - The Playwright page.
 * @param key - Expected scene key.
 */
async function waitForScene(page: Page, key: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__VERIFY__?.scene() ?? ""), {
      timeout: SEEN_TIMEOUT,
    })
    .toBe(key);
}

/**
 * Load the battle at a fixed seed with the verification bridge enabled.
 * @param page - The Playwright page.
 */
async function bootBattle(page: Page): Promise<void> {
  await page.goto(`/?uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Battle");
}

/**
 * Wait until a party actor is ready and the command menu is open for input.
 * @param page - The Playwright page.
 */
async function waitForMenu(page: Page): Promise<void> {
  await expect
    .poll(
      () => page.evaluate(() => window.__VERIFY__?.hud()?.menuOpen ?? false),
      {
        timeout: SEEN_TIMEOUT,
      }
    )
    .toBe(true);
}

/**
 * Reseed (restart) the battle to a deterministic fresh state.
 * @param page - The Playwright page.
 */
async function restart(page: Page): Promise<void> {
  await page.evaluate(seed => window.__VERIFY__?.seed(seed), FIXED_SEED);
  // Wait for the bridge to expose the restarted battle before any caller samples
  // it, so a transient null state can never collapse to a misleading 0.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__VERIFY__?.state() !== null &&
          window.__VERIFY__?.hud() !== null
      )
    )
    .toBe(true);
}

/**
 * Cycle the battle speed (via the real keyboard Shift binding) until it reaches
 * the requested setting.
 * @param page - The Playwright page.
 * @param target - The desired speed id.
 */
async function reachSpeed(page: Page, target: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const speed = await page.evaluate(() => window.__VERIFY__?.hud()?.speed);
    if (speed === target) {
      return;
    }
    await page.keyboard.press("Shift");
    await page.waitForTimeout(80);
  }
  throw new Error(`could not reach speed ${target}`);
}

/**
 * The viewport (CSS) center of a command button, mapped from its logical rect
 * through the integer render zoom and the canvas offset.
 * @param page - The Playwright page.
 * @param id - The command id.
 * @returns The CSS click point.
 */
async function commandPoint(
  page: Page,
  id: string
): Promise<{ x: number; y: number }> {
  const box = await page.locator("canvas").boundingBox();
  const data = await page.evaluate(commandId => {
    const v = window.__VERIFY__;
    const command = v?.hud()?.commands.find(c => c.id === commandId);
    return command
      ? { zoom: v?.resolution()?.zoom ?? 1, rect: command.rect }
      : null;
  }, id);
  if (!box || !data) {
    throw new Error(`no command button for ${id}`);
  }
  return {
    x: box.x + (data.rect.x + data.rect.width / 2) * data.zoom,
    y: box.y + (data.rect.y + data.rect.height / 2) * data.zoom,
  };
}

test.describe("GRIST — battle scene verification (UAT)", () => {
  test("boots to the battle with a fixed seed and no console errors", async ({
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
    await expect(page.locator("canvas")).toBeVisible();

    const state = await page.evaluate(() => window.__VERIFY__?.state());
    expect(state?.scene).toBe("Battle");
    expect(state?.party.length).toBeGreaterThan(0);
    expect(state?.enemies.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("renders at 384x216 internal resolution, integer-scaled", async ({
    page,
  }) => {
    await bootBattle(page);

    const resolution = (await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    )) as Resolution | null | undefined;
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(resolution?.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);

    // The canvas backing store is the native resolution; CSS scales it up whole.
    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });
  });

  test("a Strike driven from the scene changes the target's HP in state", async ({
    page,
  }) => {
    await bootBattle(page);

    const before = await page.evaluate(
      () => window.__VERIFY__?.state()?.enemies[0]?.hp ?? 0
    );
    expect(before).toBeGreaterThan(0);

    await page.evaluate(() => window.__VERIFY__?.strike());

    await expect
      .poll(() =>
        page.evaluate(() => window.__VERIFY__?.state()?.enemies[0]?.hp ?? 0)
      )
      .toBeLessThan(before);
  });

  test("the HUD reflects live combat state (AC1)", async ({ page }) => {
    await bootBattle(page);
    await waitForMenu(page);

    const view = await page.evaluate(() => {
      const v = window.__VERIFY__;
      const state = v?.state();
      const hud = v?.hud();
      if (!state || !hud) {
        return null;
      }
      return {
        commands: hud.commands.map(c => c.id),
        grist: hud.grist,
        stateGrist: state.grist,
        // Compare the HUD's own party rows against the sim, so the test fails if
        // the HUD/UAT model ever stops exposing per-member HP / AP / ATB.
        party: hud.party.map((row, index) => ({
          hpMatches: row.hp === state.party[index]?.hp,
          maxHpPositive: row.maxHp > 0,
          apMatches: row.ap === state.party[index]?.ap,
          atbMatches: row.atb === state.party[index]?.atb,
        })),
        partyCountMatches: hud.party.length === state.party.length,
        enemyBreaksExposed: hud.enemies.every(
          e => typeof e.broken === "boolean"
        ),
        targetInRange:
          hud.targetEnemy >= 0 && hud.targetEnemy < state.enemies.length,
        bind: hud.commands.find(c => c.id === "bind"),
      };
    });

    expect(view).not.toBeNull();
    // The command menu shows Strike / Craft / Bind / Item / Defend.
    expect(view?.commands).toEqual([
      "strike",
      "craft",
      "bind",
      "item",
      "defend",
    ]);
    // The shared grist pool the HUD shows matches the sim.
    expect(view?.grist).toBe(view?.stateGrist);
    // The HUD exposes every party member's HP / AP / ATB, matching the sim.
    expect(view?.partyCountMatches).toBe(true);
    for (const member of view?.party ?? []) {
      expect(member.hpMatches).toBe(true);
      expect(member.maxHpPositive).toBe(true);
      expect(member.apMatches).toBe(true);
      expect(member.atbMatches).toBe(true);
    }
    // The target and per-enemy Break state are exposed.
    expect(view?.targetInRange).toBe(true);
    expect(view?.enemyBreaksExposed).toBe(true);
    // Bind costs grist and is greyed out while the shared pool is empty.
    expect(view?.bind?.gristCost).toBeGreaterThan(0);
    expect(view?.bind?.affordable).toBe(false);
  });

  test("the command menu drives a battle from the keyboard (AC3)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await bootBattle(page);
    await waitForMenu(page);

    const target = await page.evaluate(
      () => window.__VERIFY__?.hud()?.targetEnemy ?? 0
    );
    const before = await page.evaluate(
      enemy => window.__VERIFY__?.state()?.enemies[enemy]?.hp ?? 0,
      target
    );

    // Default highlight is Strike; Enter confirms it through the InputService.
    await page.keyboard.press("Enter");

    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.hud()?.lastAction))
      .toEqual({ command: "strike", device: "keyboard" });
    await expect
      .poll(() =>
        page.evaluate(
          enemy => window.__VERIFY__?.state()?.enemies[enemy]?.hp ?? 0,
          target
        )
      )
      .toBeLessThan(before);
    expect(errors).toEqual([]);
  });

  test("the command menu drives a battle from touch/pointer (AC3)", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await bootBattle(page);
    await waitForMenu(page);

    // Tap the Craft button: a real pointer event routed through the InputService.
    const point = await commandPoint(page, "craft");
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y);

    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.hud()?.lastAction))
      .toEqual({ command: "craft", device: "pointer" });
    expect(errors).toEqual([]);
  });

  test("the battle-speed / Wait toggle changes the ATB cadence mid-fight (AC2)", async ({
    page,
  }) => {
    await bootBattle(page);

    // The on-screen toggle (driven here by the real Shift binding) reports a
    // changing cadence: Normal (100ms), Fast (50ms), Wait (frozen). Reaching each
    // setting by reading the live speed keeps the assertion off press-count timing.
    await reachSpeed(page, "normal");
    expect(await page.evaluate(() => window.__VERIFY__?.hud()?.tickMs)).toBe(
      100
    );
    await reachSpeed(page, "fast");
    expect(await page.evaluate(() => window.__VERIFY__?.hud()?.tickMs)).toBe(
      50
    );
    await reachSpeed(page, "wait");
    expect(
      await page.evaluate(() => window.__VERIFY__?.hud()?.tickMs)
    ).toBeNull();

    // Behavioral proof on a fresh fill window: in Wait the ATB is frozen, and
    // switching to Normal mid-fight resumes the cadence. Restart first (a reseed
    // resets the speed to default) and only then select the speed under test.
    await restart(page);
    await reachSpeed(page, "wait");
    const waitStart = await page.evaluate(
      () => window.__VERIFY__?.state()?.tick ?? 0
    );
    await page.waitForTimeout(CADENCE_WINDOW_MS);
    const waitEnd = await page.evaluate(
      () => window.__VERIFY__?.state()?.tick ?? 0
    );
    expect(waitEnd).toBe(waitStart);

    await restart(page);
    await reachSpeed(page, "normal");
    const normalStart = await page.evaluate(
      () => window.__VERIFY__?.state()?.tick ?? 0
    );
    await page.waitForTimeout(CADENCE_WINDOW_MS);
    const normalEnd = await page.evaluate(
      () => window.__VERIFY__?.state()?.tick ?? 0
    );
    expect(normalEnd).toBeGreaterThan(normalStart);
  });
});
