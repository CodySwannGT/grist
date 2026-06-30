/**
 * Wren's first side-story beat — **"What the mill took"** (#111, Story #98, PRD #42
 * FR5 / AC7). The discoverable narrative beat traces Lira's rendering one step up
 * the chain and surfaces a **render-or-not** moral choice: the player either
 * *renders* (spends — the corruption-cost path the mill walked when it rendered
 * Wren's sister) or *spares* (refuses to render — the safe path Wren's arc earns,
 * "the sister he couldn't save becomes the reason he won't let anyone be spent").
 *
 * This module owns the beat's **choice logic**, not its dialogue (the scene data is
 * `content/scenes/side-mill`). It owns NO new resolution rules: it composes the
 * proven PD-3.0 free-vs-wield kit (`logic/free-vs-wield` — #69/#75) so the choice
 * folds the **persisted** {@link MoralLedger}, the only moral tally carried in
 * `SaveDataV2` and therefore the only one that survives a save/reload (the binding
 * AC). The narrative `NarrativeState.flags` ledger renders the beat but is NOT
 * serialized (pending #116), so the *persistence* assertion rests here, on the
 * `MoralLedger` `resolveChoice` folds — never on a narrative flag.
 *
 * The moral mapping (binding, from `wiki/design/side-content.md` — "a contract that
 * pays double if you **render** the mark" — and `wiki/narrative/character-bios.md`
 * — Wren's sister "**rendered** to settle a family debt"):
 * - **render** → {@link ShardMode `wield`}: the corruption-cost carry — karma falls,
 *   corruption accrues. Rendering is the spend the franchise's moral economy
 *   "never blocks and always remembers".
 * - **spare** → {@link ShardMode `free`}: the safe, corruption-free attunement —
 *   karma rises. Refusing to render is the path that costs nothing but resolve.
 *
 * Pure: zero Phaser (FR9), no I/O, no RNG, no `Math.random` / `Date.now`. The same
 * ledger + decision always reproduces a deep-equal settled session, and the
 * projected {@link CurrentSave} ({@link millBeatSave}) round-trips through the real
 * `serialize`/`deserialize` — so the beat is deterministic and unit-testable
 * headless, mirroring `logic/region/bound-site`. Out of scope (later siblings):
 * tracing Lira further up the chain, the Ledger codex view (#99), and extending the
 * save schema for narrative flags (#116).
 * @module logic/side-story/mill
 */
import { BoundIds, type BoundId } from "../../content";
import {
  type MoralResolution,
  isResolved,
  resolveChoice,
} from "../free-vs-wield";
import { newRunState, type RunState } from "../run-state";
import { freshSave } from "../save";
import type {
  CurrentSave,
  MoralLedger,
  SavedChoice,
  ShardMode,
} from "../save/types";

/**
 * The player's render-or-not decision at the mill beat — the player-facing framing
 * of the underlying free-vs-wield fork. `render` is the corruption-cost spend;
 * `spare` refuses it. A distinct domain type (not raw {@link ShardMode}) so the
 * beat reads in the story's voice; {@link millDecisionVariant} maps it to the
 * persisted carry the ledger reducer folds.
 */
export type MillDecision = "render" | "spare";

/**
 * The Bound the mill beat sites its render-or-not choice on — the Marrow Bound, the
 * undercity power Wren grew up beside ("the mill"). Reused (not re-defined) from the
 * content table because its **Wield** corruption rate is strictly positive (0.1), so
 * the render branch accrues real corruption: render and spare are measurably
 * distinct, the divergence the persistence AC turns on.
 */
export const MILL_BEAT_SHARD: BoundId = BoundIds.marrowBound;

/**
 * A reached "What the mill took" beat, opened into a render-or-not choice — the unit
 * the `__VERIFY__` bridge reads and drives, mirroring {@link
 * import("../region/bound-site").BoundSiteSession}. Carries the sited shard, the
 * {@link RunState} that raised its pending choice, the committed {@link SavedChoice}
 * (unresolved until a decision is made), the folded persisted {@link MoralLedger},
 * and the corruption the rendered carry accrued. Plain serializable data —
 * immutable, JSON-round-trippable, no embedded behavior.
 */
export interface MillBeatSession {
  /** The Bound the beat's choice is sited on (the Marrow Bound). */
  readonly shard: BoundId;
  /** The run carrying the sited shard + (until settled) its pending choice. */
  readonly run: RunState;
  /** The committed resolution (`resolved: false` until a decision is made). */
  readonly choice: SavedChoice;
  /** The folded persisted moral tally after the decision (the supplied ledger until settled). */
  readonly ledger: MoralLedger;
  /** Corruption accrued by the chosen carry — 0 until settled / for spare, > 0 for render. */
  readonly corruptionAccrued: number;
}

/**
 * Map a render-or-not {@link MillDecision} to the persisted carry the free-vs-wield
 * ledger reducer folds: **render** is the corruption-cost spend ({@link ShardMode
 * `wield`}, karma−), **spare** refuses it ({@link ShardMode `free`}, karma+). The
 * single point the story's framing meets the persisted ledger semantics — so the
 * mapping is asserted once and the rest of the beat composes the proven kit. Pure.
 * @param decision - The player's render-or-not decision.
 * @returns The shard carry mode the persisted ledger folds.
 */
export function millDecisionVariant(decision: MillDecision): ShardMode {
  return decision === "render" ? "wield" : "free";
}

/**
 * Build the {@link RunState} the opened beat carries: the sited shard acquired and
 * its render-or-not (free-vs-wield) choice raised as pending — the trigger {@link
 * resolveChoice} clears on commit. A direct, RNG-free construction from the starting
 * run, mirroring `bound-site`'s `siteRun` (the beat itself surfaces the choice, not
 * a battle drop). Pure.
 * @param shard - The Bound the beat's choice is sited on.
 * @returns A run with the shard acquired and its choice pending.
 */
function beatRun(shard: BoundId): RunState {
  return {
    ...newRunState(),
    shards: [shard],
    pendingChoiceShard: shard,
  };
}

/**
 * Open Wren's "What the mill took" beat into an unsettled render-or-not choice:
 * acquire the sited shard and raise its free-vs-wield choice as pending, folding
 * into the supplied ledger on commit. A total function of its input — the beat is
 * the data shipped in {@link BOUNDS}; this never re-specifies the corruption rates.
 * Pure.
 * @param ledger - The moral ledger the beat folds into on commit (never mutated).
 * @returns The opened, unsettled mill-beat session.
 */
export function openMillBeat(ledger: MoralLedger): MillBeatSession {
  return {
    shard: MILL_BEAT_SHARD,
    run: beatRun(MILL_BEAT_SHARD),
    choice: { resolved: false },
    ledger,
    corruptionAccrued: 0,
  };
}

/**
 * Commit the player's render-or-not decision at the opened beat, folding it with the
 * *existing* {@link resolveChoice} reducer (#69/#75 — never re-spec'd): **render**
 * accrues corruption and lowers karma ({@link ShardMode `wield`}), **spare** raises
 * karma with no corruption ({@link ShardMode `free`}). The returned session carries
 * the persisted {@link SavedChoice} and folded {@link MoralLedger}, so the two
 * branches diverge measurably and survive a reload. Idempotent: a second decision
 * against a settled session is a no-op (the pending trigger was cleared), so the beat
 * can never re-count. Pure — returns a fresh session.
 * @param session - The opened (or already-settled) mill-beat session (never mutated).
 * @param decision - The player's render-or-not decision.
 * @returns The settled session (or the same logical state when already settled).
 */
export function chooseAtMill(
  session: MillBeatSession,
  decision: MillDecision
): MillBeatSession {
  const resolution: MoralResolution = resolveChoice(
    session.run,
    session.ledger,
    millDecisionVariant(decision)
  );
  // No-op once settled: resolveChoice returns the same run/ledger + an unresolved
  // choice when nothing is pending — preserve the already-committed choice rather
  // than overwriting it with the no-op's `{ resolved: false }` (mirrors bound-site).
  if (!isResolved(resolution)) {
    return session;
  }
  return {
    ...session,
    run: resolution.run,
    choice: resolution.choice,
    ledger: resolution.ledger,
    corruptionAccrued: resolution.corruptionAccrued,
  };
}

/**
 * Whether the beat's render-or-not choice has been committed (vs. still pending). A
 * thin reader over {@link MillBeatSession.choice} so a consumer (the bridge cell, a
 * test) can branch on "has the player decided?" without inspecting the persisted
 * shape. Pure.
 * @param session - The mill-beat session to inspect.
 * @returns True when a decision has been committed.
 */
export function isMillBeatSettled(session: MillBeatSession): boolean {
  return session.choice.resolved;
}

/**
 * Project a settled mill-beat session into the persisted {@link CurrentSave} the
 * save layer writes — the bridge's `save` driver persists this and a reload restores
 * it. Starts from a {@link freshSave} (so every schema axis is present and
 * round-trippable) and folds in only the beat's outcome: the resolved
 * {@link SavedChoice} and the folded {@link MoralLedger}. The render-or-not branch is
 * therefore carried by the **persisted** moral ledger — the field `runState()`
 * surfaces and the AC asserts survives save/reload — not by a (non-serialized)
 * narrative flag. Pure: returns a fresh save, mutating nothing.
 * @param session - The settled mill-beat session to persist.
 * @returns A complete current-version save carrying the beat's persisted choice + ledger.
 */
export function millBeatSave(session: MillBeatSession): CurrentSave {
  return {
    ...freshSave(),
    choice: session.choice,
    moralLedger: session.ledger,
  };
}
