/**
 * The Act II reunion set-piece **scripts** (#273, composing #140) — the authored content
 * the World Map's reunion ("story") nodes now enter, closing the gap where selecting a
 * reunion travelled to its already-cleared anchor region and showed that region's stale
 * `region-cleared` summary instead of the reunion's own beat.
 *
 * Each reunion is a short, self-contained recruit scene (`wiki/design/quest-design.md` —
 * "each a self-contained story, each missable; who you find shapes the finale"): the
 * environmental hook that surfaced it, the meeting, and the companion joining the cause.
 * Crossing into the **joined** scene is what the Reunion scene latches to write the
 * `reunion:<id>` completion flag through to the save — the exact forward-compatible seam
 * `logic/narrative/finale-standing` counts, so each recruit lifts the finale's reachable
 * endings ("the finale scales to the party you bring").
 *
 * Pure, Phaser-free, JSON-round-trippable DATA over the {@link SceneDef} model — the same
 * content-as-data idiom as `content/scenes/finale` / `reckoning` / `ch1`. Full
 * choreography is deferred to authoring time (decision 0003); this is the played beat
 * sheet. The recruit *rules* live in `logic/party/reunion`; this module owns only content.
 * @module content/scenes/reunion
 */
import { PARTY } from "../party";
import { REUNIONS, ReunionIds, type ReunionId } from "../reunions";
import { type SceneDef } from "../../logic/narrative";

/** Wren narrates the reunion beats (the protagonist voice, as in the finale). */
const WREN = "wren";

/**
 * The scene-id of a reunion's meeting walk (entered when the node is selected). Pure.
 * @param id - The reunion id.
 * @returns The meeting scene id.
 */
export function reunionMeetSceneId(id: ReunionId): string {
  return `reunion-${id}`;
}

/**
 * The scene-id of a reunion's terminal "joined" beat (the recruit is committed here). Pure.
 * @param id - The reunion id.
 * @returns The joined scene id.
 */
export function reunionJoinedSceneId(id: ReunionId): string {
  return `reunion-${id}-joined`;
}

/**
 * The persisted scene-flag key a completed reunion writes (`reunion:<id>`) — the same
 * namespace {@link import("../../logic/party/reunion").reunionStatusFlags} uses and
 * `finale-standing` counts. The Reunion scene writes it truthy the instant the recruit
 * commits, so the finale's standing tracks who the run reassembled. Pure.
 * @param id - The reunion id.
 * @returns The completion flag key.
 */
export function reunionCompleteFlag(id: ReunionId): string {
  return `reunion:${id}`;
}

/**
 * Recover the reunion id from a joined-scene id (the inverse of
 * {@link reunionJoinedSceneId}), or null when the scene id is not a reunion epilogue — so
 * the Reunion scene can tell, as the presenter crosses scenes, that the recruit committed.
 * Pure.
 * @param sceneId - The presenter's current scene id.
 * @returns The reunion id it belongs to, or null.
 */
export function reunionIdFromJoinedSceneId(sceneId: string): ReunionId | null {
  const match = Object.values(ReunionIds).find(
    id => reunionJoinedSceneId(id) === sceneId
  );
  return match ?? null;
}

/** One reunion's authored beats: the meeting line and the moment the companion joins. */
interface ReunionContent {
  /** The meeting beat — Wren finds the companion at the reunion's hook. */
  readonly meet: string;
  /** The join beat — the companion commits to the cause (the terminal recruit line). */
  readonly join: string;
}

/**
 * The four reunions' authored content (content-as-data), keyed by {@link ReunionId}. The
 * meeting + join beats are faithful to each companion's voice (`wiki/narrative`); the hook
 * is pulled from the catalog so the environmental beat and the recruit agree on one source.
 * Adding flavor is a data edit here.
 */
const REUNION_CONTENT: Readonly<Record<ReunionId, ReunionContent>> = {
  [ReunionIds.quietus]: {
    meet: "The screen wakes as you pass — a dead House-Quill vault, and something behind the glass that still knows your name. Not a ghost. A person, saved to the grey and left to drown with the servers.",
    join: 'Quietus steps out of the static, whole again. "You came back for a rumor. I can work with that." One of the lost, found — Quietus joins your cause.',
  },
  [ReunionIds.asch]: {
    meet: "Smoke with no grist-glow rises from a shuttered enclave in the fen. Inside, a man who burned his own shard rather than render one more soul stands over a cold hearth, waiting to be argued with.",
    join: 'Brother Asch banks the fire and shoulders his staff. "If you mean to end the render, I will carry water for that." One of the lost, found — Brother Asch joins your cause.',
  },
  [ReunionIds.cal]: {
    meet: "A rigged card game in a Holtspire tavern is one player short. The dealer — a disowned Quill pilot betting her airship on the long odds — deals you in without looking up.",
    join: "Calliope Quill sweeps the pot and grins. \"World's ending, the odds are terrible, and I fly the only ship that'll reach it. Deal me in.\" One of the lost, found — Calliope joins your cause.",
  },
  [ReunionIds.shrike]: {
    meet: "A hound waits by a fresh contract nailed to a marchland post. Its handler works for whoever pays — and for the first time the contract on offer is one worth taking for free.",
    join: 'The Shrike tears the contract down and whistles the hound to heel. "No fee. Just this once." One of the lost, found — the Shrike joins your cause.',
  },
};

/**
 * Assemble a reunion's script table: the environmental hook (from the catalog) → the
 * meeting → the terminal **joined** beat where the companion is recruited. The meet scene
 * crosses (`nextScene`) to the joined scene, whose single node is terminal (the Reunion
 * scene hands off to the World Map once it is passed). Pure — a total function of the
 * reunion id; the same id always builds the same table.
 * @param id - The reunion to build the script for.
 * @returns The reunion scene-definition table keyed by scene id.
 */
export function buildReunionScript(
  id: ReunionId
): Readonly<Record<string, SceneDef>> {
  const reunion = REUNIONS[id];
  const content = REUNION_CONTENT[id];
  const companion = PARTY[reunion.companion].name;
  return {
    [reunionMeetSceneId(id)]: {
      id: reunionMeetSceneId(id),
      nodes: [
        {
          id: `${id}-hook`,
          speaker: WREN,
          text: `${reunion.name}. ${reunion.hook}`,
          next: `${id}-meet`,
        },
        {
          id: `${id}-meet`,
          speaker: WREN,
          text: content.meet,
        },
      ],
      nextScene: reunionJoinedSceneId(id),
    },
    [reunionJoinedSceneId(id)]: {
      id: reunionJoinedSceneId(id),
      nodes: [
        {
          id: `${id}-join`,
          speaker: WREN,
          text: `${content.join} (${companion} stands with you now — the finale will remember who you found.)`,
        },
      ],
    },
  };
}
