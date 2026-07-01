import { describe, expect, it } from "vitest";

import { SceneKeys } from "../../src/consts";
import {
  MENU_ENTRY_ORDER,
  MenuEntries,
  menuEntryLabel,
  menuEntryRoute,
  moveSelection,
  type MenuEntryId,
} from "../../src/logic/pause-menu";

describe("pause/main menu catalog (#113 AC1)", () => {
  it("exposes exactly the six canonical entries in menu order", () => {
    // AC1: Party, Builds, Items, Ledger, Map, System/Settings — exact set + order.
    expect(MENU_ENTRY_ORDER).toEqual([
      MenuEntries.party,
      MenuEntries.builds,
      MenuEntries.items,
      MenuEntries.ledger,
      MenuEntries.map,
      MenuEntries.system,
    ]);
  });

  it("has exactly six entries (no missing, no extra)", () => {
    expect(MENU_ENTRY_ORDER).toHaveLength(6);
    expect(new Set(MENU_ENTRY_ORDER).size).toBe(6);
  });

  it("labels each entry with its ui-ux-and-controls display name", () => {
    expect(menuEntryLabel(MenuEntries.party)).toBe("Party");
    expect(menuEntryLabel(MenuEntries.builds)).toBe("Builds");
    expect(menuEntryLabel(MenuEntries.items)).toBe("Items");
    expect(menuEntryLabel(MenuEntries.ledger)).toBe("Ledger");
    expect(menuEntryLabel(MenuEntries.map)).toBe("Map");
    expect(menuEntryLabel(MenuEntries.system)).toBe("System/Settings");
  });
});

describe("pause/main menu routing (#113 AC2)", () => {
  it("routes Builds to the existing Phase-2 growth screen (SceneKeys.Bench), not a re-spec", () => {
    // AC2: Builds opens the reused #76 growth screen — its scene key is Bench.
    expect(menuEntryRoute(MenuEntries.builds)).toBe(SceneKeys.Bench);
  });

  it("routes Ledger to no wired scene yet (#98 logic present, ledger scene is a follow-up)", () => {
    // The Ledger entry surfaces the moral ledger; its scene is not built here, so
    // the route is null (present-but-unrouted) — the entry still exists (AC1).
    expect(menuEntryRoute(MenuEntries.ledger)).toBeNull();
  });

  it("routes the remaining follow-up entries to no wired scene yet", () => {
    expect(menuEntryRoute(MenuEntries.party)).toBeNull();
    expect(menuEntryRoute(MenuEntries.items)).toBeNull();
    expect(menuEntryRoute(MenuEntries.map)).toBeNull();
    expect(menuEntryRoute(MenuEntries.system)).toBeNull();
  });

  it("never routes an entry to a re-spec'd growth scene — only Bench is a growth target", () => {
    const growthTargets = MENU_ENTRY_ORDER.filter(
      id => menuEntryRoute(id) === SceneKeys.Bench
    );
    expect(growthTargets).toEqual([MenuEntries.builds]);
  });
});

describe("pause/main menu keyboard navigation (moveSelection)", () => {
  it("moves the highlighted index forward and backward", () => {
    expect(moveSelection(0, 1)).toBe(1);
    expect(moveSelection(3, -1)).toBe(2);
  });

  it("wraps from the last entry to the first and vice versa", () => {
    // Six entries: index 5 + 1 wraps to 0; index 0 - 1 wraps to 5.
    expect(moveSelection(MENU_ENTRY_ORDER.length - 1, 1)).toBe(0);
    expect(moveSelection(0, -1)).toBe(MENU_ENTRY_ORDER.length - 1);
  });

  it("resolves the entry id at a selected index", () => {
    const first: MenuEntryId | undefined = MENU_ENTRY_ORDER[0];
    expect(first).toBe(MenuEntries.party);
  });
});
