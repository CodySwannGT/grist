/**
 * The pure **per-region Bound-site template** (#135, PRD #43 FR5 / AC7) — the
 * reusable framework that anchors a region's single Bound site and wires it through
 * the proven Phase-2 free-vs-wield kit (#69). Each region sites *exactly one* Bound
 * (the region's {@link RegionDef.boundSite}, a lone {@link BoundId} — the "exactly
 * one" cardinality is already type-enforced in `content/regions`); this template is
 * how that site becomes a *playable* choice without re-inventing the resolution per
 * region:
 *
 * - {@link openBoundSite} reads a region's `boundSite` from the content table
 *   ({@link BOUNDS}), surfaces its Free-vs-Wield variants, and opens an unsettled
 *   {@link BoundSiteSession} — a run with the sited shard acquired and its choice
 *   raised as pending (the trigger {@link resolveChoice} consumes). A region whose
 *   `boundSite` is not a defined shard **throws on open** — the template rejects a
 *   broken site rather than offering a phantom shard (mirrors `bootRegion`).
 * - {@link chooseAtBoundSite} folds the player's commitment with the *existing*
 *   `resolveChoice` reducer: *free* grants the weaker shard (karma+, no corruption),
 *   *wield* grants the stronger carry (accruing corruption, karma−). Free and wield
 *   therefore diverge measurably — the persisted {@link SavedChoice} + the folded
 *   {@link MoralLedger} the save layer writes, so the choice survives a reload.
 *   Settling is idempotent: a second choice against a settled session is a no-op
 *   (the pending trigger was cleared), so a site can never re-count.
 * - {@link hashBoundSite} is a stable FNV-1a digest of a session — the determinism
 *   handle the verification bridge samples so the same region + ledger + mode yields
 *   an identical progression.
 *
 * This module owns NO new resolution rules: it composes `content/regions` for the
 * sited shard, `content/bounds` for the variant corruption rates, `logic/run-state`
 * for the run shape that raises the pending choice, and `logic/free-vs-wield` for the
 * fold — never re-specifying the Phase-2 kit. Pure: zero Phaser (FR9), no I/O, no
 * RNG, no `Math.random` / `Date.now` — every output is a total function of its
 * explicit inputs, so the site is deterministic and unit-testable headless. The
 * `__VERIFY__` bridge cell (`uat/bound-site-cell`) consumes this; it re-implements
 * nothing.
 * @module logic/region/bound-site
 */
import {
  BOUNDS,
  type BoundId,
  type BoundVariants,
  type RegionDef,
} from "../../content";
import {
  type MoralResolution,
  isResolved,
  resolveChoice,
} from "../free-vs-wield";
import { newRunState, type RunState } from "../run-state";
import type { MoralLedger, SavedChoice, ShardMode } from "../save/types";

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

/**
 * A region's Bound site, opened into a playable free-vs-wield choice — the unit the
 * `__VERIFY__` bridge reads and drives. Carries the region id, the sited
 * {@link BoundId} (the region's lone `boundSite`), the Free/Wield variants offered
 * (read verbatim from the content table), the {@link RunState} that raised the
 * sited shard's pending choice, the committed {@link SavedChoice} (unresolved until
 * a choice is made), the folded {@link MoralLedger}, and the corruption the chosen
 * variant accrued. Immutable — the template returns fresh sessions and mutates
 * nothing.
 */
export interface BoundSiteSession {
  /** The region this site belongs to. */
  readonly regionId: string;
  /** The single Bound sited in this region (the region's `boundSite`). */
  readonly shard: BoundId;
  /** The Free/Wield variant pair offered, read from `content/bounds`. */
  readonly variants: BoundVariants;
  /** The run carrying the sited shard + (until settled) its pending choice. */
  readonly run: RunState;
  /** The committed resolution (`resolved: false` until a choice is made). */
  readonly choice: SavedChoice;
  /** The folded moral tally after this site's choice (the supplied ledger until settled). */
  readonly ledger: MoralLedger;
  /** Corruption accrued by the chosen variant — 0 until settled / for free, > 0 for wield. */
  readonly corruptionAccrued: number;
}

/**
 * Build the {@link RunState} a freshly-opened site carries: the sited shard
 * acquired and its free-vs-wield choice raised as pending (the trigger
 * {@link resolveChoice} clears on commit). A direct, RNG-free construction —
 * `applyBattleResult` is the *battle-drop* path to the same pending state; here the
 * site itself surfaces the choice, so the run is built from the starting run with
 * the shard sited. Pure.
 * @param shard - The Bound sited in the region.
 * @returns A run with the shard acquired and its choice pending.
 */
function siteRun(shard: BoundId): RunState {
  return {
    ...newRunState(),
    shards: [shard],
    pendingChoiceShard: shard,
  };
}

/**
 * Open a region's single Bound site into an unsettled free-vs-wield choice. Reads
 * the region's `boundSite` from {@link BOUNDS} (its Free/Wield variants come from the
 * content table — the template never re-specifies the corruption rates), acquires
 * the shard, and raises its choice as pending. A region whose `boundSite` is not a
 * defined shard **throws** — a broken site is rejected, not offered (AC: the site
 * is exactly the region's Bound). Pure: a total function of its inputs.
 * @param region - The region whose single Bound site is being anchored.
 * @param ledger - The moral ledger the site folds into on commit (never mutated).
 * @returns The opened, unsettled Bound-site session.
 * @throws Error when the region's `boundSite` is not a defined shard.
 */
export function openBoundSite(
  region: RegionDef,
  ledger: MoralLedger
): BoundSiteSession {
  const shard = region.boundSite;
  // A region may cage no Bound (`boundSite` undefined — upper Vanta, #128); opening a
  // Bound site on such a region is a caller error (its anchor is elsewhere — the Ch.5
  // keystone), so reject it explicitly rather than offering a phantom shard. Narrows
  // `shard` from `BoundId | undefined` to `BoundId` for the rest of the function.
  if (shard === undefined) {
    throw new Error(`region "${region.id}" cages no bound site to open`);
  }
  const def = BOUNDS[shard];
  if (def === undefined) {
    throw new Error(
      `region "${region.id}" sites an undefined bound site "${shard}"`
    );
  }
  return {
    regionId: region.id,
    shard,
    variants: def.variants,
    run: siteRun(shard),
    choice: { resolved: false },
    ledger,
    corruptionAccrued: 0,
  };
}

/**
 * Commit the player's free-vs-wield choice at an opened Bound site, folding it with
 * the *existing* {@link resolveChoice} reducer (#69 — never re-spec'd): *free*
 * grants the weaker shard (karma+, no corruption), *wield* the stronger carry
 * (accruing corruption, karma−). The returned session carries the persisted
 * {@link SavedChoice}, the folded {@link MoralLedger}, the accrued corruption, and
 * the run with its pending trigger cleared, so the two paths diverge measurably and
 * persist across a reload. Idempotent: a second choice against an already-settled
 * session is a no-op (`resolveChoice` returns the same run/ledger when nothing is
 * pending), so a site can never re-count. Pure — returns a fresh session.
 * @param session - The opened (or already-settled) Bound-site session (never mutated).
 * @param mode - The carry the player committed to (`free` or `wield`).
 * @returns The settled session (or the same logical state when already settled).
 */
export function chooseAtBoundSite(
  session: BoundSiteSession,
  mode: ShardMode
): BoundSiteSession {
  const resolution: MoralResolution = resolveChoice(
    session.run,
    session.ledger,
    mode
  );
  // No-op once settled: resolveChoice returns the same run/ledger + an unresolved
  // choice when nothing is pending, so preserve the already-committed choice rather
  // than overwriting it with the no-op's `{ resolved: false }`.
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
 * The single Bound sited in this session's region — the region's `boundSite`. A thin
 * reader so a consumer can name the sited shard without reaching into the session.
 * Pure.
 * @param session - The Bound-site session to read.
 * @returns The sited shard id.
 */
export function boundSiteShard(session: BoundSiteSession): BoundId {
  return session.shard;
}

/**
 * Whether the site's free-vs-wield choice has been committed (vs. still pending). A
 * thin reader over {@link BoundSiteSession.choice} so a consumer can branch on "has
 * the player chosen?" without inspecting the persisted shape. Pure.
 * @param session - The Bound-site session to inspect.
 * @returns True when a choice has been committed.
 */
export function isBoundSiteSettled(session: BoundSiteSession): boolean {
  return session.choice.resolved;
}

/**
 * A stable FNV-1a digest of a Bound-site session — the determinism handle the
 * verification bridge samples. Folds the region id, the sited shard, the committed
 * variant (or `pending`), the karma/free/wield tally, and the accrued corruption
 * into a canonical string, then hashes it. Same region + ledger + mode ⇒ identical
 * 8-hex digest; free and wield diverge. Pure: a total function of its input.
 * @param session - The Bound-site session to digest.
 * @returns An 8-char hex digest.
 */
export function hashBoundSite(session: BoundSiteSession): string {
  const canonical = [
    session.regionId,
    session.shard,
    session.choice.resolved ? (session.choice.variant ?? "") : "pending",
    String(session.ledger.karma),
    String(session.ledger.freeChoices),
    String(session.ledger.wieldChoices),
    String(session.corruptionAccrued),
  ].join("|");
  const digest = Array.from(canonical).reduce(
    (hash, char) => Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (digest >>> 0).toString(16).padStart(8, "0");
}
