/**
 * The pure save → run-state projection the Title's **Continue** entry uses (#226):
 * rebuild a live {@link RunState} from a persisted {@link CurrentSave} so the player
 * drops back into the Field with the run they saved — the shared grist wallet, the
 * bench-grown build (equipped shards + stat augments), the spell-learning progression,
 * and the party roster restored. Zero Phaser, no I/O — a total function of the save,
 * unit-tested headless — so the Title scene stays a thin adapter (load the save, project
 * it, seed the registry, start the Field). The inverse (run → save) is written piecemeal
 * by the beats that persist; this is the read side Continue needs.
 *
 * Scope: it restores the tangible, cross-scene run progression a fresh Field session
 * carries and renders (wallet, build, learning, roster). The learning progression is
 * rehydrated from the save's `learned` / `learning` fields (#264) so the Bench never
 * shows an equipped shard whose learning has silently reset — the two labels derive from
 * the same restored state and always agree. It still deliberately starts the descent
 * fresh (Room A) and does not re-derive an in-flight field *position* — resuming an exact
 * mid-descent field cursor is a separate concern; Continue's contract is "your run, back
 * in the Field".
 * @module logic/save-run
 */
import { BoundIds, type BoundId } from "../content/bounds";
import { PartyMemberIds, type PartyMemberId } from "../content/party";
import { newWallet } from "./grist";
import { learningStateFromPersisted } from "./spell-learning";
import { newRunState, type RunState } from "./run-state";
import { type CurrentSave } from "./save";

/** The set of valid {@link BoundId}s, for filtering an untrusted save's shard ids. */
const BOUND_IDS: ReadonlySet<string> = new Set(Object.values(BoundIds));

/** The set of valid {@link PartyMemberId}s, for filtering a save's roster ids. */
const PARTY_IDS: ReadonlySet<string> = new Set(Object.values(PartyMemberIds));

/**
 * Keep only the recognized {@link BoundId}s from a persisted equipped-shard list
 * (a foreign or corrupt id is dropped rather than trusted), preserving order.
 * @param ids - The persisted equipped-shard ids.
 * @returns The equipped shards as typed {@link BoundId}s.
 */
function toEquippedShards(ids: readonly string[]): readonly BoundId[] {
  return ids.filter((id): id is BoundId => BOUND_IDS.has(id));
}

/**
 * Project the persisted party into the run roster: keep the recognized
 * {@link PartyMemberId}s in join order, falling back to a fresh run's starting party
 * when the save carries none the runtime knows (so Continue never lands with an empty
 * roster).
 * @param party - The persisted party members.
 * @returns The active roster as typed {@link PartyMemberId}s.
 */
function toRoster(
  party: readonly { readonly id: string }[]
): readonly PartyMemberId[] {
  const roster = party
    .map(member => member.id)
    .filter((id): id is PartyMemberId => PARTY_IDS.has(id));
  return roster.length > 0 ? roster : newRunState().roster;
}

/**
 * Rebuild a live {@link RunState} from a persisted save (#226) so **Continue** drops
 * the player into the Field with their saved run: the shared grist wallet at the saved
 * balance, the bench build (equipped shards + stat augments), the spell-learning
 * progression (#264), and the party roster, all restored. Pure and total — a
 * corrupt/foreign shard, spell, or roster id is filtered, so a bad save projects to a
 * safe run rather than throwing.
 * @param save - The persisted current-version save to project.
 * @returns The run state to seed the registry with before starting the Field.
 */
export function runStateFromSave(save: CurrentSave): RunState {
  return {
    wallet: newWallet(save.grist),
    shards: [],
    pendingChoiceShard: null,
    equippedShards: toEquippedShards(save.build.equippedShards),
    learning: learningStateFromPersisted(save.learned, save.learning),
    statBonuses: save.build.statBonuses,
    roster: toRoster(save.party),
  };
}
