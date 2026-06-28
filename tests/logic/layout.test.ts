import { describe, expect, it } from "vitest";

import { BattleLayout } from "../../src/consts";
import { BattleSides } from "../../src/logic/combat";
import { COMMAND_ORDER } from "../../src/ui/commands";
import { commandRect, HudLayout, unitCenter } from "../../src/ui/layout";

describe("battle-view geometry", () => {
  it("anchors the front party member to the party column on the ground", () => {
    const front = unitCenter(BattleSides.party, 0);
    expect(front.x).toBe(BattleLayout.partyAnchorX);
    expect(front.y).toBe(BattleLayout.groundY - BattleLayout.unitHeight / 2);
  });

  it("steps back rows up the screen and staggers them by side", () => {
    const enemyFront = unitCenter(BattleSides.enemies, 0);
    const enemyBack = unitCenter(BattleSides.enemies, 1);
    // Back row sits higher (smaller y) than the front row.
    expect(enemyBack.y).toBeLessThan(enemyFront.y);
    // Enemies stagger to the right, party to the left (mirrored direction).
    expect(enemyBack.x).toBeGreaterThan(enemyFront.x);
    expect(unitCenter(BattleSides.party, 1).x).toBeLessThan(
      unitCenter(BattleSides.party, 0).x
    );
  });

  it("lays command buttons out as a right-aligned, non-overlapping column", () => {
    const rects = COMMAND_ORDER.map((_id, index) => commandRect(index));
    rects.forEach((rect, index) => {
      expect(rect.width).toBe(HudLayout.menuW);
      // Right-aligned: every button's right edge meets the menu's right edge.
      expect(rect.x + rect.width).toBe(HudLayout.menuRightX);
      // Each row sits directly below the previous one (no overlap, no gap).
      const previous = rects[index - 1];
      if (previous) {
        expect(rect.y).toBe(previous.y + HudLayout.menuRowH);
      }
    });
  });

  it("clamps an out-of-range command index to a valid row (stays total)", () => {
    expect(commandRect(-5)).toEqual(commandRect(0));
    expect(commandRect(999)).toEqual(commandRect(COMMAND_ORDER.length - 1));
  });
});
