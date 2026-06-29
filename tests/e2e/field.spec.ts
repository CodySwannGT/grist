/**
 * Field-scene verification (UAT) suite — the manifest for sub-task #81. Boots the
 * Field scene directly via `?scene=field` and drives it through the in-game
 * `window.__VERIFY__` bridge to prove, empirically against the live canvas, the
 * four acceptance markers:
 *
 * - [field-boot-384x216] boot to Field at 384×216, integer zoom, zero errors.
 * - [field-move-keyboard] Wren moves in Room A via the real keyboard (arrows/WASD).
 * - [field-move-touch] Wren moves via a real tap-to-move pointer event.
 * - [field-examine-lore] examining `warren-sign` surfaces the authored lore beat.
 *
 * Movement and examine are routed through the semantic field input layer (the
 * scene reads no raw keys/pointers), so a position change after a real key/pointer
 * event is end-to-end proof the intent path works. This spec never touches the
 * battle specs and the battle boot stays the default, so all battle tests stay
 * green.
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;
const FIXED_SEED = 12345;

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** Wren's logical position as reported by the field bridge. */
interface FieldPos {
  readonly x: number;
  readonly y: number;
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
 * Boot the Field scene directly at a fixed seed with the bridge enabled. The
 * `?scene=field` query is what makes the Preloader start Field instead of Battle.
 * @param page - The Playwright page.
 */
async function bootField(page: Page): Promise<void> {
  await page.goto(`/?scene=field&uat=1&seed=${FIXED_SEED}`);
  await waitForScene(page, "Field");
}

/**
 * Read Wren's current logical position from the field bridge.
 * @param page - The Playwright page.
 * @returns Wren's position, defaulting to the origin if unavailable.
 */
async function wrenPos(page: Page): Promise<FieldPos> {
  return page.evaluate(
    () => window.__VERIFY__?.field()?.wren ?? { x: 0, y: 0 }
  );
}

/**
 * Focus the game canvas so real keyboard events are delivered to Phaser.
 * @param page - The Playwright page.
 */
async function focusCanvas(page: Page): Promise<void> {
  const canvas = page.locator("canvas");
  await canvas.click({ position: { x: 5, y: 5 } });
}

test.describe("GRIST — field scene verification (UAT)", () => {
  test("[field-boot-384x216] boots to Field at 384x216, integer-scaled, no errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootField(page);
    await expect(page.locator("canvas")).toBeVisible();

    const field = await page.evaluate(() => window.__VERIFY__?.field());
    expect(field?.scene).toBe("Field");
    expect(field?.room).toBe("room-a");

    const resolution = (await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    )) as Resolution | null | undefined;
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(resolution?.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);

    // The canvas backing store is the native resolution; CSS scales it whole.
    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });
    expect(errors).toEqual([]);
  });

  test("[field-move-keyboard] moves Wren in Room A via the real keyboard", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootField(page);
    await focusCanvas(page);

    const before = await wrenPos(page);

    // Hold a real arrow key: keydown joins the held-move set (semantic MOVE
    // intent), and the scene walks Wren by the frame delta while it is down. Poll
    // for the movement rather than a fixed sleep so the assertion is not timing-
    // sensitive on a slow runner.
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(async () => (await wrenPos(page)).x, { timeout: SEEN_TIMEOUT })
      .toBeGreaterThan(before.x);
    await page.keyboard.up("ArrowRight");

    expect(errors).toEqual([]);
  });

  test("[field-move-touch] moves Wren in Room A via a real tap-to-move pointer", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await bootField(page);

    const before = await wrenPos(page);

    // Tap a point on the floor to the right of Wren via a real pointer event,
    // mapped through the canvas zoom — routed through the semantic input layer.
    const box = await page.locator("canvas").boundingBox();
    const zoom =
      (await page.evaluate(() => window.__VERIFY__?.resolution()?.zoom)) ?? 1;
    if (!box) {
      throw new Error("no canvas");
    }
    // A logical destination clearly to the right of and below Wren's spawn.
    const targetLogical = { x: 320, y: 160 };
    await page.mouse.click(
      box.x + targetLogical.x * zoom,
      box.y + targetLogical.y * zoom
    );
    // Poll for the walk to progress rather than a fixed sleep, so the assertion is
    // not timing-sensitive on a slow runner.
    await expect
      .poll(async () => (await wrenPos(page)).x, { timeout: SEEN_TIMEOUT })
      .toBeGreaterThan(before.x);
    expect(errors).toEqual([]);
  });

  test("[field-examine-lore] examining warren-sign surfaces the authored lore beat", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootField(page);

    // Nothing examined yet.
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.lore)
    ).toBeNull();

    // Examine the nearest prop (the rendering notice) via the bridge — it walks
    // Wren onto the sign and threads an `examine` through the pure field sim.
    await page.evaluate(() => window.__VERIFY__?.examine());

    const lore = await page.evaluate(() => window.__VERIFY__?.field()?.lore);
    expect(lore).toBeTruthy();
    expect(typeof lore).toBe("string");
    // The authored beat is the in-fiction rendering notice on Warren St.
    expect(lore).toContain("RENDERING IN PROGRESS");
    expect(errors).toEqual([]);
  });
});
