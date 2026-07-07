/**
 * Bench keyboard-navigation verification (UAT) suite — the manifest for sub-task
 * #246. The Growth "The Bench" screen was **mouse-only**: arrows moved no cursor and
 * Enter did nothing, so keyboard/gamepad/Steam-Deck players were locked out of the
 * entire build-and-upgrade system (the one place Grist is spent). This spec boots the
 * **Field** (the primary gameplay surface) and drives the whole build lever through
 * the *real keyboard* — never a pointer-driven UI action — to prove the fix end to
 * end against the live canvas:
 *
 * - [EVIDENCE: bench-keyboard] a keyboard-only journey — Field → Esc → Menu → arrow to
 *   Builds → Enter opens the Bench → arrow down to a grist sink → Enter spends (the
 *   wallet draws down and the build grows) → arrow up to the equip control → Enter
 *   equips the shard (Cinder begins) → Esc backs out to the Menu — asserting the focus
 *   ring moves and each reducer state change lands, with zero pointer-driven UI.
 *
 * The pure focus ring (the control order, the wrap) and the key→intent map are proven
 * headless in `tests/logic/bench-focus.test.ts` and `tests/logic/bench-input-map.test.ts`;
 * this spec proves the live scene wires them to the canvas and the real input path. The
 * only pointer event is the one-time canvas-focus click every UAT spec uses so Phaser
 * receives keystrokes — it drives no UI. It never touches the battle boot, so every
 * existing test stays green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;
/** A wallet seeded (via the Bench's `?grist=` UAT seam) above the sink cost. */
const FUNDED_GRIST = 100;
/** Runner's Reflex cost (authoritative in `src/content/bench.ts`). */
const RUNNERS_REFLEX_COST = 25;
/** A short dwell between discrete keystrokes so each lands in its own update tick. */
const KEY_DWELL = 150;

/** The bench snapshot exposed by the verification bridge (incl. the focused control). */
interface BenchState {
  readonly scene: string;
  readonly grist: number;
  readonly shardEquipped: boolean;
  readonly cinderLearning: boolean;
  readonly spdBonus: number;
  readonly focus: string;
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
 * Focus the game canvas so real keyboard events reach Phaser. The single pointer
 * event in the journey — a focus click at the canvas corner, driving no UI.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  await page.locator("canvas").click({ position: { x: 5, y: 5 } });
}

/**
 * Press a key, then dwell so the keystroke lands in its own Phaser update tick.
 * @param page - The Playwright page.
 * @param key - The key to press.
 */
async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(KEY_DWELL);
}

/**
 * Read the live bench snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The bench snapshot, or null if unavailable.
 */
async function benchState(page: Page): Promise<BenchState | null> {
  return page.evaluate(() => window.__VERIFY__?.bench() ?? null);
}

test.describe("GRIST — Bench keyboard navigation from gameplay (UAT, #246)", () => {
  test("[bench-keyboard] a keyboard-only player reaches the Bench and spends + equips without a mouse", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    // Boot the Field; the `?grist=` seam funds the wallet when the Bench opens so the
    // spend AC ("given a funded wallet") runs without first earning grist in battle.
    await page.goto(
      `/?scene=field&uat=1&seed=${FIXED_SEED}&grist=${FUNDED_GRIST}`
    );
    await waitForScene(page, "Field");
    await focusCanvas(page);

    // Esc opens the pause Menu; arrow to Builds (Party 0 → Builds 1); Enter opens the
    // Bench — all keyboard, the path a Deck player takes.
    await pressKey(page, "Escape");
    await waitForScene(page, "Menu");
    await pressKey(page, "ArrowDown");
    await pressKey(page, "Enter");
    await waitForScene(page, "Bench");

    // The Bench opens funded, focus on the first control (equip) — the cursor a
    // mouse-only screen never showed.
    const opened = await benchState(page);
    expect(opened?.grist).toBe(FUNDED_GRIST);
    expect(opened?.focus).toBe("equip");
    expect(opened?.shardEquipped).toBe(false);
    expect(opened?.spdBonus).toBe(0);

    // Arrow down to the first grist sink (Runner's Reflex): the focus ring MOVES —
    // the exact input that did nothing before this fix.
    await pressKey(page, "ArrowDown");
    const onSink = await benchState(page);
    expect(onSink?.focus).toBe("runners-reflex");

    // Enter spends: the wallet draws down by the cost and the build grows (+2 SPD).
    await pressKey(page, "Enter");
    const spent = await benchState(page);
    expect(spent?.grist).toBe(FUNDED_GRIST - RUNNERS_REFLEX_COST);
    expect(spent?.spdBonus).toBe(2);

    // Arrow back up to the equip control and Enter: the shard equips, Cinder begins.
    await pressKey(page, "ArrowUp");
    const onEquip = await benchState(page);
    expect(onEquip?.focus).toBe("equip");
    await pressKey(page, "Enter");
    const equipped = await benchState(page);
    expect(equipped?.shardEquipped).toBe(true);
    expect(equipped?.cinderLearning).toBe(true);
    // The spend survived the equip — no pointer ever touched the wallet.
    expect(equipped?.grist).toBe(FUNDED_GRIST - RUNNERS_REFLEX_COST);

    // Esc backs out of the Bench to the pause Menu (the #239 exit, keyboard-driven).
    await pressKey(page, "Escape");
    await waitForScene(page, "Menu");

    expect(errors).toEqual([]);
  });
});
