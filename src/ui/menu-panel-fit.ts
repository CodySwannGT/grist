/**
 * Pure **menu detail-panel fit** geometry (#265): the Phaser-free math that decides how
 * many wrapped rows a body line takes inside the pause-menu detail panel, and the
 * authored-content guards that prove every authored codex row and party stat line stays
 * inside the panel chrome. The same {@link ledger-codex-panel} / {@link party-panel}
 * adapters read {@link codexWrapWidth} / {@link partyLineWrapWidth} to set Phaser's
 * `wordWrap.width`, so the estimate here and the real render never drift — the Ledger
 * QA finding (#265: "…pried the cargo op…" clipped at the right border, "*Emberwisp"
 * near-clipped) can never silently return.
 *
 * This is the pause-menu counterpart of `ui/dialogue-layout`'s caption/choice fit
 * idiom (#262 / #263): a conservative monospace glyph-advance ratio makes every width a
 * safe upper bound, so a line the estimator says fits N rows never renders wider, and
 * the unit twin (`tests/ui/menu-panel-fit`) asserts the longest authored content fits
 * — a future line long enough to wrap past its budget (or clip the border) fails CI
 * rather than degrading in front of the player.
 * @module ui/menu-panel-fit
 */
import { MenuLayout, MenuTextStyles, PartyLayout } from "../menu-consts";

/**
 * Conservative monospace glyph-advance ratio (fraction of the font size one glyph
 * occupies) — the same safe upper bound `ui/dialogue-layout` uses (~0.6em browser
 * default, rounded up to 0.62) so an estimate that fits guarantees the real render fits
 * and can never under-report a line into a clip.
 */
const MONO_ADVANCE_RATIO = 0.62;

/**
 * The codex/help body font size in px, parsed once from the typed
 * {@link MenuTextStyles.codexLine} style so the fit math and the renderer never drift.
 */
const CODEX_FONT_PX = Number.parseInt(
  MenuTextStyles.codexLine.fontSize as string,
  10
);

/**
 * The party stat-line font size in px, parsed once from the typed
 * {@link MenuTextStyles.partyMember} style.
 */
const PARTY_FONT_PX = Number.parseInt(
  MenuTextStyles.partyMember.fontSize as string,
  10
);

/**
 * The max wrapped rows an authored **codex** row (`✓ Title — recorded line`) may take.
 * Two lines is the shipped budget: the panel is widened (#265) so every authored
 * recorded line fits within two rows at {@link codexWrapWidth}, and the panel flows the
 * rows by their rendered height so a two-row entry never overlaps the next.
 */
export const MAX_CODEX_ROWS = 2;

/**
 * The max wrapped rows an authored **party** stat line may take. The widened panel fits
 * a typical `Name  Lnn  HPnnnn APnnn  ◈Shard` on one row; the longest roster name
 * ("Calliope Quill") carrying a shard wraps to a second row, which the panel's member
 * row gap ({@link PartyLayout.rowGap}) is sized to hold — so two rows is the budget and
 * nothing clips the panel's right border (#265: "*Emberwisp" near-clipped).
 */
export const MAX_PARTY_ROWS = 2;

/**
 * The detail panel's inner body width (logical px): the panel width less both
 * horizontal pads. The width every codex/help body line wraps to.
 * @returns The inner body width in logical px.
 */
export function menuPanelInnerWidth(): number {
  return MenuLayout.panelWidth - 2 * MenuLayout.panelPadX;
}

/**
 * The right-edge x (logical px) the panel body must stay left of — the panel's right
 * pad inset. A rendered line whose right edge exceeds this is clipped by the chrome.
 * @returns The inner right-edge x.
 */
export function menuPanelInnerRight(): number {
  return MenuLayout.panelX + MenuLayout.panelWidth - MenuLayout.panelPadX;
}

/**
 * The wrap width (logical px) for a **codex** body line — the full inner body width.
 * @returns The codex wrap width.
 */
export function codexWrapWidth(): number {
  return menuPanelInnerWidth();
}

/**
 * The wrap width (logical px) for a **party** stat line — the inner body width less the
 * portrait faceset and its inset, since the stat line starts to the right of the
 * portrait (see {@link party-panel}).
 * @returns The party stat-line wrap width.
 */
export function partyLineWrapWidth(): number {
  return (
    menuPanelInnerWidth() - (PartyLayout.portraitSize + PartyLayout.lineInset)
  );
}

/**
 * The number of rows `text` wraps to at `wrapWidth` in the monospace body font — a
 * greedy, space-broken word-wrap simulation mirroring Phaser's basic word wrap (words
 * are packed onto a row until the next word plus a space would exceed the wrap width,
 * then a new row begins; a lone word wider than the wrap still takes its own row).
 * Widths use the conservative {@link MONO_ADVANCE_RATIO} upper bound so the count never
 * *under*-reports the real render. A total function of the text (≥1 for non-empty).
 * @param text - The body line text.
 * @param wrapWidth - The wrap width in logical px.
 * @param fontPx - The font size the line renders at.
 * @returns The number of wrapped rows.
 */
export function estimateMenuLineRows(
  text: string,
  wrapWidth: number,
  fontPx: number
): number {
  const charWidth = fontPx * MONO_ADVANCE_RATIO;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 1;
  }
  // Greedy pack: extend the current row with `space + word` while it fits, else start a
  // new row. `lineWidth === 0` marks a fresh row (its first word takes no leading space).
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
  return packed.rows;
}

/**
 * Whether an authored **codex** row line fits the codex body within
 * {@link MAX_CODEX_ROWS} wrapped rows at {@link codexWrapWidth}. The authored-content
 * guard the unit twin asserts for every catalog row, so no recorded line can clip the
 * panel's right border (#265).
 * @param line - The formatted codex row line (`✓ Title — recorded line`).
 * @returns True when the line fits the codex row budget.
 */
export function codexRowLineFits(line: string): boolean {
  return (
    estimateMenuLineRows(line, codexWrapWidth(), CODEX_FONT_PX) <=
    MAX_CODEX_ROWS
  );
}

/**
 * Whether an authored **party** stat line fits within {@link MAX_PARTY_ROWS} wrapped
 * rows at {@link partyLineWrapWidth}. The authored-content guard the unit twin asserts
 * for every roster member (name + max-width stats + longest shard), so no member line
 * clips the panel's right border (#265: "*Emberwisp" near-clipped).
 * @param line - The formatted party stat line.
 * @returns True when the line fits the party row budget.
 */
export function partyMemberLineFits(line: string): boolean {
  return (
    estimateMenuLineRows(line, partyLineWrapWidth(), PARTY_FONT_PX) <=
    MAX_PARTY_ROWS
  );
}
