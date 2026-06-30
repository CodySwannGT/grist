/**
 * The verification bridge's encounter-ladder cell (#108) — a tiny in-memory holder
 * the `__VERIFY__` bridge owns so the escalation e2e can read the Phase-3 escalating
 * ATB encounter ladder authored against the existing {@link EncounterDef} schema and
 * confirm, scene-agnostically on the live built game, that ">=4 distinct ATB
 * encounters are playable across the run" and that "difficulty escalates" — the two
 * halves of the #108 acceptance criteria.
 *
 * The cell only *reads* the shipped {@link ESCALATION_LADDER} and the pure
 * {@link encounterDifficulty} / {@link isStrictlyEscalating} helpers in
 * `content/encounters`; all of the escalation *semantics* live there (a total
 * function over the existing enemy stat blocks — no new combat engine, no combat-math
 * change), so the bridge never re-implements the ordering rule. It runs entirely on
 * the reused Phase-2 sim's data tables: every ladder entry is an existing
 * {@link ENCOUNTERS} row whose enemies are existing {@link ENEMIES}.
 *
 * Mirrors `uat/enemy-cell.ts` / `uat/region-cell.ts`: a small, independently readable
 * seam spread into the bridge through {@link import("./data-cell-api").DataCellApi}.
 * Zero Phaser, no I/O, no RNG — a total function of the static content tables.
 * @module uat/encounter-ladder-cell
 */
import {
  ENCOUNTERS,
  ENEMIES,
  ESCALATION_LADDER,
  encounterDifficulty,
  isStrictlyEscalating,
  type EncounterId,
} from "../content";

/** One rung of the escalation ladder: the encounter id, its lineup, and its score. */
export interface VerifyEncounterRung {
  /** The encounter id (an existing {@link EncounterId}). */
  readonly id: EncounterId;
  /** The encounter's enemy lineup (existing {@link ENEMIES} keys). */
  readonly enemies: readonly string[];
  /** The pure {@link encounterDifficulty} score for this encounter. */
  readonly difficulty: number;
}

/**
 * A read-only snapshot of the Phase-3 escalation ladder — the shape the escalation
 * e2e asserts on. `count` is the number of distinct encounters in the run;
 * `distinct` is whether every rung is unique (no repeat); `escalates` is the pure
 * {@link isStrictlyEscalating} verdict; `rungs` is the ordered per-encounter detail
 * (id + lineup + score) so the e2e can prove the scores strictly increase on the
 * live canvas; `enemiesResolved` is whether every rung's lineup is drawn from the
 * existing {@link ENEMIES} table (the "reuses the Phase-2 core, no parallel schema"
 * proof); `hash` is a stable digest of the ordered scores for the determinism gate.
 */
export interface VerifyEncounterLadderState {
  readonly count: number;
  readonly distinct: boolean;
  readonly escalates: boolean;
  readonly rungs: readonly VerifyEncounterRung[];
  readonly enemiesResolved: boolean;
  /** A stable digest of the ordered difficulty scores for the determinism gate. */
  readonly hash: string;
}

/**
 * Stable FNV-1a digest of the ladder's ordered difficulty scores — the encounter
 * analogue of the enemy-family / region state-hash. The same shipped ladder always
 * digests identically, so the e2e can assert reproducibility across a genuine reload
 * without a battle scene live. Pure: a total function of its input.
 * @param rungs - The ordered ladder rungs.
 * @returns An 8-char hex digest.
 */
function hashLadder(rungs: readonly VerifyEncounterRung[]): string {
  const canonical = JSON.stringify(
    rungs.map(rung => [rung.id, rung.difficulty])
  );
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 0x01000193),
    0x811c9dc5
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}

/**
 * The bridge-held encounter-ladder cell: read the shipped Phase-3 escalation ladder
 * as a snapshot (count + distinctness + strict-escalation verdict + per-rung scores).
 * Stateless beyond the shipped data — there is nothing to "load"; the ladder is the
 * authored {@link ESCALATION_LADDER}, so {@link snapshot} reads it directly. Pure.
 */
export class EncounterLadderCell {
  /**
   * A snapshot of the shipped escalation ladder resolved against the existing
   * content tables. Lets the escalation e2e assert, on the live built game, that the
   * run offers ≥4 distinct encounters whose difficulty strictly escalates and whose
   * lineups all resolve to existing enemies (the Phase-2-reuse proof). Pure — reads
   * only the static {@link ESCALATION_LADDER} / {@link ENCOUNTERS} / {@link ENEMIES}.
   * @returns The ladder snapshot.
   */
  snapshot(): VerifyEncounterLadderState {
    const rungs: readonly VerifyEncounterRung[] = ESCALATION_LADDER.map(id => {
      const def = ENCOUNTERS[id];
      return {
        id,
        enemies: [...def.enemies],
        difficulty: encounterDifficulty(def),
      };
    });
    const distinct =
      new Set(ESCALATION_LADDER).size === ESCALATION_LADDER.length;
    const enemiesResolved = rungs.every(rung =>
      rung.enemies.every(enemyId =>
        Object.prototype.hasOwnProperty.call(ENEMIES, enemyId)
      )
    );
    return {
      count: ESCALATION_LADDER.length,
      distinct,
      escalates: isStrictlyEscalating(ESCALATION_LADDER),
      rungs,
      enemiesResolved,
      hash: hashLadder(rungs),
    };
  }
}
