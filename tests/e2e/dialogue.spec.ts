/**
 * Dialogue/cutscene-presenter verification (UAT) suite — the manifest for sub-task
 * #104 (Story #92, PD-3.1). Boots the Dialogue scene directly via `?scene=dialogue`
 * and drives the reusable presenter through the in-game `window.__VERIFY__` bridge
 * to prove, empirically against the live canvas, the acceptance criterion:
 * advancing, branching (where present), and skipping all work with no console
 * errors, and the speaker name + portrait slot render. [EVIDENCE: dialogue-frame]
 *
 * The presenter plays a verification-only demo script (NOT authored game content —
 * PD-3.2 / PD-3.6 author the real opening/recruitment scenes): a linear opening,
 * a free-vs-wield fork, and two terminal legs. Every action is routed as a semantic
 * `DialogueEvents.Input` intent on the EventsCenter bus (the presenter reads no raw
 * input), so a rendered-state change after a bridge-driven action is end-to-end
 * proof the advance/branch/skip path works on the canvas. All branching logic lives
 * in `logic/narrative`; this spec asserts the scene's rendered model mirrors those
 * pure reducers. It never touches the battle/field/bench specs and the battle boot
 * stays the default, so all existing tests stay green. [EVIDENCE: dialogue-clean-console]
 */
import { expect, test, type Page } from "@playwright/test";

const SEEN_TIMEOUT = 15_000;

/** The render-scale snapshot exposed by the verification bridge. */
interface Resolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/** One branch choice in the verification snapshot (id + label). */
interface DialogueChoice {
  readonly id: string;
  readonly label: string;
}

/** The dialogue snapshot exposed by the verification bridge. */
interface DialogueState {
  readonly scene: string;
  readonly speaker: string;
  readonly caption: string;
  readonly portraitSlot: string;
  readonly branching: boolean;
  readonly done: boolean;
  readonly choices: readonly DialogueChoice[];
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
 * Boot the Dialogue scene directly with the bridge enabled. The `?scene=dialogue`
 * query makes the Preloader start Dialogue instead of Battle.
 * @param page - The Playwright page.
 */
async function bootDialogue(page: Page): Promise<void> {
  await page.goto("/?scene=dialogue&uat=1");
  await waitForScene(page, "Dialogue");
}

/**
 * Read the live dialogue snapshot from the bridge.
 * @param page - The Playwright page.
 * @returns The dialogue snapshot, or null if unavailable.
 */
async function dialogueState(page: Page): Promise<DialogueState | null> {
  return page.evaluate(() => window.__VERIFY__?.dialogue() ?? null);
}

test.describe("Dialogue — presenter scene verification (UAT)", () => {
  test("[dialogue-open-384x216] opens the presenter at 384x216, integer-scaled, no errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootDialogue(page);
    await expect(page.locator("canvas")).toBeVisible();

    const dialogue = await dialogueState(page);
    expect(dialogue?.scene).toBe("Dialogue");
    // The opening node renders its speaker, full caption, and portrait slot.
    expect(dialogue?.speaker).toBe("wren");
    expect(dialogue?.caption).toBe("The Drip stirs in the marrow.");
    expect(dialogue?.portraitSlot).toBe("wren");
    expect(dialogue?.done).toBe(false);

    const resolution = (await page.evaluate(() =>
      window.__VERIFY__?.resolution()
    )) as Resolution | null | undefined;
    expect(resolution?.width).toBe(384);
    expect(resolution?.height).toBe(216);
    expect(resolution?.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(resolution?.zoom)).toBe(true);

    const canvas = await page.evaluate(() => {
      const element = document.querySelector("canvas");
      return element ? { width: element.width, height: element.height } : null;
    });
    expect(canvas).toEqual({ width: 384, height: 216 });
    expect(errors).toEqual([]);
  });

  test("[dialogue-advance] advancing walks the captions and crosses to the fork", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootDialogue(page);

    // Advance from the opening line to the reply line within the scene.
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    const reply = await dialogueState(page);
    expect(reply?.speaker).toBe("tobi");
    expect(reply?.caption).toBe("Then we move.");
    expect(reply?.branching).toBe(false);

    // Advancing off the opening scene's terminal node crosses to the fork.
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    const fork = await dialogueState(page);
    expect(fork?.caption).toBe("Free the shard, or wield it?");
    expect(fork?.branching).toBe(true);
    expect(fork?.choices).toEqual([
      { id: "freed", label: "Free it" },
      { id: "wielded", label: "Wield it" },
    ]);
    expect(errors).toEqual([]);
  });

  test("[dialogue-branch] branching at a fork crosses to the chosen leg", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootDialogue(page);
    // Walk to the fork (opening → reply → fork).
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    const fork = await dialogueState(page);
    expect(fork?.branching).toBe(true);
    // The snapshot carries stable choice ids (not just labels) so the e2e can
    // branch on the id rather than fixture-internal label text.
    expect(fork?.choices.map(choice => choice.id)).toEqual([
      "freed",
      "wielded",
    ]);

    // Take the "wielded" branch by its stable id.
    await page.evaluate(() => window.__VERIFY__?.branchDialogue("wielded"));
    const wielded = await dialogueState(page);
    expect(wielded?.branching).toBe(false);
    expect(wielded?.caption).toBe("The shard answers your hand.");
    expect(errors).toEqual([]);
  });

  test("[dialogue-skip] skipping jumps straight to done with no caption", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootDialogue(page);

    const before = await dialogueState(page);
    expect(before?.done).toBe(false);

    await page.evaluate(() => window.__VERIFY__?.skipDialogue());
    const after = await dialogueState(page);
    expect(after?.done).toBe(true);
    expect(after?.caption).toBe("");
    expect(after?.choices).toEqual([]);

    // An advance after a skip is a no-op (the narrative has ended).
    await page.evaluate(() => window.__VERIFY__?.advanceDialogue());
    const stillDone = await dialogueState(page);
    expect(stillDone?.done).toBe(true);
    expect(errors).toEqual([]);
  });

  test("[dialogue-live-keyboard] real keyboard input (not UAT) drives advance + branch", async ({
    page,
  }) => {
    // Proves the live, non-UAT input path: the Dialogue scene's DialogueInputService
    // reads real key presses and routes them to the presenter — no __VERIFY__ call
    // touches the presenter here, only page.keyboard does.
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    page.on("pageerror", error => errors.push(error.message));

    await bootDialogue(page);
    // Focus the canvas so Phaser's keyboard plugin receives the events.
    await page.locator("canvas").click();

    // Enter advances the opening line (open → reply) via the real keyboard path.
    await page.keyboard.press("Enter");
    const reply = await dialogueState(page);
    expect(reply?.speaker).toBe("tobi");
    expect(reply?.caption).toBe("Then we move.");

    // Enter again crosses to the fork (reply → fork).
    await page.keyboard.press("Enter");
    const fork = await dialogueState(page);
    expect(fork?.branching).toBe(true);
    expect(fork?.choices.map(choice => choice.id)).toEqual([
      "freed",
      "wielded",
    ]);

    // The "1" key selects the first branch (index 0 → "freed") via the keyboard.
    await page.keyboard.press("Digit1");
    const freed = await dialogueState(page);
    expect(freed?.branching).toBe(false);
    expect(freed?.caption).toBe("The shard drifts free.");
    expect(errors).toEqual([]);
  });
});
