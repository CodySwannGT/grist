/**
 * Unit coverage for the pure dialogue-choice geometry (`src/ui/dialogue-layout`):
 * the Phaser-free {@link dialogueChoiceRect} the presenter adapter and a
 * verification reader both compute so a fork's choice buttons lay out and hit-test
 * identically. Asserts the stacked-list arithmetic and totality for stray indices.
 */
import { describe, expect, it } from "vitest";

import { DialogueLayout, GameView } from "../../src/consts";
import {
  dialogueChoiceFontPx,
  dialogueChoiceInnerWidth,
  dialogueChoiceLabelFitsAtBase,
  dialogueChoiceRect,
  estimateChoiceLabelWidth,
} from "../../src/ui/dialogue-layout";
import { buildFinaleScript } from "../../src/content/scenes/finale";
import { SIDE_MILL_SCRIPT } from "../../src/content/scenes/side-mill";
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
