/**
 * Ch.1 "The delivery" — the scripted opening (sub-task #105, Story #93 PD-3.2).
 * The first **authored game content** for the narrative engine (#91 model / #92
 * presenter): Wren's routine smuggling run, the cargo that opens to reveal
 * **Sable** (the sleeping girl in the stasis-coffin), and the hook into the
 * drop-goes-wrong ambush. This is the real opening the dialogue-presenter's demo
 * fixture explicitly deferred ("PD-3.2 opening authors the real scripts").
 *
 * Pure, Phaser-free, JSON-round-trippable DATA consuming the {@link SceneDef}
 * model verbatim — the sim is never forked. The linear graph walks the beats from
 * the narrative wiki (the hook is Layer 0 of the central mystery: why is one
 * sleeping girl worth a city?); the {@link CH1_REVEAL_NODE_ID reveal node} is the
 * cargo-opens beat the Dialogue adapter folds the {@link SABLE_REVEALED_FLAG} on
 * when its cursor arrives (reducers never auto-write flags). Reaching the
 * narrative's end hands control to the {@link CH1_AMBUSH_ENCOUNTER tutorial
 * ambush} — the first tutorialized ATB skirmish — so the ambush begins
 * immediately after the reveal. The free-vs-wield fork is Ch.3 (out of scope here).
 *
 * Voice is faithful to `wiki/narrative/characters.md` (Wren: a wry, cause-allergic
 * survivor; Sable: gentle, frightened, dangerously powerful) and the Ch.1 beats in
 * `wiki/narrative/main-quest.md` / the Layer-0 hook in `wiki/narrative/story.md`.
 * @module content/scenes/ch1
 */
import { EncounterIds, type EncounterId } from "../encounters";
import type { SceneDef } from "../../logic/narrative";

/** The id of the Ch.1 opening scene (the script's entry). */
export const CH1_OPENING_SCENE_ID = "ch1-the-delivery";

/**
 * The id of the reveal node — the cargo-opens beat where Sable is revealed. The
 * Dialogue adapter writes {@link SABLE_REVEALED_FLAG} the moment its cursor lands
 * here, so the "hook lands" flag is data, written by the adapter, not the reducer.
 */
export const CH1_REVEAL_NODE_ID = "cargo-opens";

/**
 * The serializable narrative-ledger flag the reveal beat folds — "the hook has
 * landed". A plain boolean so the ledger stays JSON-round-trippable for
 * `SaveService`. Read by the verification suite to assert the reveal empirically.
 */
export const SABLE_REVEALED_FLAG = "sable-revealed";

/**
 * The encounter the opening hands off to when its narrative ends — the
 * drop-goes-wrong tutorial ambush (the first ATB skirmish). Typed as an
 * {@link EncounterId} so it can only name a defined encounter (a dangling
 * reference is a compile error).
 */
export const CH1_AMBUSH_ENCOUNTER: EncounterId = EncounterIds.tutorialAmbush;

/**
 * The deliberate **quiet beat** on the Sable reveal (PD-3.9 / #114): the hold in
 * milliseconds the {@link CH1_REVEAL_NODE_ID reveal node} carries so the moment the
 * cargo opens to a sleeping person lands before the player can advance. Data, not
 * behavior — the Dialogue adapter reads it off the node's view-model and pauses
 * once; the sim is never forked. Sized as a real, felt hold (not a single frame),
 * and audio-independent so it does not overlap sibling sub-task #115 (temp audio).
 */
export const SABLE_REVEAL_BEAT_MS = 900;

// Speaker content-ids (hoisted so the repeated literals don't trip the
// no-duplicate-string lint, mirroring the demo-script fixture's id hoisting).
const WREN = "wren";
const SABLE = "sable";

/** Node ids of the opening's linear beats (hoisted for the same lint reason). */
const N_HOOK = "hook";
const N_CARGO_REACHED = "cargo-reached";
const N_PRY = "pry";
const N_SABLE_WAKES = "sable-wakes";
const N_KLAXON = "klaxon";

/**
 * The Ch.1 opening script: one linear scene walking the smuggling run → reaching
 * the drop → prying the cargo → the Sable reveal ({@link CH1_REVEAL_NODE_ID}) →
 * Sable stirs → the ambush klaxon (the terminal beat that hands off to the
 * tutorial ambush). The terminal node omits `next` and the scene omits
 * `nextScene` (the narrative ends here and the adapter launches the fight) — under
 * `exactOptionalPropertyTypes`, the keys are absent, not `undefined`.
 */
export const CH1_SCRIPT: Readonly<Record<string, SceneDef>> = {
  [CH1_OPENING_SCENE_ID]: {
    id: CH1_OPENING_SCENE_ID,
    nodes: [
      {
        id: N_HOOK,
        speaker: WREN,
        text: "Another run through the Marrow. Move the crate, get paid, ask nothing. That's the job.",
        next: N_CARGO_REACHED,
      },
      {
        id: N_CARGO_REACHED,
        speaker: WREN,
        text: "The drop point. Heavier than it should be. Crates don't usually... breathe.",
        next: N_PRY,
      },
      {
        id: N_PRY,
        speaker: WREN,
        text: "To hell with asking nothing. Let's see what House Mourne paid this much to hide.",
        next: CH1_REVEAL_NODE_ID,
      },
      {
        id: CH1_REVEAL_NODE_ID,
        speaker: WREN,
        text: "...It's a girl. A sleeping girl, in a stasis-coffin. The cargo is a person. The lid's etched with one word: SABLE.",
        portrait: SABLE,
        // The deliberate quiet beat (#114): the reveal holds before it can be
        // advanced, so the "the cargo is a person" moment lands.
        beatMs: SABLE_REVEAL_BEAT_MS,
        next: N_SABLE_WAKES,
      },
      {
        id: N_SABLE_WAKES,
        speaker: SABLE,
        text: "(her eyes flicker open) ...Where— who are you? Please. Don't let them take me back.",
        portrait: SABLE,
        next: N_KLAXON,
      },
      {
        id: N_KLAXON,
        speaker: WREN,
        text: "A klaxon. Mourne muscle, and they want her badly. So much for the easy job — here they come.",
      },
    ],
  },
};
