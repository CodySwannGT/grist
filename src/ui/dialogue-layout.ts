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
 * The base caption font size in px, parsed once from the typed
 * {@link DialogueTextStyles.caption} style so the line-count estimate and the renderer
 * never drift on it (the same parse idiom as {@link CHOICE_BASE_FONT_PX}).
 */
const CAPTION_BASE_FONT_PX = Number.parseInt(
  DialogueTextStyles.caption.fontSize as string,
  10
);

/**
 * A conservative upper bound (px) on the caption font's rendered line height — the row
 * pitch of the browser's default monospace at the 8px caption font, which VARIES by
 * browser (the live Phaser text object measures ~8.21px/row on the CI Chromium but
 * ~9.25px/row on desktop Chrome). 9.3 rounds the tall end up so {@link
 * dialogueCaptionMaxLines} never over-counts the rows the box can hold on any browser
 * (#263). The vertical counterpart of {@link MONO_ADVANCE_RATIO}.
 */
const CAPTION_LINE_HEIGHT_PX = 9.3;

/**
 * Padding (px) reserved below the last caption row before the box's bottom border, so
 * {@link dialogueCaptionMaxLines} leaves the 9-slice border clear rather than letting a
 * row's descenders touch it (#263).
 */
const CAPTION_BOTTOM_PAD_Y = 2;

/**
 * The number of rows `text` wraps to when rendered as the caption body — a greedy,
 * space-broken word-wrap simulation over {@link DialogueLayout.captionWrapWidth} at the
 * caption font, mirroring Phaser's basic word wrap (words are packed onto a line until
 * the next word — plus a space — would exceed the wrap width, then a new row begins; a
 * lone word wider than the wrap still takes its own row). Widths use the conservative
 * {@link MONO_ADVANCE_RATIO} upper bound so the count never *under*-reports the real
 * render (validated against the live caption object: 3-row lines measure 24.6px, 4-row
 * lines 32.9px). Explicit newlines start a new row. A total function of the text (#263).
 * @param text - The caption body text.
 * @returns The number of wrapped rows the caption renders to (≥1 for non-empty text).
 */
export function estimateCaptionLineCount(text: string): number {
  const charWidth = CAPTION_BASE_FONT_PX * MONO_ADVANCE_RATIO;
  const wrapWidth = DialogueLayout.captionWrapWidth;
  return text.split("\n").reduce((total, paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return total + 1;
    }
    // Greedy pack: extend the current row with `space + word` while it fits, else start
    // a new row. `lineWidth === 0` marks a fresh row (its first word takes no leading space).
    const packed = words.reduce(
      (row, word) => {
        const wordWidth = [...word].length * charWidth;
        if (row.lineWidth === 0) {
          return { rows: row.rows, lineWidth: wordWidth };
        }
        const withWord = row.lineWidth + charWidth + wordWidth;
        return withWord <= wrapWidth
          ? { rows: row.rows, lineWidth: withWord }
          : { rows: row.rows + 1, lineWidth: wordWidth };
      },
      { rows: 1, lineWidth: 0 }
    );
    return total + packed.rows;
  }, 0);
}

/**
 * The maximum number of caption rows the box can show fully within its bottom border —
 * derived from the box geometry: the usable height from the caption top
 * ({@link DialogueLayout.captionY}) down to the box's bottom border, less the reserved
 * {@link CAPTION_BOTTOM_PAD_Y}, divided by the conservative {@link CAPTION_LINE_HEIGHT_PX}
 * row height (floored). With the shipped constants this is 4 — the box is sized so the
 * longest authored caption (4 rows) fits
 * (#263). Changing the box height or caption font moves this in lockstep, and the
 * caption-fit twin re-checks every authored line against it.
 * @returns The number of caption rows that fit inside the box.
 */
export function dialogueCaptionMaxLines(): number {
  const usable =
    DialogueLayout.boxY +
    DialogueLayout.boxHeight -
    DialogueLayout.captionY -
    CAPTION_BOTTOM_PAD_Y;
  return Math.floor(usable / CAPTION_LINE_HEIGHT_PX);
}

/**
 * Whether `text` renders within the caption box's bottom border — its estimated row
 * count is at most {@link dialogueCaptionMaxLines}. The authored-content guard: the
 * dialogue-layout unit twin asserts this holds for every authored caption in the game,
 * so a future caption long enough to spill below the box fails CI rather than silently
 * overflowing at the player (#263, mirroring the {@link dialogueChoiceLabelFitsAtBase}
 * idiom for choice labels).
 * @param text - The caption body text.
 * @returns True when the caption fits inside the box.
 */
export function dialogueCaptionFits(text: string): boolean {
  return estimateCaptionLineCount(text) <= dialogueCaptionMaxLines();
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
