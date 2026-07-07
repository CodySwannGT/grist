/**
 * The finale set-piece **script** at Aurel's heart (#244, composing #142) — the authored
 * payoff the World Map's ★ Aurel's Heart node now enters: the confrontation with **Mr.
 * Sallow** the Renderer, the **Choir's Song heard whole** for the first time, and the
 * commitment to one of the reachable ending paths (`wiki/narrative/main-quest.md` Ch.10;
 * `story.md` "Endings"; `themes-and-tone.md`).
 *
 * Pure, Phaser-free, JSON-round-trippable DATA consuming the {@link SceneDef} model
 * verbatim — the same content-as-data idiom as `content/scenes/reckoning` / `ch1` /
 * `side-mill`. The reachability + choice *rules* live in `logic/narrative/finale` +
 * `endings` (imported here for the ending ids, so the played logic and the authored
 * script agree on one source of truth); this module owns only the *content*: the
 * confrontation beats, the per-ending epilogue, and the terminal **THE GRIST** card.
 *
 * The finale is a *branch-per-standing* script: {@link buildFinaleScript} assembles the
 * table for exactly the endings a run's standing unlocked (a neutral run sees only the
 * always-available "Finish the Sundering"; a merciful, fully-gathered run sees all four),
 * so which choices the fork offers diverges by who the party became — the FFVI tradition
 * the ending gates encode. Each chosen ending crosses to its short epilogue, then to the
 * shared final card, whose terminal node hands the run back to the Title.
 *
 * Voice is faithful to `wiki/narrative/characters.md` (Sallow: courteous, total, already
 * moving; Wren: wry, cause-allergic, grief under jokes; Sable: gentle) and the Ch.10
 * beats. Full choreography is deferred to authoring time (decision 0003); this is the
 * played beat sheet.
 * @module content/scenes/finale
 */
import {
  EndingIds,
  type DialogueChoice,
  type DialogueNode,
  type EndingId,
  type SceneDef,
} from "../../logic/narrative";

/** The id of the finale entry scene — the confrontation walk into the ending fork. */
export const FINALE_SCENE_ID = "finale-aurels-heart";

/** The id of the fork node where the reachable ending-choice is offered. */
export const FINALE_CHOICE_NODE_ID = "finale-choice";

/** The id of the shared terminal card scene ("THE GRIST") every ending lands on. */
export const FINALE_CARD_SCENE_ID = "finale-the-grist";

/**
 * The persisted scene-flag key the committed ending is recorded under (#142's choice,
 * folded through to the save so the run remembers how it ended). Read by an e2e / a
 * later credits surface; written by the Finale scene the instant an ending is chosen.
 */
export const FINALE_CHOSEN_ENDING_FLAG = "finale:chosen-ending";

// Speaker content-ids (hoisted so the repeated literals don't trip the
// no-duplicate-string lint, mirroring `content/scenes/reckoning`).
const SALLOW = "sallow";
const WREN = "wren";
const SABLE = "sable";

// Confrontation node ids (hoisted for the same lint reason).
const N_ARRIVE = "finale-arrive";
const N_SALLOW = "finale-sallow";
const N_SABLE = "finale-sable";
const N_EPILOGUE = "finale-epilogue";
const N_CARD = "finale-card";

/**
 * The scene id an ending's epilogue is authored under — one short scene per ending path,
 * addressed by ending id so a choice's `to` crosses straight to it. Pure.
 * @param id - The ending id.
 * @returns The epilogue scene id for that ending.
 */
export function finaleEndingSceneId(id: EndingId): string {
  return `finale-ending-${id}`;
}

/**
 * Recover the ending id from an epilogue scene id (the inverse of
 * {@link finaleEndingSceneId}), or null when the scene id is not an ending epilogue — so
 * the Finale scene can tell, as the presenter crosses scenes, which ending was committed.
 * Pure.
 * @param sceneId - The presenter's current scene id.
 * @returns The ending id it belongs to, or null.
 */
export function endingIdFromSceneId(sceneId: string): EndingId | null {
  const match = Object.values(EndingIds).find(
    id => finaleEndingSceneId(id) === sceneId
  );
  return match ?? null;
}

/** One ending's authored content: the fork label the player picks and its epilogue line. */
interface FinaleEndingContent {
  /** The fork choice label the presenter renders (the player-facing ending name). */
  readonly label: string;
  /** The epilogue line the chosen ending plays before the final card. */
  readonly epilogue: string;
}

/**
 * The four endings' authored content (content-as-data), keyed by {@link EndingId}. The
 * labels are the player-facing ending names (`wiki/narrative/story.md` "Endings"); the
 * epilogues are the single closing beat each path plays. {@link buildFinaleScript} pulls
 * from here for exactly the reachable endings, so adding flavor is a data edit.
 */
export const FINALE_ENDINGS: Readonly<Record<EndingId, FinaleEndingContent>> = {
  [EndingIds.sunder]: {
    label: "Finish the Sundering — let the render take it all",
    epilogue:
      "You lay your hand beside his on the cold reactor. The Song breaks off mid-note. Oblivion is a kind of mercy, Sallow said — and the grey goes to nothing, quietly, forever.",
  },
  [EndingIds.wake]: {
    label: "Wake the god — restore the Weave",
    epilogue:
      "The gathered stand with you, and the Choir's Song swells whole through Aurel's ribs. The god's eye opens; the color floods back into the world like a tide. The age of wonders, woken from its wound.",
  },
  [EndingIds.thirdWay]: {
    label: "The third way — break the Houses, hand it to mortals",
    epilogue:
      "Neither wake nor end — you shatter the reactor's collars and let the Houses fall with it. No god, no Renderer. Just people, and the long, unowned work of what comes next. The time of mortals begins.",
  },
  [EndingIds.letDie]: {
    label: "Let it die — let Aurel finish, in peace",
    epilogue:
      "You take Sable's hand off the Song and hold it. You let the god finish the dying it was denied. The grey settles like snow, and in the hush there is — impossibly — something that feels like hope.",
  },
};

/**
 * The confrontation walk into the ending fork — the linear beats every finale plays
 * before the choice: arriving at Aurel's heart, Sallow's courteous certainty, Sable at
 * his side, and the Choir's Song heard whole. The final node is {@link FINALE_CHOICE_NODE_ID},
 * whose `choices` {@link buildFinaleScript} fills with the reachable endings.
 * @param choices - The reachable ending choices to offer at the fork.
 * @returns The confrontation scene's dialogue nodes.
 */
function confrontationNodes(
  choices: readonly DialogueChoice[]
): readonly DialogueNode[] {
  return [
    {
      id: N_ARRIVE,
      speaker: WREN,
      text: "The heart of Aurel. No walls, just grey going up forever, and the corpse-reactor at the center of it all, singing wrong. And him, waiting. Of course he waited.",
      next: N_SALLOW,
    },
    {
      id: N_SALLOW,
      speaker: SALLOW,
      text: "You came all this way to stand at the end of the world. Courteous. It is nearly finished — one last note, and the render is total. But you may set the note. I am, if nothing else, a fair accountant.",
      next: N_SABLE,
    },
    {
      id: N_SABLE,
      speaker: SABLE,
      text: "(her hand on the reactor, the Song pouring through her) Wren. I can hear all of it now — the whole Choir, every voice the Sundering ever took. It's so loud. Please. Choose for both of us.",
      portrait: SABLE,
      next: FINALE_CHOICE_NODE_ID,
    },
    {
      id: FINALE_CHOICE_NODE_ID,
      speaker: WREN,
      text: "The Choir's Song, whole for the first time — grief and wonder in one chord, loud enough to make the choice for you if you let it. So. What do we do with a dying god?",
      choices,
    },
  ];
}

/**
 * Assemble the finale script table for exactly the endings a run's standing unlocked
 * (`logic/narrative/endings` → `resolveReachableEndings`). The confrontation walks into
 * the fork, whose choices are the reachable endings in authored order (each crossing to
 * its epilogue scene); every epilogue crosses to the shared **THE GRIST** card, whose
 * terminal node ends the narrative (the Finale scene then hands off to the Title). Pure —
 * a total function of the reachable-ending list; the same list always builds the same
 * table.
 * @param reachableEndings - The reachable ending ids (from the run's standing).
 * @returns The finale scene-definition table keyed by scene id.
 */
export function buildFinaleScript(
  reachableEndings: readonly EndingId[]
): Readonly<Record<string, SceneDef>> {
  const choices = reachableEndings.map(id => ({
    id,
    label: FINALE_ENDINGS[id].label,
    to: finaleEndingSceneId(id),
  }));
  const epilogues = Object.fromEntries(
    reachableEndings.map(id => [
      finaleEndingSceneId(id),
      {
        id: finaleEndingSceneId(id),
        nodes: [
          { id: N_EPILOGUE, speaker: WREN, text: FINALE_ENDINGS[id].epilogue },
        ],
        nextScene: FINALE_CARD_SCENE_ID,
      } satisfies SceneDef,
    ])
  );
  return {
    [FINALE_SCENE_ID]: {
      id: FINALE_SCENE_ID,
      nodes: confrontationNodes(choices),
    },
    ...epilogues,
    [FINALE_CARD_SCENE_ID]: {
      id: FINALE_CARD_SCENE_ID,
      nodes: [
        {
          id: N_CARD,
          speaker: WREN,
          text: "However it ends, it ends the same way it began: with what the render leaves behind. THE GRIST. — the run ends —",
        },
      ],
    },
  };
}
