/**
 * The pure **run-economy write-through** projection (#235): fold a live run's
 * earned economy — the shared grist {@link import("../grist").GristWallet} balance
 * and the bench-grown build (the equipped shards + the stat augments) — into a
 * {@link CurrentSave}, so the wallet and build a player earns *in play* persist into
 * the same `SaveDataV3.grist` / `SaveDataV3.build` fields the save already carries and
 * {@link import("../save-run").runStateFromSave Continue} already restores. The owner
 * decision: run economy must survive a reload, not reset to zero — the save layer's
 * economy autosave that was marked "(future)" is now wired through here.
 *
 * **No save-version bump.** SaveDataV3 already models `grist` and `build`
 * (the roster/scene-flags precedent, PRs #214/#224); this projection only writes those
 * existing fields from the live run, so a v3 save round-trips losslessly and no
 * migration is needed. Engine-free: no Phaser, no I/O, no RNG — the same
 * `(save, economy)` always yields the same next save and the result round-trips through
 * `JSON.stringify`, so it is unit-testable headless — the Phaser-free twin of the
 * `SaveService` write the Field/Bench scenes perform when the run economy commits.
 *
 * **Replace, not merge — the run is authoritative.** Unlike `foldSceneProgress`, whose
 * flags accumulate across many independent beats (so each write must merge OVER the
 * prior ledger), the run's live {@link RunState} carries the *complete* current economy:
 * the wallet balance is the whole balance, and the build is the whole build (a continued
 * run rehydrates its equipped shards + augments from the same save before play resumes,
 * so a later write never drops what an earlier session grew). So this projection sets
 * `grist` and `build` wholesale from the run — every *other* field the save holds
 * (scene progress, party, world-state, choice, moral ledger, the rng lineage) is
 * preserved verbatim by the spread, so the economy write never clobbers a narrative
 * beat's persisted flag or the determinism-critical rng state.
 *
 * **Structural, not nominal.** {@link RunEconomy} mirrors the economy axes of
 * `logic/run-state`'s `RunState` by shape (the wallet balance + `statBonuses` +
 * `equippedShards`), so a live run projects in without this pure-save layer taking an
 * import edge on `logic/run-state` — the same one-way "the run projects into the save"
 * discipline `foldSceneProgress`/`SavedBuild` already follow.
 * @module logic/save/run-economy
 */
import type { Stats } from "../combat/types";
import type { CurrentSave } from "./types";

/**
 * The live run economy a Field/Bench scene projects into the save: the shared grist
 * wallet balance, the permanent bench stat augments, and the equipped shards. Every
 * field is a plain, JSON-round-trippable primitive (or a record/array of them),
 * structurally a slice of `logic/run-state`'s `RunState`, so a live run passes in
 * without an import edge.
 */
export interface RunEconomy {
  /** The shared grist wallet balance (whole, non-negative). */
  readonly grist: number;
  /** The permanent stat augments bought at the bench (a partial {@link Stats} delta). */
  readonly statBonuses: Partial<Stats>;
  /** The shards equipped at the bench, by id, in equip order. */
  readonly equippedShards: readonly string[];
}

/**
 * Fold a run's {@link RunEconomy} into a save, returning the next {@link CurrentSave}
 * with its {@link CurrentSave.grist} balance and {@link CurrentSave.build} set from the
 * live run and every other field preserved verbatim. Mutates nothing (a fresh save with
 * a fresh `build`, its `statBonuses`/`equippedShards` copied so the save never aliases
 * the live run's arrays/objects). The run is authoritative for the economy, so the write
 * is a wholesale replace of `grist` + `build` — the scene progress, party, world-state,
 * choice, moral ledger, and rng lineage the save already holds survive untouched.
 * @param save - The save to fold into (never mutated).
 * @param economy - The live run's wallet balance + bench build.
 * @returns The next save carrying the restored-on-Continue run economy.
 */
export function foldRunEconomy(
  save: CurrentSave,
  economy: RunEconomy
): CurrentSave {
  return {
    ...save,
    grist: economy.grist,
    build: {
      statBonuses: { ...economy.statBonuses },
      equippedShards: [...economy.equippedShards],
    },
  };
}
