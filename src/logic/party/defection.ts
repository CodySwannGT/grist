/**
 * **Halcyon's Ch.4 defection + party expansion** (#146, PRD #43) — the pure, total,
 * idempotent reducer that recruits Halcyon into the active party roster, plus the
 * roster→persisted-party projection the save layer consumes. Content is authoritative
 * from `wiki/narrative/main-quest.md` (Ch.4 — "the truth cracks open … **Halcyon
 * defects**") and `wiki/narrative/characters.md` (the fallen knight / frame
 * specialist). Her authored stat block + signature kit live in `content/party.ts`
 * (`PARTY.halcyon`); this module owns *when* and *how* she joins.
 *
 * The defection mirrors the requiem-hall set-piece's soft-gate + idempotence pattern
 * exactly (`logic/region/requiem-hall.ts`, #145):
 *
 * - **Gated on the requiem truth.** She defects "after the requiem reveals the truth",
 *   so {@link applyHalcyonDefection} fires only when the passed requiem-hall session is
 *   reachable AND has reached its {@link RequiemHallPhases.truth} or
 *   {@link RequiemHallPhases.complete} beat. Firing earlier (a sealed/singing or a
 *   soft-gated, unreachable hall) is a NO-OP that returns the SAME object (structural
 *   sharing) — never an early or duplicate join. This mirrors `applyBattleResult`'s
 *   `!run.shards.includes(...)` guard and `equipShardAtBench`'s no-op idiom.
 * - **Idempotent.** Re-firing once Halcyon is in the roster returns the SAME object,
 *   so the beat can never duplicate her.
 *
 * {@link hashDefection} is the stable FNV-1a digest the determinism gate samples —
 * same roster ⇒ identical digest (the same FNV-1a fold with stable key order the
 * requiem-hall + combat hashes use). Pure: ZERO Phaser, no I/O, no `Math.random` /
 * `Date.now` — every output is a total function of its explicit inputs, so the join is
 * deterministic and unit-testable headless.
 * @module logic/party/defection
 */
import { PARTY, PartyMemberIds, type PartyMemberId } from "../../content/party";
import {
  RequiemHallPhases,
  type RequiemHallSession,
} from "../region/requiem-hall";
import { type RunState } from "../run-state";
import { type SavedPartyMember } from "../save/types";

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * Whether the requiem-hall set-piece has revealed its truth — the gate Halcyon's
 * defection keys on ("she defects after the requiem reveals the truth"). True only
 * when the hall is reachable (the Ch.4 soft-gate passed, #145) AND its beat has
 * reached {@link RequiemHallPhases.truth} or run on to
 * {@link RequiemHallPhases.complete}. A soft-gated (unreachable) or pre-truth
 * (sealed / singing) session is not yet a trigger. Pure.
 * @param requiem - The requiem-hall session to inspect.
 * @returns True once the requiem has revealed the truth (the defection trigger).
 */
function isDefectionTriggered(requiem: RequiemHallSession): boolean {
  return (
    requiem.reachable &&
    (requiem.phase === RequiemHallPhases.truth ||
      requiem.phase === RequiemHallPhases.complete)
  );
}

/**
 * Whether Halcyon is already in the run's active roster — the idempotence + read
 * predicate. A thin reader so a consumer can branch on "has she joined?" without
 * scanning the roster by hand. Pure.
 * @param run - The run to inspect.
 * @returns True when Halcyon is on the roster.
 */
export function isHalcyonInParty(run: RunState): boolean {
  return run.roster.includes(PartyMemberIds.halcyon);
}

/**
 * Fold Halcyon's Ch.4 defection into the run — append her to the active roster once
 * the requiem has revealed its truth (AC scenario 1). A NO-OP that returns the SAME
 * object when the trigger has not fired (a soft-gated or pre-truth requiem) or when
 * she is already in the party (idempotent re-fire) — mirroring `applyBattleResult`'s
 * already-owned guard, so the beat can never join her early or twice. On a real join
 * only {@link RunState.roster} grows (her tail-append in join order); every other run
 * field is shared by reference. Pure — returns fresh state, mutates nothing.
 * @param run - The current run state (never mutated).
 * @param requiem - The requiem-hall session gating the defection.
 * @returns The run with Halcyon recruited, or the same object when it is a no-op.
 */
export function applyHalcyonDefection(
  run: RunState,
  requiem: RequiemHallSession
): RunState {
  if (!isDefectionTriggered(requiem) || isHalcyonInParty(run)) {
    return run;
  }
  return { ...run, roster: [...run.roster, PartyMemberIds.halcyon] };
}

/**
 * Project an active roster into the persisted `SaveDataV2.party` shape (#146) — the
 * roster→{@link SavedPartyMember} map the save layer writes. Each roster id resolves
 * to its `{ id, level }` from the {@link PARTY} table (the member's full stat block +
 * signature kit are restored by id on load, never embedded in the save). A member's
 * starting `shard` (and its carry mode) is included only when the table declares one;
 * Halcyon (and Tobi) carry none, so their persisted entry has neither. Pure — a total
 * map over the roster, reading nothing ambient.
 * @param roster - The active party roster, in join order.
 * @returns The persisted party members, one per roster id, in order.
 */
export function rosterToSavedParty(
  roster: readonly PartyMemberId[]
): readonly SavedPartyMember[] {
  return roster.map(id => {
    const member = PARTY[id];
    return {
      id: member.id,
      level: member.level,
      // A starting shard persists with its carry mode (a unit, per the save schema);
      // a shard-less member (Tobi, Halcyon) persists neither. The defection slice
      // never equips Halcyon, so the carry mode is absent here.
      ...(member.shard !== undefined
        ? { shard: member.shard, shardMode: "wield" as const }
        : {}),
    };
  });
}

/**
 * A stable FNV-1a digest of the run's active roster — the determinism handle the
 * defection's verification samples. Folds the roster ids (in join order) into a
 * canonical string, then hashes it with the same FNV-1a fold + stable key order the
 * requiem-hall + combat digests use. Same roster ⇒ identical 8-hex digest; a join
 * changes it (the pre-join and post-join digests diverge). Pure: a total function of
 * its input.
 * @param run - The run whose roster to digest.
 * @returns An 8-char hex digest.
 */
export function hashDefection(run: RunState): string {
  const canonical = run.roster.join("|");
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}
