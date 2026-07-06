/**
 * The Reckoning — Sallow's **Second Sundering** set-piece script (#125, Story #122).
 * The authored narrative content for the Act I → Act II hinge the pure world-turn
 * logic (`logic/narrative/reckoning`) plays: the Ch.5 confrontation atop Aurel's
 * corpse fails, Sallow overloads the corpse-reactor, and the world turns — lower Vanta
 * and a whole region rendered to ash, the party scattered, Sable taken, the color and
 * music drained to Ashfall.
 *
 * Pure, Phaser-free, JSON-round-trippable DATA consuming the {@link SceneDef} model
 * verbatim (the same content-as-data idiom as `content/scenes/ch1`) — the dialogue
 * presenter (`logic/narrative`) walks it, the thin Phaser adapter renders it, and the
 * `__VERIFY__` bridge can read it. The node ids + the persisted flag key are owned by
 * `logic/narrative/reckoning` (imported here, so the played logic and the authored
 * script agree on one source of truth): the {@link RECKONING_TURN_NODE_ID world-turns}
 * node carries a deliberate **quiet beat** so the hard cut lands, and it is the
 * persisted scene cursor a Reckoning save parks at.
 *
 * Voice is faithful to `wiki/narrative/characters.md` (Mr. Sallow: "courteous, total,
 * already moving"; Wren: wry, cause-allergic; Sable: gentle, frightened) and the
 * Reckoning beats in `wiki/narrative/main-quest.md` / `wiki/narrative/themes-and-tone.md`.
 * Full choreography is deferred to authoring time (decision 0003); this is the played
 * beat sheet.
 * @module content/scenes/reckoning
 */
import type { SceneDef } from "../../logic/narrative";
import {
  RECKONING_SCENE_ID,
  RECKONING_TURN_NODE_ID,
} from "../../logic/narrative/reckoning";

/**
 * The deliberate **quiet beat** on the world-turns node (the #114 idiom): the hold in
 * milliseconds the hard cut carries so the world tipping into Ashfall — the color and
 * music draining — lands before the player can advance. Data, not behavior; the
 * adapter reads it off the view-model and pauses once. Sized as a real, felt hold.
 */
export const RECKONING_TURN_BEAT_MS = 1200;

// Speaker content-ids (hoisted so the repeated literals don't trip the
// no-duplicate-string lint, mirroring `content/scenes/ch1`).
const SALLOW = "sallow";
const WREN = "wren";
const SABLE = "sable";

/** Node ids of the set-piece's linear beats (hoisted for the same lint reason). */
const N_SALLOW_STEPS = "sallow-steps";
const N_PARTY_FAILS = "party-fails";
const N_OVERLOAD = "sallow-overloads";
const N_SCATTER = "the-party-scatters";
const N_SABLE_TAKEN = "sable-taken";
const N_HARD_CUT = "hard-cut";

/**
 * The Reckoning set-piece script: one linear scene walking Sallow stepping from the
 * background → the party's failure → the corpse-reactor overload → the
 * {@link RECKONING_TURN_NODE_ID world turning to Ashfall} (the quiet beat) → the party
 * scattering → Sable taken → the hard cut where color and music drain (the terminal
 * beat that hands off to Act II). The terminal node omits `next` and the scene omits
 * `nextScene` (the narrative ends here and Act II Ashfall begins) — under
 * `exactOptionalPropertyTypes`, those keys are absent, not `undefined`.
 */
export const RECKONING_SCRIPT: Readonly<Record<string, SceneDef>> = {
  [RECKONING_SCENE_ID]: {
    id: RECKONING_SCENE_ID,
    nodes: [
      {
        id: N_SALLOW_STEPS,
        speaker: SALLOW,
        text: "You ran very hard to reach a door I have already opened. Courteous of you to witness it. Do stay.",
        next: N_PARTY_FAILS,
      },
      {
        id: N_PARTY_FAILS,
        speaker: WREN,
        text: "The frame-knights fold on us. Halcyon's down, Tobi's cut off — we're not stopping this. We were never going to stop this.",
        next: N_OVERLOAD,
      },
      {
        id: N_OVERLOAD,
        speaker: SALLOW,
        text: "The first Sundering was an accident of greed. This one is a correction. (He lays a hand to Aurel's corpse-reactor, and it begins to sing wrong.)",
        next: RECKONING_TURN_NODE_ID,
      },
      {
        id: RECKONING_TURN_NODE_ID,
        speaker: WREN,
        text: "The light goes out of everything at once. Lower Vanta, the whole Crown above it — rendered to ash in a breath. The color drains from the world; the Choir's song thins to nothing.",
        // The deliberate quiet beat (#114): the world tipping into Ashfall holds
        // before it can be advanced, so the hard cut lands.
        beatMs: RECKONING_TURN_BEAT_MS,
        next: N_SCATTER,
      },
      {
        id: N_SCATTER,
        speaker: WREN,
        text: "The blast throws us apart — scattered and broken across a Reach that isn't the Reach anymore. Alone. That's the word now. Alone.",
        next: N_SABLE_TAKEN,
      },
      {
        id: N_SABLE_TAKEN,
        speaker: SABLE,
        text: "(her voice, already far away) Wren — don't come after me. Please. He needs me to finish it — (and then she is gone, taken with him).",
        portrait: SABLE,
        next: N_HARD_CUT,
      },
      {
        id: N_HARD_CUT,
        speaker: WREN,
        text: "Ashfall. No music. No color. Just the grey, and the long walk to find whoever's left. This is where the mourning starts.",
        portrait: WREN,
      },
    ],
  },
};
