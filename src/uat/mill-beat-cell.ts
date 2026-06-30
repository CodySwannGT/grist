/**
 * The verification bridge's mill side-story cell (#111) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the "What the mill took" e2e can reach Wren's beat and
 * make the **render-or-not** choice scene-agnostically, the same way
 * {@link import("./bound-site-cell").BoundSiteCell} drives a region's Bound site. The
 * cell only *holds* the opened/settled {@link MillBeatSession} and reads it; all
 * render-or-not resolution *semantics* live in `logic/side-story/mill`, which composes
 * the PD-3.0 free-vs-wield kit — so the choice folds the **persisted**
 * {@link MoralLedger} the save layer writes (the only moral tally in `SaveDataV2`),
 * which is what the AC's "survives save/reload" rests on. The bridge never
 * re-implements the rules.
 *
 * Mirrors `uat/bound-site-cell.ts`: extracted so the bridge stays under its line
 * budget and the mill seam is independently readable. The *persistence-across-reload*
 * half of the AC rides the existing save path — the e2e persists the save the settled
 * choice projects ({@link millBeatSave}) and reloads — so this cell owns only the
 * in-memory choice surface, not storage. Zero Phaser, no I/O, no RNG.
 * @module uat/mill-beat-cell
 */
import { newMoralLedger } from "../logic/free-vs-wield";
import {
  type MillBeatSession,
  type MillDecision,
  chooseAtMill,
  isMillBeatSettled,
  millBeatSave,
  openMillBeat,
} from "../logic/side-story/mill";
import type { CurrentSave, SavedChoice } from "../logic/save/types";

/**
 * A read-only, scene-agnostic snapshot of Wren's mill beat — the shape the side-mill
 * e2e asserts on. Carries the sited shard, whether the render-or-not choice has been
 * committed, the committed carry variant (or null while pending), the corruption the
 * rendered carry accrued, and the folded **persisted** moral tally (karma + the
 * free/wield counts) — the values that diverge between render and spare and survive a
 * reload.
 */
export interface VerifyMillBeatState {
  /** The Bound the beat's render-or-not choice is sited on. */
  readonly shard: string;
  /** Whether the render-or-not choice has been committed. */
  readonly settled: boolean;
  /** The committed carry variant (`free`/`wield`), or null while pending. */
  readonly variant: SavedChoice["variant"] | null;
  /** Corruption accrued by the chosen carry — 0 while pending / for spare, > 0 for render. */
  readonly corruptionAccrued: number;
  /** Net karma after the choice (render lowers it, spare raises it). */
  readonly karma: number;
  /** How many resolutions chose the safe (spare → free) carry. */
  readonly freeChoices: number;
  /** How many resolutions chose the corruption-cost (render → wield) carry. */
  readonly wieldChoices: number;
}

/**
 * The bridge-held mill-beat cell: open Wren's "What the mill took" beat, commit the
 * render-or-not choice, then read the resulting session as one scene-agnostic
 * {@link VerifyMillBeatState} snapshot — and project the settled choice into the
 * {@link CurrentSave} the bridge's `save` path persists. `null` until the beat is
 * opened, so a stray read on a fresh boot cannot fabricate a beat.
 */
export class MillBeatCell {
  #session: MillBeatSession | null = null;

  /**
   * Open Wren's mill beat into an unsettled render-or-not choice — the "an agent
   * reached the side-story beat" verification action. Pure data through
   * `logic/side-story/mill` (no engine edit, no Phaser): the beat sites the Marrow
   * Bound and raises its free-vs-wield choice as pending, seeded from a neutral
   * ledger. Pure.
   * @returns void
   */
  open(): void {
    this.#session = openMillBeat(newMoralLedger());
  }

  /**
   * Commit the player's render-or-not decision at the opened beat (`render` /
   * `spare`), delegating the persisted-ledger fold to {@link chooseAtMill}.
   * Idempotent once settled (the logic no-ops a second choice); a no-op before the
   * beat is opened. Pure: replaces the held session with the settled one.
   * @param decision - The render-or-not decision the player committed to.
   * @returns void
   */
  choose(decision: MillDecision): void {
    if (this.#session !== null) {
      this.#session = chooseAtMill(this.#session, decision);
    }
  }

  /**
   * A snapshot of the opened/settled mill beat, or null before the beat has been
   * opened. Lets the side-mill e2e assert render vs spare diverge (variant + karma +
   * corruption) before persisting, and read the same values back after the reload.
   * @returns The mill-beat snapshot, or null.
   */
  snapshot(): VerifyMillBeatState | null {
    const session = this.#session;
    if (session === null) {
      return null;
    }
    return {
      shard: session.shard,
      settled: isMillBeatSettled(session),
      variant: session.choice.variant ?? null,
      corruptionAccrued: session.corruptionAccrued,
      karma: session.ledger.karma,
      freeChoices: session.ledger.freeChoices,
      wieldChoices: session.ledger.wieldChoices,
    };
  }

  /**
   * Project the settled mill-beat session into the {@link CurrentSave} the bridge's
   * `save` path persists — the seam the e2e uses to write the render-or-not outcome
   * to IndexedDB and reload it. The render-or-not branch is carried by the
   * **persisted** {@link MoralLedger} in this save, so the reload restores it and
   * `runState().moralLedger` surfaces it (the AC's persistence half). Falls back to a
   * fresh, neutral save when the beat is unopened, so the driver never throws.
   * @returns The current-version save carrying the beat's persisted choice + ledger.
   */
  toSave(): CurrentSave {
    return millBeatSave(this.#session ?? openMillBeat(newMoralLedger()));
  }
}
