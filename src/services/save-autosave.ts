/**
 * The single **save-mutation choke point** every read-modify-write autosave in the game
 * serializes through — the one place a `load → transform → save` cycle against the shared
 * {@link CurrentSave} is allowed to run (#245). Before this, each write site (the run
 * economy, the region-progress cursor, the world-turn flip, the narrative flags, the
 * onboarding-seen flags) owned its *own* independent chain, so two writes fired in quick
 * succession — the exact shape of a region battle win, which credits grist AND advances
 * the region cursor in the same beat — each loaded the same base save and the slower one
 * landed last, clobbering the newer economy with a stale snapshot. That is why a region
 * clear persisted (Upper Vanta COMPLETE, the world turned to Ashfall) while the Grist it
 * earned rolled back to the pre-travel value: the region-progress write, having loaded
 * *before* the economy write committed, wrote the old wallet balance back over it.
 *
 * Routing every read-modify-write save through this ONE serial queue makes that
 * lost-update race structurally impossible: each mutation loads the freshest bytes the
 * prior write committed and last-write-wins is correct *per field*, because each mutator
 * only replaces the fields it owns and preserves the rest verbatim (the pure
 * `foldRunEconomy` / `foldSceneProgress` projections). A future write path can no longer
 * miss the seam — the only way to persist is to enqueue here.
 *
 * The queue is best-effort and total, mirroring the fail-safe I/O the individual
 * autosaves already were: a storage failure in one mutation is swallowed so it can never
 * reject the chain and wedge the writes behind it, and the live registry still holds the
 * un-persisted state for the rest of the session.
 * @module services/save-autosave
 */
import { type CurrentSave } from "../logic/save";
import { saveService } from "./save-service";

/**
 * A pure projection of one save into the next: replace the fields this write owns and
 * preserve every other field verbatim. Given the *freshest* save the queue loads (the
 * prior write's committed bytes), so a mutator never operates on a stale snapshot.
 */
type SaveMutation = (save: CurrentSave) => CurrentSave;

/**
 * The single shared serial save-autosave queue. Every read-modify-write against the
 * persisted {@link CurrentSave} chains onto the prior one so the `load → mutate → save`
 * cycles never interleave — the region counterpart of the per-writer queues it replaces,
 * now unified so cross-writer races (economy vs region vs world-turn) are impossible.
 */
class SaveAutosave {
  /** The tail of the serialized write chain — awaited before the next mutation starts. */
  #chain: Promise<void> = Promise.resolve();

  /**
   * Queue a save mutation behind any in-flight ones. The mutation runs a single
   * `load → mutate → save` cycle once every write ahead of it has been attempted, so it
   * always folds into the freshest committed save and its own write is the newest.
   * @param mutate - The pure projection of the loaded save into the save to persist.
   * @returns A promise that resolves once this write (after those ahead of it) is attempted.
   */
  mutate(mutate: SaveMutation): Promise<void> {
    this.#chain = this.#chain.then(() => SaveAutosave.#run(mutate));
    return this.#chain;
  }

  /**
   * The single load→mutate→save cycle. Total — every failure path is swallowed so the
   * chain can never reject and wedge the mutations queued behind it.
   * @param mutate - The pure projection to apply to the loaded save.
   * @returns A promise that resolves once the write is attempted (never rejects).
   */
  static async #run(mutate: SaveMutation): Promise<void> {
    try {
      const save = await saveService.load();
      await saveService.save(mutate(save));
    } catch {
      // Best-effort autosave — the live registry still holds the un-persisted state.
    }
  }
}

/** The single shared queue every read-modify-write save serializes through (#245). */
export const saveAutosave = new SaveAutosave();
