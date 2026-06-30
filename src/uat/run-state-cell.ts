/**
 * The verification bridge's run-state cell (#88) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the slice e2e (#89) can read the **free-vs-wield
 * choice + moralLedger/karma**, the **learning progress** (learned + in-progress
 * unlocks), and the **shared grist wallet** scene-agnostically, the same way the
 * {@link import("./world-state-cell").WorldStateCell} exposes the world-state flag.
 *
 * Like the world-state cell, this is seeded by the persistence path: `__VERIFY__`
 * `.save` {@link RunStateCell.adopt adopts} the very {@link CurrentSave} the e2e
 * persists, so the choice / ledger / learning the e2e saves are exactly the values
 * the bridge then surfaces — no separate live store, no re-derivation. The bridge
 * already exposes the *field* run surface (room / Wren position / wallet / shards
 * / pending choice) through the live Field view and the *bench* learning snapshot
 * through the Bench view; this cell adds the missing **scene-agnostic** read of
 * the *resolved* choice, the moral ledger, and the full learning progression that
 * the AC names ("read … the choice + moralLedger, and learning progress") without
 * requiring a battle / field / bench scene to be live.
 *
 * The cell only *holds* the adopted save sub-shapes ({@link SavedChoice},
 * {@link MoralLedger}, the learned/learning lists, and the grist balance) and
 * surfaces them as one read-only {@link VerifyRunState} snapshot (bundled like the
 * bridge's `field()` / `bench()` snapshots); it owns no rules — the resolution
 * semantics live in `logic/free-vs-wield` and the learning semantics in
 * `logic/spell-learning`, which the gameplay path folds into the save before it is
 * persisted. Extracted from `uat/bridge.ts` so the bridge stays under its line
 * budget and the run-state seam is independently readable, mirroring the
 * world-state and bench splits. Zero Phaser, no I/O, no RNG.
 * @module uat/run-state-cell
 */
import type {
  CurrentSave,
  MoralLedger,
  SavedChoice,
  SavedLearning,
} from "../logic/save/types";
import { type WalletCell } from "./wallet-cell";

/**
 * A read-only, scene-agnostic snapshot of the run's moral + growth + economy
 * state for assertions, lifted verbatim from the adopted save. Bundled like the
 * bridge's {@link import("./bench-view").VerifyBenchState} so the e2e reads the
 * whole choice + karma + learning + wallet surface in one call.
 */
export interface VerifyRunState {
  /**
   * The resolved free-vs-wield choice the run committed to — the shard variant the
   * player chose, or `{ resolved: false }` when none is committed (PRD #41 AC5).
   */
  readonly choice: SavedChoice;
  /** The running moral ledger: net karma + the free/wield tally (PRD #41 AC5). */
  readonly moralLedger: MoralLedger;
  /** Spells permanently learned (kept forever) (PRD #41 FR6). */
  readonly learned: readonly string[];
  /** Spells currently being learned, with their [0,1) unlock progress. */
  readonly learning: readonly SavedLearning[];
  /** The shared grist wallet balance (PRD #41 FR3 / FR7). */
  readonly grist: number;
}

/**
 * The bridge-held run-state cell: adopt a {@link CurrentSave} and read its choice
 * / moral ledger / learning / wallet sub-shapes as one scene-agnostic
 * {@link VerifyRunState} snapshot. `null` until a save has been adopted, so a read
 * on a fresh boot cannot fabricate a run state.
 */
export class RunStateCell {
  #save: CurrentSave | null = null;
  readonly #wallet: WalletCell;

  /**
   * Construct the run-state cell over the bridge's shared wallet. The cell reads its
   * grist balance from this injected {@link WalletCell} rather than from the raw
   * adopted save, so the balance `runState().grist` reports is the **same** live
   * wallet a fast-travel hop (#136) draws down — one shared wallet, not two.
   * @param wallet - The bridge's shared grist wallet cell.
   */
  constructor(wallet: WalletCell) {
    this.#wallet = wallet;
  }

  /**
   * Adopt a {@link CurrentSave} into the cell — the seam the persistence path uses
   * so the choice / ledger / learning / wallet the e2e persists become readable in
   * memory. The save's grist **seeds the shared wallet** here, so `snapshot().grist`
   * reflects the persisted balance and any later spend against it (e.g. a #136
   * fast-travel hop draws down this same wallet). A later adopt overwrites the held
   * payload and re-seeds the wallet. Pure: stores the reference + seeds the balance.
   * @param save - The save payload to hold.
   * @returns void
   */
  adopt(save: CurrentSave): void {
    this.#save = save;
    this.#wallet.adopt(save.grist);
  }

  /**
   * Clear the held save back to its pre-adoption (`null`) state — the seam the
   * persistence path uses on a `clearSave` so the in-memory run-state does not
   * survive a reset and disagree with storage. Pure: drops the held reference.
   * @returns void
   */
  reset(): void {
    this.#save = null;
  }

  /**
   * The bundled {@link VerifyRunState} snapshot (choice + moralLedger + learning +
   * grist wallet) from the adopted save, or null before one has been adopted.
   * @returns The run-state snapshot, or null.
   */
  snapshot(): VerifyRunState | null {
    const save = this.#save;
    if (save === null) {
      return null;
    }
    return {
      choice: save.choice,
      moralLedger: save.moralLedger,
      learned: save.learned,
      learning: save.learning,
      // The live shared wallet balance — the same wallet a fast-travel hop (#136)
      // draws down — not the raw (immutable) save number, so a spend is observable
      // here too. Seeded from the save's grist by the bridge on adopt.
      grist: this.#wallet.read(),
    };
  }
}
