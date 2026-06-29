/**
 * Pure dialogue-presenter geometry: the hit/draw rectangle of each branch-choice
 * button, computed identically by the thin Phaser adapter (`src/ui/dialogue`, to
 * lay the buttons out and hit-test taps) and by a verification reader (to address
 * a choice under `?uat=1`). Phaser-free total functions over the typed
 * {@link DialogueLayout} constants — the dialogue counterpart of `commandRect` in
 * `src/ui/layout`, kept in its own module so it carries unit coverage without
 * dragging in battle-only geometry.
 * @module ui/dialogue-layout
 */
import { DialogueLayout } from "../consts";
import type { Rect } from "./layout";

/**
 * The hit/draw rectangle of the branch-choice button at `index` — a right-aligned
 * vertical list stacked downward from {@link DialogueLayout.choiceTopY}. A negative
 * index clamps to row 0 so the function stays total (never returns a NaN/negative
 * rect for a stray index).
 * @param index - The choice's position in the node's choice list.
 * @returns The button's logical rectangle.
 */
export function dialogueChoiceRect(index: number): Rect {
  const row = Math.max(0, index);
  return {
    x: DialogueLayout.choiceRightX - DialogueLayout.choiceWidth,
    y:
      DialogueLayout.choiceTopY +
      row * (DialogueLayout.choiceHeight + DialogueLayout.choiceGap),
    width: DialogueLayout.choiceWidth,
    height: DialogueLayout.choiceHeight,
  };
}
