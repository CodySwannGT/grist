/**
 * Unit coverage for the pure Title / main-menu model (`logic/title-menu`) — the
 * empirical proof for sub-task #226's front-door menu rules. Asserts the two menu
 * entries and their committed order (New Game, Continue), the ring-wrapping cursor
 * navigation, and the one availability rule that matters: **Continue** is selectable
 * only when a persisted save exists, while **New Game** always is.
 */
import { describe, expect, it } from "vitest";

import {
  TITLE_MENU_ENTRIES,
  TitleMenuEntryIds,
  isEntryEnabled,
  moveCursor,
  newTitleMenuState,
  selectedEntry,
  withHasSave,
} from "../../src/logic/title-menu";

describe("title-menu entries — the two front-door entries, in order (#226)", () => {
  it("exposes exactly New Game then Continue", () => {
    expect(TITLE_MENU_ENTRIES.map(entry => entry.label)).toEqual([
      "New Game",
      "Continue",
    ]);
  });

  it("orders the entry ids to match the labels", () => {
    expect(TITLE_MENU_ENTRIES.map(entry => entry.id)).toEqual([
      TitleMenuEntryIds.newGame,
      TitleMenuEntryIds.continue,
    ]);
  });
});

describe("title-menu cursor — a ring, focused on New Game by default", () => {
  it("rests the cursor on New Game (the always-available start) on a fresh state", () => {
    expect(selectedEntry(newTitleMenuState()).id).toBe(
      TitleMenuEntryIds.newGame
    );
  });

  it("moves down to Continue and wraps back to New Game", () => {
    const start = newTitleMenuState();
    const down = moveCursor(start, 1);
    expect(selectedEntry(down).id).toBe(TitleMenuEntryIds.continue);
    expect(selectedEntry(moveCursor(down, 1)).id).toBe(
      TitleMenuEntryIds.newGame
    );
  });

  it("wraps up from New Game to Continue (the ring's other end)", () => {
    expect(selectedEntry(moveCursor(newTitleMenuState(), -1)).id).toBe(
      TitleMenuEntryIds.continue
    );
  });

  it("preserves save availability across cursor moves", () => {
    const withSave = newTitleMenuState(true);
    expect(moveCursor(withSave, 1).hasSave).toBe(true);
  });
});

describe("title-menu availability — Continue is gated on a save existing (#226)", () => {
  const newGame = TITLE_MENU_ENTRIES[0]!;
  const cont = TITLE_MENU_ENTRIES[1]!;

  it("always enables New Game, save or not", () => {
    expect(isEntryEnabled(newTitleMenuState(false), newGame)).toBe(true);
    expect(isEntryEnabled(newTitleMenuState(true), newGame)).toBe(true);
  });

  it("disables Continue when no save exists", () => {
    expect(isEntryEnabled(newTitleMenuState(false), cont)).toBe(false);
  });

  it("enables Continue once a save exists", () => {
    expect(isEntryEnabled(newTitleMenuState(true), cont)).toBe(true);
  });

  it("folds a freshly-resolved save answer in without moving the cursor", () => {
    const focusedOnContinue = moveCursor(newTitleMenuState(false), 1);
    const resolved = withHasSave(focusedOnContinue, true);
    expect(resolved.cursor).toBe(focusedOnContinue.cursor);
    expect(isEntryEnabled(resolved, cont)).toBe(true);
  });
});
