/**
 * The verification bridge's build cell (#116) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the save-reload e2e can prove the persisted character
 * build's growth is *actually fielded by a later battle*, not merely round-tripped
 * through IndexedDB. It is the battle-side counterpart of the
 * {@link import("./run-state-cell").RunStateCell}: where that surfaces the run's
 * choice/ledger/learning/wallet, this one folds the persisted
 * {@link import("../logic/save/types").SavedBuild build} (bench stat augments +
 * equipped shards) into a **live battle snapshot** via the real combat engine.
 *
 * The cell composes shipped pieces and holds the adopted {@link SavedBuild}; all
 * rules live in `logic`: the pure {@link applyStatBonuses} folds the build's augments
 * onto each party member's base stats, and the deterministic
 * {@link import("../logic/combat").startBattle} engine fields them — the same engine
 * the live {@link import("../game/battle-runner").BattleRunner} drives. So a snapshot
 * is a genuine battle the grown build entered: a regression where reload preserves the
 * build in storage but battle hydration ignores those bonuses would surface here as a
 * combatant whose SPD lost the augment, failing the e2e.
 *
 * Seeded by the persistence path: `__VERIFY__.save` / `loadSave` {@link BuildCell.adopt
 * adopts} the very {@link CurrentSave} the e2e persists/restores, so the build the
 * snapshot fields is exactly the one that survived the reload. Extracted so the bridge
 * stays under its line budget. Zero Phaser, no I/O, no RNG of its own.
 * @module uat/build-cell
 */
import {
  ENCOUNTERS,
  EncounterIds,
  PARTY,
  type EncounterDef,
  type PartyMemberDef,
} from "../content";
import { startBattle } from "../logic/combat";
import { type Stats } from "../logic/combat/types";
import { applyStatBonuses } from "../logic/build";
import { type CurrentSave } from "../logic/save";
import { type SavedBuild } from "../logic/save/types";

/** A fixed seed so the cell's projected battle is reproducible across snapshots. */
const BUILD_BATTLE_SEED = 0x5b1d;
/** The fielded party lineup (Wren front), matching the live Battle scene's lineup. */
const BUILD_LINEUP: readonly PartyMemberDef[] = [PARTY.wren, PARTY.tobi];
/** A stable shipped encounter to field the projected battle against. */
const BUILD_ENCOUNTER: EncounterDef = ENCOUNTERS[EncounterIds.theDrip];
/** The empty (un-grown) build a fresh boot / cleared save fields. */
const EMPTY_BUILD: SavedBuild = { statBonuses: {}, equippedShards: [] };

/**
 * A read-only snapshot of one party combatant as a battle fields it — the content id
 * it was built from and its **effective** stat block (base stats with the persisted
 * build's augments folded in). The e2e asserts the grown axis (e.g. SPD) here.
 */
export interface VerifyBuildBattleMember {
  /** The content id the combatant was built from (e.g. `"wren"`). */
  readonly ref: string;
  /** The effective in-battle stats: base stats + the build's persisted augments. */
  readonly stats: Stats;
}

/**
 * A read-only, scene-agnostic snapshot of the persisted build *and* the live battle
 * it fields. `statBonuses`/`equippedShards` echo the adopted build (the stored
 * growth); `battleParty` is the real {@link startBattle} party with those augments
 * applied — the proof the growth carries into a later battle, not just into storage.
 */
export interface VerifyBuildState {
  /** The persisted bench stat augments the build grew (a partial stat delta). */
  readonly statBonuses: Partial<Stats>;
  /** The persisted equipped shards, by id, in equip order. */
  readonly equippedShards: readonly string[];
  /** The party as the real engine fields it, with the build's augments applied. */
  readonly battleParty: readonly VerifyBuildBattleMember[];
}

/**
 * The bridge-held build cell: adopt a {@link CurrentSave} and read its persisted build
 * projected into a live battle (party combatants carrying the grown stats) as one
 * scene-agnostic {@link VerifyBuildState} snapshot. Holds the empty build until a save
 * is adopted, so a fresh boot fields the base party (no fabricated growth).
 */
export class BuildCell {
  #build: SavedBuild = EMPTY_BUILD;

  /**
   * Adopt a {@link CurrentSave} into the cell — the seam the persistence path uses so
   * the build the e2e persists (and restores on reload) becomes the build the next
   * snapshot fields. A later adopt overwrites the held build. Pure: stores the build.
   * @param save - The save whose persisted build the cell holds.
   * @returns void
   */
  adopt(save: CurrentSave): void {
    this.#build = save.build;
  }

  /**
   * Clear the held build back to empty — the seam the persistence path uses on a
   * `clearSave` so a reset fields the base party (matching a cleared save) rather than
   * a stale grown build. Pure: drops the held build.
   * @returns void
   */
  reset(): void {
    this.#build = EMPTY_BUILD;
  }

  /**
   * Project the held build into a live battle and snapshot it: fold the persisted
   * stat augments onto each lineup member's base stats via the pure
   * {@link applyStatBonuses}, field them through the real deterministic
   * {@link startBattle} engine, and read back the party combatants' effective stats.
   * The grown axis is observable on `battleParty`, proving the build carries into a
   * later battle.
   * @returns The build + projected-battle snapshot.
   */
  snapshot(): VerifyBuildState {
    const build = this.#build;
    const fielded = BUILD_LINEUP.map(member => ({
      ...member,
      baseStats: applyStatBonuses(member.baseStats, build.statBonuses),
    }));
    const state = startBattle(fielded, BUILD_ENCOUNTER, BUILD_BATTLE_SEED);
    return {
      statBonuses: build.statBonuses,
      equippedShards: build.equippedShards,
      battleParty: state.party.map(combatant => ({
        ref: combatant.ref,
        stats: combatant.stats,
      })),
    };
  }
}
