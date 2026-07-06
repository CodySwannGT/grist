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
 * - [field-rendering-house-lore] reaching the rendering-house space (Room B) and
 *   examining its `render-vat` prop surfaces environmental lore about what the
 *   city eats — the #106 acceptance criterion, proven end-to-end on the canvas.
 * - [field-hud-grist] the persistent grist readout is always visible in the field
 *   and tracks the shared wallet — the PD-3.3 / #107 "grist count is always
 *   visible" criterion.
 * - [field-hud-context-prompt] a context prompt appears on an interactable when
 *   Wren is in range and is absent when she is not — the #107 "context prompts
 *   appear on interactables" criterion.
 * - [field-hud-minimap] the mini-map can be summoned and dismissed — the #107
 *   "a mini-map can be summoned and dismissed" criterion.
 * - [field-examine-prompt-vs-lore] the context prompt and the examine lore banner
 *   never surface together (the prompt yields while the banner is up; the banner
 *   re-opens on re-approach) — the #234 readability fix, proven on the bridge.
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

/**
 * Toggle the mini-map with a single, unambiguous M keystroke: keydown, a short
 * dwell, then a keyup that fully releases the key. The dwell + release ensure a
 * following toggle registers as a distinct non-repeat keydown rather than being
 * coalesced into an auto-repeat sequence of the same key (which the field input
 * layer drops, like every discrete intent, to ignore OS key-repeat).
 * @param page - The Playwright page.
 */
async function pressMap(page: Page): Promise<void> {
  await page.keyboard.up("KeyM");
  await page.keyboard.down("KeyM");
  await page.waitForTimeout(50);
  await page.keyboard.up("KeyM");
  await page.waitForTimeout(50);
}

/**
 * Engage the current room's encounter (→ Battle), deterministically win it via
 * the bridge's `autoWin`, and wait for control to return to the visible Field.
 * The descent does not auto-chain, so after this the Field is `exploring` again.
 * @param page - The Playwright page.
 */
async function clearCurrentRoom(page: Page): Promise<void> {
  await page.evaluate(() => window.__VERIFY__?.engage());
  await waitForScene(page, "Battle");
  const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
  expect(phase).toBe("won");
  await waitForScene(page, "Field");
}

/**
 * From the cleared, visible Field, traverse to the next room (→ its trigger →
 * Battle), win that fight, and wait for control to return to the Field — now
 * exploring in the next room.
 * @param page - The Playwright page.
 */
async function traverseAndWin(page: Page): Promise<void> {
  await page.evaluate(() => window.__VERIFY__?.traverse());
  await waitForScene(page, "Battle");
  const phase = await page.evaluate(() => window.__VERIFY__?.autoWin() ?? "");
  expect(phase).toBe("won");
  await waitForScene(page, "Field");
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

  test("[field-rendering-house-lore] the rendering-house space (Room B) render-vat surfaces lore about what the city eats", async ({
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

    // Walk the descent into the rendering-house space: clear the runner-warrens
    // (Room A), then traverse into and clear Room B — the rendering-house pass.
    await clearCurrentRoom(page);
    await traverseAndWin(page);

    // We are now exploring the rendering-house space; nothing examined yet there.
    const room = await page.evaluate(() => window.__VERIFY__?.field()?.room);
    expect(room).toBe("room-b");
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.lore)
    ).toBeNull();

    // Examine the room's examinable prop (the rendering vat) via the bridge — it
    // resolves the *current room's* lore prop (no longer pinned to Room A) and
    // threads an `examine` through the pure field sim.
    await page.evaluate(() => window.__VERIFY__?.examine());

    const lore = await page.evaluate(() => window.__VERIFY__?.field()?.lore);
    expect(lore).toBeTruthy();
    expect(typeof lore).toBe("string");
    // "What the city eats": the Marrow runs on rendered people / black grist.
    expect(lore!.toLowerCase()).toContain("grist");
    expect(lore!).toMatch(/render|dead|black grist/i);
    expect(errors).toEqual([]);
  });

  test("[field-hud-grist] the grist count is always visible in the field", async ({
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

    // The persistent grist readout is present on the very first field frame —
    // before any battle — so the player always feels the wallet. It reflects the
    // run's shared grist pool (a fresh run starts at the slice's starting grist).
    const grist = await page.evaluate(() => window.__VERIFY__?.field()?.grist);
    expect(typeof grist).toBe("number");
    expect(grist).toBeGreaterThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("[field-hud-context-prompt] a context prompt appears on an interactable", async ({
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
    await focusCanvas(page);

    // At spawn Wren is far from Room A's examinable sign, so no prompt shows.
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.contextPrompt)
    ).toBeNull();

    // Walk right toward the rendering-notice sign with a real held key until the
    // context prompt surfaces — proof the prompt is contextual (range-gated) and
    // driven by the real input path, not always-on.
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(
        () => page.evaluate(() => window.__VERIFY__?.field()?.contextPrompt),
        { timeout: SEEN_TIMEOUT }
      )
      .not.toBeNull();
    await page.keyboard.up("ArrowRight");

    const prompt = await page.evaluate(
      () => window.__VERIFY__?.field()?.contextPrompt
    );
    expect(prompt).toContain("examine");
    expect(errors).toEqual([]);
  });

  test("[field-examine-prompt-vs-lore] the context prompt and the lore banner never share the bottom band (#234)", async ({
    page,
  }) => {
    // [EVIDENCE: field-examine-prompt-vs-lore] The floating "[E] examine <prop>"
    // context prompt and the examine lore banner used to surface together in the
    // same bottom band, overlapping and garbling each other's text (#234). This
    // proves — empirically, off the live bridge — that the two never render at
    // once: the prompt shows only before the beat is read, the banner takes the
    // band once examined (prompt suppressed), the band clears on walk-away, and
    // the banner (not the prompt) re-opens on re-approach — never both together.
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootField(page);
    await focusCanvas(page);

    // Walk into range with a real held key: the prompt surfaces, no lore banner yet.
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(
        () => page.evaluate(() => window.__VERIFY__?.field()?.contextPrompt),
        { timeout: SEEN_TIMEOUT }
      )
      .not.toBeNull();
    await page.keyboard.up("ArrowRight");
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.lore)
    ).toBeNull();

    // Examine: the lore banner appears AND the context prompt is suppressed the
    // same beat — so the two text layers can never overlap.
    await page.evaluate(() => window.__VERIFY__?.examine());
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.field()?.lore), {
        timeout: SEEN_TIMEOUT,
      })
      .not.toBeNull();
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.contextPrompt)
    ).toBeNull();

    // Step out of examine range: the banner dismisses (a stand-at-the-prop read),
    // and the prompt stays hidden too while out of range — the bottom band is
    // fully clear.
    await page.keyboard.down("ArrowLeft");
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.field()?.lore), {
        timeout: SEEN_TIMEOUT,
      })
      .toBeNull();
    await page.keyboard.up("ArrowLeft");
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.contextPrompt)
    ).toBeNull();

    // Re-approach: the lore banner re-opens (the affordance is fulfilled by the
    // content itself) while the context prompt stays suppressed — so the two
    // never share the band on re-approach either.
    await page.keyboard.down("ArrowRight");
    await expect
      .poll(() => page.evaluate(() => window.__VERIFY__?.field()?.lore), {
        timeout: SEEN_TIMEOUT,
      })
      .not.toBeNull();
    await page.keyboard.up("ArrowRight");
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.contextPrompt)
    ).toBeNull();

    // The core invariant, proven across every step above: the context prompt and
    // the lore banner are never both on screen at once (#234).
    const both = await page.evaluate(() => {
      const f = window.__VERIFY__?.field();
      return { prompt: f?.contextPrompt ?? null, lore: f?.lore ?? null };
    });
    expect(both.prompt !== null && both.lore !== null).toBe(false);

    expect(errors).toEqual([]);
  });

  test("[field-hud-minimap] the mini-map can be summoned and dismissed", async ({
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
    await focusCanvas(page);

    // Closed at boot — the mini-map is summonable, not always-on.
    expect(
      await page.evaluate(() => window.__VERIFY__?.field()?.miniMapOpen)
    ).toBe(false);

    // Summon it via a real keyboard keystroke (the M binding routes through the
    // semantic field-input layer to the pure toggle). Explicit down/up — with the
    // key fully released before the dismiss — so each toggle is an unambiguous,
    // non-repeat keydown (a rapid double `press` of the same key can be coalesced
    // into a single auto-repeat sequence by the browser).
    await pressMap(page);
    await expect
      .poll(
        () => page.evaluate(() => window.__VERIFY__?.field()?.miniMapOpen),
        { timeout: SEEN_TIMEOUT }
      )
      .toBe(true);

    // Dismiss it with the same binding — the summon is a toggle.
    await pressMap(page);
    await expect
      .poll(
        () => page.evaluate(() => window.__VERIFY__?.field()?.miniMapOpen),
        { timeout: SEEN_TIMEOUT }
      )
      .toBe(false);

    expect(errors).toEqual([]);
  });
});
