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
import { DialogueLayout, DialogueTextStyles } from "../consts";
import type { Rect } from "./layout";

/**
 * Conservative monospace glyph-advance ratio (fraction of the font size a single
 * glyph occupies) used to estimate a choice label's render width — the same
 * char-width fit idiom the region banners use (`region-display-name` /
 * `region-battle-title` twins, #248). Chosen as a safe upper bound on the browser
 * default monospace advance (~0.6em), so an estimate that fits guarantees the real
 * render fits and can never under-report a label into a clip.
 */
const MONO_ADVANCE_RATIO = 0.62;

/**
 * The base choice font size in px, parsed once from the typed
 * {@link DialogueTextStyles.choice} style so the layout math and the presenter never
 * drift on it.
 */
const CHOICE_BASE_FONT_PX = Number.parseInt(
  DialogueTextStyles.choice.fontSize as string,
  10
);

/**
 * The usable text width (logical px) inside a choice button — the button width less
 * both horizontal pads (the label is inset by `choicePadX` on the left and must clear
 * the same margin on the right). The width every label must fit to render un-clipped.
 * @returns The inner text width of a choice button.
 */
export function dialogueChoiceInnerWidth(): number {
  return DialogueLayout.choiceWidth - 2 * DialogueLayout.choicePadX;
}

/**
 * The estimated render width (logical px) of `label` at `fontPx` in the monospace
 * choice font — code-point count × font size × the conservative {@link
 * MONO_ADVANCE_RATIO}. Uses the spread count so an astral/combining glyph (e.g. the
 * em dash the finale labels carry) is measured as one advance, matching the render.
 * @param label - The choice label text.
 * @param fontPx - The font size to measure at.
 * @returns The estimated render width in logical px.
 */
export function estimateChoiceLabelWidth(
  label: string,
  fontPx: number
): number {
  return [...label].length * fontPx * MONO_ADVANCE_RATIO;
}

/**
 * Whether `label` fits a choice button's inner width at the **base** font — the
 * authored-content guard. The dialogue-layout unit twin asserts this holds for every
 * authored choice label in the game, so a future label long enough to shrink (let
 * alone clip) fails CI rather than silently degrading at the climactic fork (#262).
 * @param label - The choice label text.
 * @returns True when the label renders at full size within the button.
 */
export function dialogueChoiceLabelFitsAtBase(label: string): boolean {
  return (
    estimateChoiceLabelWidth(label, CHOICE_BASE_FONT_PX) <=
    dialogueChoiceInnerWidth()
  );
}

/**
 * The font size (px) the presenter renders `label` at: the base choice font when the
 * label fits the button's inner width, otherwise the largest whole-pixel size that
 * does (a single arithmetic step from the base, floored so it never overshoots),
 * clamped up to {@link DialogueLayout.choiceMinFontPx} so it stays legible. A pure,
 * deterministic total function of the label — the presenter applies it directly and
 * the unit twin asserts the same value, so runtime and test never drift and no label
 * can clip the button/screen edge (#262).
 * @param label - The choice label text.
 * @returns The whole-pixel font size to render the label at.
 */
export function dialogueChoiceFontPx(label: string): number {
  const inner = dialogueChoiceInnerWidth();
  const estimated = estimateChoiceLabelWidth(label, CHOICE_BASE_FONT_PX);
  if (estimated <= inner) {
    return CHOICE_BASE_FONT_PX;
  }
  const scaled = Math.floor((CHOICE_BASE_FONT_PX * inner) / estimated);
  return Math.max(DialogueLayout.choiceMinFontPx, scaled);
}

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
