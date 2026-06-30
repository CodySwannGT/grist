/**
 * Wren's first side-story beat — **"What the mill took"** (#111, Story #98, PRD #42
 * FR5 / AC7). The first authored *side-story* content for the narrative engine
 * (#91 model / #92 presenter): a discoverable beat that traces Lira — the younger
 * sister Wren lost, "rendered to settle a family debt" (`wiki/narrative/
 * character-bios.md`) — one step up the chain to a Marrow rendering-mill, ending in
 * a **render-or-not** moral choice that "mirrors the whole game"
 * (`wiki/design/side-content.md`: the render-or-not decision recurs as situated
 * choices; the game "never blocks the shortcut and always remembers it").
 *
 * Pure, Phaser-free, JSON-round-trippable DATA consuming the {@link SceneDef} model
 * verbatim — the sim is never forked, mirroring `content/scenes/ch1` and the demo
 * fork fixture. The entry scene walks the discovery beats to a fork node
 * ({@link MILL_CHOICE_NODE_ID}) whose two {@link DialogueChoice}s cross (by scene id,
 * the way the presenter's `branch` arm resolves `to`) to two short terminal scenes:
 * - **render** ({@link MILL_RENDERED_SCENE_ID}) — the corruption-cost spend (what the
 *   mill did to Lira, repeated),
 * - **spare** ({@link MILL_SPARED_SCENE_ID}) — refusing to render (the path Wren's arc
 *   earns).
 *
 * Crucially, the dialogue here only *renders* the choice and makes the beat
 * reachable; the **persistence** the AC requires ("a moral-ledger flag is persisted
 * and survives save/reload") rests on the **persisted** {@link MoralLedger} the
 * `logic/side-story/mill` choice logic folds via the PD-3.0 free-vs-wield reducers —
 * NOT on the (non-serialized, pending #116) narrative `flags` ledger. This module is
 * the player-facing surface of that fork; `logic/side-story/mill` is its persisted
 * consequence.
 *
 * Voice is faithful to `wiki/narrative/character-bios.md` (Wren: wry, clipped Marrow
 * slang, cause-allergic, the grief over Lira hidden under jokes) and the side-story
 * summary there (*What the mill took* — tracing Lira's rendering up the chain).
 * @module content/scenes/side-mill
 */
import type { SceneDef } from "../../logic/narrative";

/** The id of the mill side-story entry scene (the beat's discovery walk + fork). */
export const SIDE_MILL_SCENE_ID = "side-mill-what-the-mill-took";

/**
 * The id of the fork node — where the render-or-not choice is offered. Reached by
 * advancing the discovery beats; the bridge/e2e asserts the choice is rendered here
 * (the two {@link DialogueChoice}s) before committing the persisted fork.
 */
export const MILL_CHOICE_NODE_ID = "mill-choice";

/**
 * The stable id of the **render** branch — both the {@link DialogueChoice} the player
 * picks and the terminal scene it crosses to (the presenter resolves a choice's `to`
 * as a scene id). Hoisted so the one literal names both and does not trip the
 * no-duplicate-string lint (mirroring `ch1.ts`'s id hoisting).
 */
export const MILL_RENDER_CHOICE_ID = "render";

/** The stable id of the **spare** branch — the choice and the terminal scene it crosses to. */
export const MILL_SPARE_CHOICE_ID = "spare";

/** The terminal scene id reached by choosing **render** (the payout, the cost). */
export const MILL_RENDERED_SCENE_ID = "side-mill-rendered";

/** The terminal scene id reached by choosing **spare** (the mill jammed, clean hands). */
export const MILL_SPARED_SCENE_ID = "side-mill-spared";

// Speaker + node ids (hoisted so the repeated literals don't trip the
// no-duplicate-string lint, mirroring `ch1.ts`).
const WREN = "wren";
const N_FOUND = "found";
const N_LEDGER = "ledger";
const N_THE_MARK = "the-mark";
const N_OUTCOME = "outcome";

/**
 * The mill side-story script: a linear discovery walk in the entry scene (finding the
 * mill → reading its ledger → recognizing Lira's mark) into the render-or-not fork
 * ({@link MILL_CHOICE_NODE_ID}), whose two choices cross to the two short terminal
 * scenes ({@link MILL_RENDERED_SCENE_ID} / {@link MILL_SPARED_SCENE_ID}). The fork
 * node carries `choices` and no `next`, so the presenter branches rather than walking
 * on; the terminal scenes' single nodes omit `next` and the scenes omit `nextScene`
 * (the beat ends here — no Ch.-style handoff), so under `exactOptionalPropertyTypes`
 * those keys are absent, not `undefined`.
 */
export const SIDE_MILL_SCRIPT: Readonly<Record<string, SceneDef>> = {
  [SIDE_MILL_SCENE_ID]: {
    id: SIDE_MILL_SCENE_ID,
    nodes: [
      {
        id: N_FOUND,
        speaker: WREN,
        text: "Knew this place by the smell before the sign. A rendering-mill. The kind that turns people into grist and calls it settling accounts.",
        next: N_LEDGER,
      },
      {
        id: N_LEDGER,
        speaker: WREN,
        text: "Their intake ledger's still warm. Names, debts, the price each one fetched. Forty years of clean arithmetic.",
        next: N_THE_MARK,
      },
      {
        id: N_THE_MARK,
        speaker: WREN,
        text: "...There. A girl's name I spent years not saying. Lira. So this is the mark the mill took. And it's still spinning.",
        next: MILL_CHOICE_NODE_ID,
      },
      {
        id: MILL_CHOICE_NODE_ID,
        speaker: WREN,
        text: "One pull of the lever renders what's left in the hopper — pays out double, like it always did. Or I jam it and walk away with nothing but my hands clean. So. What did the mill take, and what do I take back?",
        choices: [
          {
            id: MILL_RENDER_CHOICE_ID,
            label: "Render it — take the payout",
            to: MILL_RENDERED_SCENE_ID,
          },
          {
            id: MILL_SPARE_CHOICE_ID,
            label: "Spare it — jam the mill",
            to: MILL_SPARED_SCENE_ID,
          },
        ],
      },
    ],
  },
  [MILL_RENDERED_SCENE_ID]: {
    id: MILL_RENDERED_SCENE_ID,
    nodes: [
      {
        id: N_OUTCOME,
        speaker: WREN,
        text: "The lever gives. The hopper goes quiet, and the grist is heavy in my pocket. Lira'd understand. That's the lie I'll tell, anyway.",
      },
    ],
  },
  [MILL_SPARED_SCENE_ID]: {
    id: MILL_SPARED_SCENE_ID,
    nodes: [
      {
        id: N_OUTCOME,
        speaker: WREN,
        text: "I jam the gears with the ledger itself. No payout. Just the mill, stopped, and one name it doesn't get to spend twice.",
      },
    ],
  },
};
