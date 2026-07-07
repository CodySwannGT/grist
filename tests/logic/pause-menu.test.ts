/**
 * Unit coverage for the pure pause/main-menu model (`logic/pause-menu`) — the
 * empirical proof for sub-task #113's acceptance criteria. Asserts the six menu
 * entries and their committed order (AC9: Party, Builds, Items, Ledger, Map,
 * System/Settings), that **Builds** resolves to the existing growth screen route —
 * not a re-spec'd one (AC10) — that **Ledger** surfaces the moral ledger (#98),
 * the ring-wrapping cursor navigation, and the ledger summary formatting.
 */
import { describe, expect, it } from "vitest";

import {
  PAUSE_MENU_ENTRIES,
  PauseMenuEntryIds,
  formatMoralLedger,
  moveCursor,
  newPauseMenuState,
  resolveMenuCancel,
  selectedEntry,
} from "../../src/logic/pause-menu";
import { type MoralLedger } from "../../src/logic/save/types";
import { SceneKeys } from "../../src/consts";

describe("pause/main-menu entries — the six entries, in order (AC9)", () => {
  it("exposes exactly the six entries Party, Builds, Items, Ledger, Map, System/Settings", () => {
    expect(PAUSE_MENU_ENTRIES.map(entry => entry.label)).toEqual([
      "Party",
      "Builds",
      "Items",
      "Ledger",
      "Map",
      "System/Settings",
    ]);
  });

  it("orders the entry ids to match the labels", () => {
    expect(PAUSE_MENU_ENTRIES.map(entry => entry.id)).toEqual([
      PauseMenuEntryIds.party,
      PauseMenuEntryIds.builds,
      PauseMenuEntryIds.items,
      PauseMenuEntryIds.ledger,
      PauseMenuEntryIds.map,
      PauseMenuEntryIds.system,
    ]);
  });
});

describe("pause/main-menu routes — Builds reuses growth, Ledger surfaces the ledger (AC10, #98)", () => {
  it("routes Builds to the existing growth screen, not a re-spec'd one", () => {
    const builds = PAUSE_MENU_ENTRIES.find(
      entry => entry.id === PauseMenuEntryIds.builds
    );
    expect(builds?.route).toEqual({ kind: "growth" });
  });

  it("routes Ledger to the moral ledger surface", () => {
    const ledger = PAUSE_MENU_ENTRIES.find(
      entry => entry.id === PauseMenuEntryIds.ledger
    );
    expect(ledger?.route).toEqual({ kind: "ledger" });
  });

  it("routes the remaining panel entries to their own in-menu panels", () => {
    for (const id of [
      PauseMenuEntryIds.party,
      PauseMenuEntryIds.items,
      PauseMenuEntryIds.system,
    ]) {
      const entry = PAUSE_MENU_ENTRIES.find(candidate => candidate.id === id);
      expect(entry?.route).toEqual({ kind: "panel", panel: id });
    }
  });

  it("routes Map to the World Map travel scene (#241), not a placeholder panel", () => {
    const map = PAUSE_MENU_ENTRIES.find(
      entry => entry.id === PauseMenuEntryIds.map
    );
    expect(map?.route).toEqual({ kind: "worldmap" });
  });
});

describe("pause/main-menu cursor — ring navigation", () => {
  it("starts on the first entry (Party)", () => {
    expect(selectedEntry(newPauseMenuState()).id).toBe(PauseMenuEntryIds.party);
  });

  it("moves down through the list one entry at a time", () => {
    const afterDown = moveCursor(newPauseMenuState(), 1);
    expect(selectedEntry(afterDown).id).toBe(PauseMenuEntryIds.builds);
  });

  it("wraps from the last entry back to the first when moving down", () => {
    const last: { cursor: number } = { cursor: PAUSE_MENU_ENTRIES.length - 1 };
    expect(selectedEntry(moveCursor(last, 1)).id).toBe(PauseMenuEntryIds.party);
  });

  it("wraps from the first entry to the last when moving up", () => {
    expect(selectedEntry(moveCursor(newPauseMenuState(), -1)).id).toBe(
      PauseMenuEntryIds.system
    );
  });

  it("never mutates the input state", () => {
    const state = newPauseMenuState();
    moveCursor(state, 1);
    expect(state.cursor).toBe(0);
  });
});

describe("resolveMenuCancel — Cancel/Back peels one layer at a time (#233)", () => {
  it("closes an open detail panel first, even when a caller is present", () => {
    // Back with a panel open returns to the entry list, not out of the menu.
    expect(
      resolveMenuCancel(PauseMenuEntryIds.ledger, SceneKeys.Field)
    ).toEqual({ kind: "close-panel" });
  });

  it("returns to the caller scene once the entry list is bare", () => {
    expect(resolveMenuCancel(null, SceneKeys.Field)).toEqual({
      kind: "return",
      scene: SceneKeys.Field,
    });
  });

  it("stays put standalone (no panel, no caller — the ?scene=menu seam)", () => {
    expect(resolveMenuCancel(null, null)).toEqual({ kind: "stay" });
  });

  it("closes the panel before returning even without a caller", () => {
    // A standalone menu with a panel open still peels the panel first.
    expect(resolveMenuCancel(PauseMenuEntryIds.system, null)).toEqual({
      kind: "close-panel",
    });
  });
});

describe("formatMoralLedger — the Ledger panel summary (#98)", () => {
  it("reports a positive karma as a Free lean with a signed value", () => {
    const ledger: MoralLedger = { karma: 3, freeChoices: 3, wieldChoices: 0 };
    expect(formatMoralLedger(ledger)).toEqual([
      "Karma: +3 (Free)",
      "Freed: 3",
      "Wielded: 0",
    ]);
  });

  it("reports a negative karma as a Wield lean", () => {
    const ledger: MoralLedger = { karma: -2, freeChoices: 0, wieldChoices: 2 };
    expect(formatMoralLedger(ledger)).toEqual([
      "Karma: -2 (Wield)",
      "Freed: 0",
      "Wielded: 2",
    ]);
  });

  it("reports a zero karma as Balanced", () => {
    const ledger: MoralLedger = { karma: 0, freeChoices: 0, wieldChoices: 0 };
    expect(formatMoralLedger(ledger)[0]).toBe("Karma: +0 (Balanced)");
  });
});
