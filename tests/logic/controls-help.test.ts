/**
 * Unit suite for the pure controls & help reference (`src/logic/controls-help`, #228):
 * the static legend the pause menu's System/Settings panel renders so a player can
 * always look the controls up. Asserts the projections and that the reference quotes
 * the real bindings and the AP/Grist resource legend. Pure data-in/data-out.
 *
 * - [EVIDENCE: controls-help-lists-real-bindings] — the reference quotes the real
 *   field + battle bindings (WASD/arrows, Enter, Shift, M) and the AP/Grist legend.
 * - [EVIDENCE: controls-help-projections-agree] — the tagged and flat projections
 *   agree and mark section headings.
 */
import { describe, expect, it } from "vitest";
import {
  CONTROLS_HELP,
  CONTROLS_HELP_LINE_COUNT,
  controlsHelpDisplay,
  controlsHelpLines,
} from "../../src/logic/controls-help";

/** The whole reference as one blob, for substring assertions. */
const BLOB = controlsHelpLines().join("\n");

describe("controls & help reference (#228)", () => {
  it("[EVIDENCE: controls-help-lists-real-bindings] quotes the real field bindings (WASD/arrows, Enter, map M)", () => {
    expect(BLOB).toContain("WASD");
    expect(BLOB).toContain("Enter");
    expect(BLOB).toContain("Map M");
  });

  it("[EVIDENCE: controls-help-lists-real-bindings] quotes the real battle-speed binding (Shift), never Tab", () => {
    expect(BLOB).toContain("Shift");
    expect(BLOB).not.toContain("Tab");
  });

  it("[EVIDENCE: controls-help-lists-pause-menu-opener] lists the Esc pause-menu opener (#233)", () => {
    // The reference the pause menu itself renders must teach how to open it —
    // the FIELD section names the real Esc opener wired in field-input-map.
    expect(BLOB).toContain("Menu");
    expect(BLOB).toContain("Esc");
  });

  it("[EVIDENCE: controls-help-lists-real-bindings] glosses the AP and Grist resources the command menu prices in", () => {
    expect(BLOB).toContain("AP");
    expect(BLOB).toContain("Grist");
  });

  it("[EVIDENCE: controls-help-projections-agree] the flat projection is every section title followed by its rows", () => {
    const expected = CONTROLS_HELP.flatMap(section => [
      section.title,
      ...section.rows,
    ]);
    expect(controlsHelpLines()).toEqual(expected);
  });

  it("[EVIDENCE: controls-help-projections-agree] the tagged projection marks section titles as headings and rows as body", () => {
    const display = controlsHelpDisplay();
    const headings = display
      .filter(line => line.heading)
      .map(line => line.text);
    expect(headings).toEqual(CONTROLS_HELP.map(section => section.title));
    // Every non-heading line is a row of some section (no stray lines).
    const rows = display.filter(line => !line.heading).map(line => line.text);
    expect(rows).toEqual(CONTROLS_HELP.flatMap(section => [...section.rows]));
  });

  it("[EVIDENCE: controls-help-projections-agree] the pooled line count matches the projection length", () => {
    expect(CONTROLS_HELP_LINE_COUNT).toBe(controlsHelpDisplay().length);
    expect(CONTROLS_HELP_LINE_COUNT).toBe(controlsHelpLines().length);
  });
});
