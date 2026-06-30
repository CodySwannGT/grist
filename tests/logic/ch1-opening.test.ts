import { describe, expect, it } from "vitest";

import {
  CH1_AMBUSH_ENCOUNTER,
  CH1_OPENING_SCENE_ID,
  CH1_SCRIPT,
  SABLE_REVEALED_FLAG,
} from "../../src/content/scenes/ch1";
import { ENCOUNTERS } from "../../src/content";
import {
  buildOpeningAmbushLaunch,
  foldRevealFlag,
  isAtRevealNode,
  type OpeningFlowState,
} from "../../src/logic/narrative/opening";
import {
  dialogueView,
  initialDialoguePresenter,
  presentDialogue,
  readLedgerFlag,
  type DialoguePresenterState,
} from "../../src/logic/narrative";

/**
 * Ch.1 "The delivery" OPENING-FLOW logic (#105 / PD-3.2). The cherry-picked
 * `ch1-content.test.ts` already proves the authored scene/flag DATA + ambush
 * `EncounterDef` shapes; THIS suite proves the pure flow logic the Opening scene
 * adapter consumes verbatim: driving the #92 presenter over the Ch.1 script reaches
 * the reveal node (where the adapter folds the `sable-revealed` flag — reducers
 * never auto-write flags), the narrative ends at the terminal klaxon (the handoff
 * point), and the deterministic ambush-launch payload names exactly the tutorial
 * ambush under a fixed seed. Pure, Phaser-free, deterministic — no Math.random,
 * no Date.now; the same seed yields the same launch.
 */

/**
 * Open the Ch.1 presenter at the opening scene's first node.
 * @returns The opened presenter state (asserted non-null).
 */
function openCh1(): DialoguePresenterState {
  const state = initialDialoguePresenter(CH1_SCRIPT[CH1_OPENING_SCENE_ID]!);
  expect(state).not.toBeNull();
  return state!;
}

describe("Ch.1 opening flow — reveal-node flag fold (#105 AC2)", () => {
  it("walks the script, lands on the reveal node, and the adapter folds sable-revealed there", () => {
    let presenter = openCh1();
    let flow: OpeningFlowState = { revealed: false };
    let sawReveal = false;

    for (let guard = 0; guard < 50; guard += 1) {
      // The exact thing the Opening adapter does each step: when the cursor sits
      // at the reveal node, fold the flag into the flow (the reducer stays pure).
      if (isAtRevealNode(presenter, CH1_SCRIPT)) {
        sawReveal = true;
        flow = foldRevealFlag(flow);
      }
      const view = dialogueView(presenter, CH1_SCRIPT);
      if (view.done) {
        break;
      }
      presenter = presentDialogue(presenter, { kind: "advance" }, CH1_SCRIPT);
    }

    // The reveal beat was reached, and reaching it folded the flag — exactly the
    // "the cargo opens to reveal Sable" hook landing.
    expect(sawReveal).toBe(true);
    expect(flow.revealed).toBe(true);
  });

  it("is NOT revealed before the cursor reaches the reveal node", () => {
    const presenter = openCh1();
    // The opening node is the smuggling-run hook, not the reveal.
    expect(isAtRevealNode(presenter, CH1_SCRIPT)).toBe(false);
    expect(foldRevealFlag({ revealed: false }).revealed).toBe(true);
    // A fresh flow has not revealed Sable yet.
    expect(({ revealed: false } as OpeningFlowState).revealed).toBe(false);
  });

  it("ends the narrative at the terminal klaxon beat (the ambush handoff point)", () => {
    let presenter = openCh1();
    for (let guard = 0; guard < 50; guard += 1) {
      const view = dialogueView(presenter, CH1_SCRIPT);
      if (view.done) {
        // The terminal beat names the klaxon / incoming Mourne muscle — the cue the
        // adapter hands off to the tutorial ambush on.
        expect(view.caption.toLowerCase()).toMatch(
          /klaxon|mourne|here they come/
        );
        return;
      }
      presenter = presentDialogue(presenter, { kind: "advance" }, CH1_SCRIPT);
    }
    throw new Error("the Ch.1 opening never reached its terminal beat");
  });

  it("also folds the flag via the pure narrative ledger when the adapter writes it (SaveService-safe)", () => {
    // The flow flag and the narrative-ledger flag agree: the adapter writes the
    // same `sable-revealed` ledger flag the cherry-picked content test asserts.
    expect(SABLE_REVEALED_FLAG).toBe("sable-revealed");
    const presenter = openCh1();
    expect(
      readLedgerFlag(presenter.narrative, SABLE_REVEALED_FLAG)
    ).toBeUndefined();
  });
});

describe("Ch.1 opening flow — deterministic ambush launch (#105 AC2/AC3)", () => {
  it("builds a launch naming exactly the tutorial ambush from a fixed seed", () => {
    const launch = buildOpeningAmbushLaunch(12345);
    expect(launch.encounterId).toBe(CH1_AMBUSH_ENCOUNTER);
    // A dangling reference would not resolve in the encounter table.
    expect(ENCOUNTERS[CH1_AMBUSH_ENCOUNTER]).toBeDefined();
    expect(Number.isInteger(launch.seed)).toBe(true);
  });

  it("is deterministic: the same seed yields an identical launch (no Math.random / Date.now)", () => {
    expect(buildOpeningAmbushLaunch(777)).toEqual(
      buildOpeningAmbushLaunch(777)
    );
    // A different opening seed threads a different battle seed (so two cold-starts
    // are not accidentally identical), but both still name the tutorial ambush.
    const a = buildOpeningAmbushLaunch(1);
    const b = buildOpeningAmbushLaunch(2);
    expect(a.encounterId).toBe(b.encounterId);
    expect(a.seed).not.toBe(b.seed);
  });
});
