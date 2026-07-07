/**
 * Unit coverage for the pure dialogue-choice geometry (`src/ui/dialogue-layout`):
 * the Phaser-free {@link dialogueChoiceRect} the presenter adapter and a
 * verification reader both compute so a fork's choice buttons lay out and hit-test
 * identically. Asserts the stacked-list arithmetic and totality for stray indices.
 */
import { describe, expect, it } from "vitest";

import { DialogueLayout, GameView } from "../../src/consts";
import {
  dialogueCaptionFits,
  dialogueCaptionMaxLines,
  dialogueChoiceFontPx,
  dialogueChoiceInnerWidth,
  dialogueChoiceLabelFitsAtBase,
  dialogueChoiceRect,
  estimateCaptionLineCount,
  estimateChoiceLabelWidth,
} from "../../src/ui/dialogue-layout";
import { buildFinaleScript } from "../../src/content/scenes/finale";
import { SIDE_MILL_SCRIPT } from "../../src/content/scenes/side-mill";
import { CH1_SCRIPT } from "../../src/content/scenes/ch1";
import { RECKONING_SCRIPT } from "../../src/content/scenes/reckoning";
import { demoDialogueScript } from "../../src/uat/dialogue-view";
import { EndingIds, type SceneDef } from "../../src/logic/narrative";

/**
 * The base choice font size (px) parsed from the typed choice style — the size every
 * authored label must render at without clipping the button (#262).
 */
const CHOICE_BASE_FONT_PX = 8;

/**
 * Collect every authored choice label reachable in a scene-definition table (walking
 * each scene's nodes and their `choices`). Lets the fit guard assert against the real
 * authored content — a new over-long label anywhere fails this twin, not the player.
 * @param table - A scene-definition table.
 * @returns Every choice label authored in the table.
 */
function choiceLabels(table: Readonly<Record<string, SceneDef>>): string[] {
  return Object.values(table).flatMap(scene =>
    scene.nodes.flatMap(node =>
      (node.choices ?? []).map(choice => choice.label)
    )
  );
}

/**
 * Every authored dialogue choice label in the shipped game: the full finale fork (all
 * four endings — the worst offenders in #262), the side-mill fork, and the UAT demo
 * script. The longest is the 52-char "The third way — …" ending.
 */
const AUTHORED_CHOICE_LABELS: readonly string[] = [
  ...choiceLabels(
    buildFinaleScript([
      EndingIds.sunder,
      EndingIds.wake,
      EndingIds.thirdWay,
      EndingIds.letDie,
    ])
  ),
  ...choiceLabels(SIDE_MILL_SCRIPT),
  ...choiceLabels(demoDialogueScript()),
];

describe("dialogueChoiceRect — full-width, downward-stacked choice buttons", () => {
  it("places row 0 at the configured top-right anchor", () => {
    const rect = dialogueChoiceRect(0);
    expect(rect).toEqual({
      x: DialogueLayout.choiceRightX - DialogueLayout.choiceWidth,
      y: DialogueLayout.choiceTopY,
      width: DialogueLayout.choiceWidth,
      height: DialogueLayout.choiceHeight,
    });
  });

  it("stacks each subsequent row down by height + gap", () => {
    const first = dialogueChoiceRect(0);
    const second = dialogueChoiceRect(1);
    expect(second.y - first.y).toBe(
      DialogueLayout.choiceHeight + DialogueLayout.choiceGap
    );
    expect(second.x).toBe(first.x);
    expect(second.width).toBe(first.width);
  });

  it("keeps a constant left edge and size across rows", () => {
    for (const index of [0, 1, 2, 5]) {
      const rect = dialogueChoiceRect(index);
      expect(rect.x).toBe(
        DialogueLayout.choiceRightX - DialogueLayout.choiceWidth
      );
      expect(rect.width).toBe(DialogueLayout.choiceWidth);
      expect(rect.height).toBe(DialogueLayout.choiceHeight);
    }
  });

  it("clamps a negative index to row 0 (totality)", () => {
    expect(dialogueChoiceRect(-3)).toEqual(dialogueChoiceRect(0));
  });

  it("keeps every stacked button fully within the 384-wide viewport (#262)", () => {
    // Up to four choices at a merciful finale; each button's box must sit on-screen.
    for (const index of [0, 1, 2, 3]) {
      const rect = dialogueChoiceRect(index);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(GameView.width);
    }
  });
});

describe("dialogue choice label fit guard (#262)", () => {
  it("derives the inner text width from the button width and pads", () => {
    expect(dialogueChoiceInnerWidth()).toBe(
      DialogueLayout.choiceWidth - 2 * DialogueLayout.choicePadX
    );
  });

  it("estimates width linearly in glyph count and font size (em dash = one glyph)", () => {
    // "a — b" is five code points (a, space, em dash, space, b), not seven UTF-8 bytes.
    expect(estimateChoiceLabelWidth("a — b", CHOICE_BASE_FONT_PX)).toBeCloseTo(
      5 * CHOICE_BASE_FONT_PX * 0.62
    );
    expect(estimateChoiceLabelWidth("abcd", 16)).toBe(
      2 * estimateChoiceLabelWidth("abcd", 8)
    );
  });

  it("fits EVERY authored choice label at the base font — the whole game", () => {
    expect(AUTHORED_CHOICE_LABELS.length).toBeGreaterThan(0);
    for (const label of AUTHORED_CHOICE_LABELS) {
      expect(
        dialogueChoiceLabelFitsAtBase(label),
        `authored choice label overflows the button at base font: ${JSON.stringify(label)}`
      ).toBe(true);
      // Fitting at base means the presenter renders it full-size (never shrinks it).
      expect(dialogueChoiceFontPx(label)).toBe(CHOICE_BASE_FONT_PX);
      // And the estimated render stays inside the button AND the 384 viewport.
      const rect = dialogueChoiceRect(0);
      const rightEdge =
        rect.x +
        DialogueLayout.choicePadX +
        estimateChoiceLabelWidth(label, CHOICE_BASE_FONT_PX);
      expect(rightEdge).toBeLessThanOrEqual(GameView.width);
    }
  });

  it("proves the longest authored label clears the button with headroom", () => {
    const [longest = ""] = [...AUTHORED_CHOICE_LABELS].sort(
      (a, b) => [...b].length - [...a].length
    );
    // The 52-char "The third way — …" ending is the worst case.
    expect([...longest].length).toBeGreaterThanOrEqual(52);
    expect(estimateChoiceLabelWidth(longest, CHOICE_BASE_FONT_PX)).toBeLessThan(
      dialogueChoiceInnerWidth()
    );
  });

  it("shrinks an over-long label by whole pixels, clamped to the legible floor", () => {
    const tooLong = "x".repeat(200); // no font shipped could hold this at base
    const fitted = dialogueChoiceFontPx(tooLong);
    expect(fitted).toBeLessThan(CHOICE_BASE_FONT_PX);
    expect(Number.isInteger(fitted)).toBe(true);
    expect(fitted).toBeGreaterThanOrEqual(DialogueLayout.choiceMinFontPx);
    // Even a pathological label never drops below the floor (totality).
    expect(dialogueChoiceFontPx("y".repeat(10_000))).toBe(
      DialogueLayout.choiceMinFontPx
    );
  });

  it("returns the base font for an empty label (totality)", () => {
    expect(dialogueChoiceFontPx("")).toBe(CHOICE_BASE_FONT_PX);
  });
});

/**
 * Collect every authored caption body (`node.text`) reachable in a scene-definition
 * table. Lets the caption-fit guard assert against the real authored content — a new
 * over-long caption anywhere fails this twin, not the player (#263, mirroring
 * {@link choiceLabels}).
 * @param table - A scene-definition table.
 * @returns Every non-empty caption body authored in the table.
 */
function captionTexts(table: Readonly<Record<string, SceneDef>>): string[] {
  return Object.values(table).flatMap(scene =>
    scene.nodes.map(node => node.text).filter((text): text is string => !!text)
  );
}

/**
 * Every authored dialogue caption body in the shipped game: Ch.1, the side-mill side
 * story, the Reckoning set-piece, the full finale (all four endings), and the UAT demo
 * script. The longest wrap to four rows (the 206-char mill line, the 198-char Sallow
 * line) — the box is sized to hold exactly those (#263).
 */
const AUTHORED_CAPTIONS: readonly string[] = [
  ...captionTexts(CH1_SCRIPT),
  ...captionTexts(SIDE_MILL_SCRIPT),
  ...captionTexts(RECKONING_SCRIPT),
  ...captionTexts(
    buildFinaleScript([
      EndingIds.sunder,
      EndingIds.wake,
      EndingIds.thirdWay,
      EndingIds.letDie,
    ])
  ),
  ...captionTexts(demoDialogueScript()),
];

describe("dialogue caption fit guard (#263)", () => {
  it("derives the box's row capacity from the caption geometry", () => {
    // Mirrors dialogueCaptionMaxLines' derivation with the module's row-height (9.3px)
    // and bottom-pad (2px) constants — the box's usable rows from the caption top down.
    const CAPTION_LINE_HEIGHT_PX = 9.3;
    const CAPTION_BOTTOM_PAD_Y = 2;
    const usable =
      DialogueLayout.boxY +
      DialogueLayout.boxHeight -
      DialogueLayout.captionY -
      CAPTION_BOTTOM_PAD_Y;
    expect(dialogueCaptionMaxLines()).toBe(
      Math.floor(usable / CAPTION_LINE_HEIGHT_PX)
    );
    // The box is sized so the longest authored caption (4 rows) fits.
    expect(dialogueCaptionMaxLines()).toBe(4);
  });

  it("counts wrapped rows greedily, breaking on spaces and newlines", () => {
    // A single short word is one row; an explicit newline forces a second.
    expect(estimateCaptionLineCount("hello")).toBe(1);
    expect(estimateCaptionLineCount("hello\nworld")).toBe(2);
    // An empty / whitespace-only body still occupies a single row (totality).
    expect(estimateCaptionLineCount("")).toBe(1);
  });

  it("matches the live-measured row count at the 3-row / 4-row boundary", () => {
    // The 198-char Sallow line measured 4 rows (32.9px) on the live canvas; a 3-row
    // finale line (the 159-char arrival) measured 24.6px. The estimate agrees — never
    // under-counting — so the guard's verdict tracks the real render (#263).
    const sallow =
      "You came all this way to stand at the end of the world. Courteous. It is nearly finished — one last note, and the render is total. But you may set the note. I am, if nothing else, a fair accountant.";
    const arrival =
      "The heart of Aurel. No walls, just grey going up forever, and the corpse-reactor at the center of it all, singing wrong. And him, waiting. Of course he waited.";
    expect(estimateCaptionLineCount(sallow)).toBe(4);
    expect(estimateCaptionLineCount(arrival)).toBe(3);
  });

  it("fits EVERY authored caption within the box — the whole game", () => {
    expect(AUTHORED_CAPTIONS.length).toBeGreaterThan(0);
    for (const caption of AUTHORED_CAPTIONS) {
      expect(
        dialogueCaptionFits(caption),
        `authored caption overflows the box (${estimateCaptionLineCount(
          caption
        )} rows > ${dialogueCaptionMaxLines()}): ${JSON.stringify(caption.slice(0, 60))}…`
      ).toBe(true);
    }
  });

  it("proves the longest authored caption reaches — but does not exceed — the box's row capacity", () => {
    const [longest = ""] = [...AUTHORED_CAPTIONS].sort(
      (a, b) => estimateCaptionLineCount(b) - estimateCaptionLineCount(a)
    );
    // The worst case really does use all four rows (so the box grow is load-bearing,
    // not slack) — and still fits.
    expect(estimateCaptionLineCount(longest)).toBe(dialogueCaptionMaxLines());
    expect(dialogueCaptionFits(longest)).toBe(true);
  });

  it("rejects a caption one row past the box's capacity (the guard has teeth)", () => {
    // A body long enough to wrap to five rows must fail — future authors get a red CI,
    // not a player staring at a line below the border.
    const fiveRows = "word ".repeat(80).trim();
    expect(estimateCaptionLineCount(fiveRows)).toBeGreaterThan(
      dialogueCaptionMaxLines()
    );
    expect(dialogueCaptionFits(fiveRows)).toBe(false);
  });
});
