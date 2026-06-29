/**
 * Unit coverage for the pure dialogue-choice geometry (`src/ui/dialogue-layout`):
 * the Phaser-free {@link dialogueChoiceRect} the presenter adapter and a
 * verification reader both compute so a fork's choice buttons lay out and hit-test
 * identically. Asserts the stacked-list arithmetic and totality for stray indices.
 */
import { describe, expect, it } from "vitest";

import { DialogueLayout } from "../../src/consts";
import { dialogueChoiceRect } from "../../src/ui/dialogue-layout";

describe("dialogueChoiceRect — right-aligned, downward-stacked choice buttons", () => {
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
});
