/**
 * The pure **traversal + fast-travel + soft-gate service** (#136, PRD #43 FR4 /
 * Scope-IN 3 / AC4) — the earned-freedom mobility chain and its capability/knowledge
 * soft-gate. The world opens by *earning capability*, never by a clock:
 *
 * - **foot** — the start tier; only local travel within the current locale.
 * - **skiff** — Wren's regional craft; earning it opens *regional* travel.
 * - **airship** — built by Tobi, flown by Cal; earning it (only after the skiff —
 *   the authored order) opens the *full Reach* and, with safehouse knowledge,
 *   unlocks **fast-travel** between discovered safehouses at a grist cost.
 *
 * The {@link unlockSkiff} / {@link unlockAirship} transitions are total and
 * idempotent: re-earning a held tier is a no-op (same object), and earning the
 * airship before the skiff is refused (the chain is gated by capability, not a
 * clock). The {@link canTravel} soft-gate keys a {@link TravelScope} on the held
 * tier; {@link canFastTravel} additionally requires the airship **and** two
 * discovered safehouses (knowledge). {@link fastTravel} hops between two *discovered*
 * safehouses, deducting grist from the single shared {@link GristWallet} via the
 * pure {@link spendGrist} reducer (composed from `logic/grist`, never
 * re-implemented) — an insufficient balance or an unknown endpoint is refused with
 * the wallet untouched.
 *
 * Zero Phaser, no I/O, no RNG, no `Math.random` / `Date.now` / `performance.now` —
 * every function is a total function of its explicit inputs, so the mobility chain is
 * deterministic and reproducible under the verification (UAT) suite. {@link hashTravel}
 * is the stable FNV-1a digest of the tracked state (tier, knowledge, location, grist),
 * the scene-agnostic analogue of the combat/region state-hash: the same action
 * sequence yields an identical digest progression (the determinism thesis the
 * `__VERIFY__` e2e proves on the live canvas). This module owns the *rules*; a Phaser
 * adapter owns the storage and the scene.
 * @module logic/travel/travel
 */
import {
  canSpendGrist,
  newWallet,
  spendGrist,
  type GristWallet,
} from "../grist";

/**
 * The traversal tiers, in the authored unlock order: **foot** (the start) →
 * **skiff** (regional) → **airship** (full Reach + fast-travel). A tier is a
 * *capability* the party earns; the value is persisted verbatim by the save layer.
 */
export const TraversalTiers = {
  /** On foot / local transit — the start tier; only local travel. */
  foot: "foot",
  /** Wren's skiff — opens regional travel. */
  skiff: "skiff",
  /** The party's airship — opens the full Reach and fast-travel. */
  airship: "airship",
} as const;

/** A traversal tier (the literal-union of {@link TraversalTiers} values). */
export type TraversalTier =
  (typeof TraversalTiers)[keyof typeof TraversalTiers];

/**
 * The travel scopes the soft-gate arbitrates, widening with each earned tier:
 * **local** (always open, on foot), **regional** (the skiff), **fullReach** (the
 * airship). The gate keys each scope on the held tier — capability/knowledge, never
 * a clock.
 */
export const TravelScopes = {
  /** Travel within the current locale — always permitted, even on foot. */
  local: "local",
  /** Travel between regions — requires the skiff (or better). */
  regional: "regional",
  /** Travel across the full Reach — requires the airship. */
  fullReach: "fullReach",
} as const;

/** A travel scope (the literal-union of {@link TravelScopes} values). */
export type TravelScope = (typeof TravelScopes)[keyof typeof TravelScopes];

/**
 * The pure mobility state the service threads: the earned traversal {@link tier},
 * the discovered safehouses (knowledge), the party's current safehouse location
 * (null until a fast-travel sets it), and the shared grist {@link GristWallet}
 * (composed from `logic/grist`, not re-implemented). Immutable — every transform
 * returns fresh state (or the same object on a no-op, for structural sharing).
 */
export interface TravelState {
  /** The earned traversal tier — the widest mobility capability held. */
  readonly tier: TraversalTier;
  /** The safehouses the party has discovered, in discovery order (knowledge). */
  readonly discovered: readonly string[];
  /** The safehouse the party is currently at, or null before any fast-travel. */
  readonly location: string | null;
  /** The shared party grist wallet a fast-travel hop draws down. */
  readonly wallet: GristWallet;
}

/** The outcome of a {@link fastTravel} attempt against the shared wallet. */
export interface FastTravelResult {
  /** Whether the hop was made (false on a gate failure or an over-spend). */
  readonly ok: boolean;
  /** The travel state after the hop — the same object when `ok` is false. */
  readonly state: TravelState;
  /** The grist actually drawn down (0 when the hop was refused). */
  readonly spent: number;
}

/** First-pass mobility tuning (PRD #43 / economy-spec). */
export const TravelTuning = {
  /**
   * The grist a single fast-travel hop costs the shared wallet. A whole, positive
   * cost — fast-travel trades grist (the "spend the world" tension) for time saved.
   */
  fastTravelCost: 4,
  /** The number of discovered safehouses fast-travel requires (knowledge gate). */
  fastTravelMinKnown: 2,
} as const;

/**
 * Build a fresh travel state: on foot, no discovered safehouses, no location, and
 * the given wallet (default: a fresh wallet at the slice starting grist). Pure —
 * reads nothing ambient.
 * @param wallet - The starting shared wallet (default: {@link newWallet}).
 * @returns The initial travel state.
 */
export function newTravelState(wallet: GristWallet = newWallet()): TravelState {
  return {
    tier: TraversalTiers.foot,
    discovered: [],
    location: null,
    wallet,
  };
}

/**
 * Earn the skiff, advancing **foot → skiff** and opening regional travel. Total and
 * idempotent: from foot it advances; from skiff or airship it is a no-op that
 * returns the same object (the party already holds the capability). Pure — decided
 * by capability, never by chance, so it consumes no RNG.
 * @param state - The current travel state (never mutated).
 * @returns The travel state with the skiff earned, or the same object on a no-op.
 */
export function unlockSkiff(state: TravelState): TravelState {
  return state.tier === TraversalTiers.foot
    ? { ...state, tier: TraversalTiers.skiff }
    : state;
}

/**
 * Earn the airship, advancing **skiff → airship** and opening the full Reach (and,
 * with safehouse knowledge, fast-travel). Total and order-gated: it advances **only**
 * from the skiff tier — earning the airship on foot is refused (a no-op returning the
 * same object), because the chain is gated by capability (the authored order), not a
 * clock. From the airship tier it is an idempotent no-op. Pure — consumes no RNG.
 * @param state - The current travel state (never mutated).
 * @returns The travel state with the airship earned, or the same object when the
 *   skiff is not yet held or the airship is already held.
 */
export function unlockAirship(state: TravelState): TravelState {
  return state.tier === TraversalTiers.skiff
    ? { ...state, tier: TraversalTiers.airship }
    : state;
}

/**
 * Record a discovered safehouse (knowledge). Idempotent: a safehouse already known
 * is a no-op that returns the same object; otherwise it is appended in discovery
 * order. Discovering a safehouse never touches the tier or the wallet. Pure.
 * @param state - The current travel state (never mutated).
 * @param safehouse - The safehouse the party discovered.
 * @returns The travel state with the safehouse recorded, or the same object on a no-op.
 */
export function discoverSafehouse(
  state: TravelState,
  safehouse: string
): TravelState {
  return state.discovered.includes(safehouse)
    ? state
    : { ...state, discovered: [...state.discovered, safehouse] };
}

/** The minimum tier each travel scope requires (the soft-gate ladder). */
const SCOPE_MIN_TIER: Readonly<Record<TravelScope, TraversalTier>> = {
  [TravelScopes.local]: TraversalTiers.foot,
  [TravelScopes.regional]: TraversalTiers.skiff,
  [TravelScopes.fullReach]: TraversalTiers.airship,
};

/** The earned-order rank of each tier — the soft-gate compares these, never clocks. */
const TIER_RANK: Readonly<Record<TraversalTier, number>> = {
  [TraversalTiers.foot]: 0,
  [TraversalTiers.skiff]: 1,
  [TraversalTiers.airship]: 2,
};

/**
 * The soft-gate predicate: whether the party's held {@link tier} permits a travel
 * {@link scope}. Keyed purely on capability — a wider scope needs a higher tier
 * ({@link TravelScopes.regional} needs the skiff, {@link TravelScopes.fullReach}
 * needs the airship) — and never on a clock, so the gate is deterministic and
 * referentially transparent. Pure.
 * @param state - The travel state to test.
 * @param scope - The travel scope being attempted.
 * @returns True when the held tier covers the scope.
 */
export function canTravel(state: TravelState, scope: TravelScope): boolean {
  return TIER_RANK[state.tier] >= TIER_RANK[SCOPE_MIN_TIER[scope]];
}

/**
 * Whether the party can fast-travel at all: it must hold the airship (full-Reach
 * capability) **and** know at least {@link TravelTuning.fastTravelMinKnown}
 * safehouses (knowledge). A grounded party, or one that has not discovered two
 * safehouses, cannot fast-travel regardless of its grist. Pure — capability +
 * knowledge, never a clock.
 * @param state - The travel state to test.
 * @returns True when the fast-travel capability is unlocked.
 */
export function canFastTravel(state: TravelState): boolean {
  return (
    canTravel(state, TravelScopes.fullReach) &&
    state.discovered.length >= TravelTuning.fastTravelMinKnown
  );
}

/**
 * Whether a specific fast-travel hop is permissible *before* pricing it: the
 * capability is unlocked, the origin and destination are both discovered, and they
 * are distinct (a same-safehouse hop is not a paid trip). The knowledge gate here is
 * per-endpoint — fast-travel only reaches safehouses the party knows. Pure.
 * @param state - The travel state to test.
 * @param from - The origin safehouse.
 * @param to - The destination safehouse.
 * @returns True when the hop clears every non-economic gate.
 */
function canHop(state: TravelState, from: string, to: string): boolean {
  return (
    canFastTravel(state) &&
    from !== to &&
    state.discovered.includes(from) &&
    state.discovered.includes(to)
  );
}

/**
 * Fast-travel between two discovered safehouses, deducting the grist cost from the
 * shared wallet. The hop is all-or-nothing and refused (`ok: false`, the same state
 * object, `spent: 0`) when any gate fails — the capability is not unlocked, an
 * endpoint is unknown, the origin and destination coincide, or the wallet cannot
 * cover {@link TravelTuning.fastTravelCost}. On success the wallet is drawn down by
 * the cost (composing the pure {@link spendGrist}) and the party's location moves to
 * the destination. Pure — returns fresh state on success, never mutating the input.
 * @param state - The current travel state (never mutated).
 * @param from - The origin safehouse (must be discovered).
 * @param to - The destination safehouse (must be discovered, distinct from `from`).
 * @returns The hop result: whether it was made, the resulting state, and the grist spent.
 */
export function fastTravel(
  state: TravelState,
  from: string,
  to: string
): FastTravelResult {
  const cost = TravelTuning.fastTravelCost;
  if (!canHop(state, from, to) || !canSpendGrist(state.wallet, cost)) {
    return { ok: false, state, spent: 0 };
  }
  const spend = spendGrist(state.wallet, cost);
  if (!spend.ok) {
    return { ok: false, state, spent: 0 };
  }
  return {
    ok: true,
    state: { ...state, wallet: spend.wallet, location: to },
    spent: spend.spent,
  };
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Canonical, unambiguous serialization of the tracked travel fields — the
 * determinism contract's surface: the tier, the discovered safehouses (in order),
 * the location, and the grist balance. Uses `JSON.stringify` so no two distinct
 * states can collide: a delimiter-join would collapse `["a,b"]` with `["a","b"]`
 * (a comma inside an id vs. a separator) and `null` location with `""`, breaking the
 * "every tracked field changes the digest" contract; the JSON encoding keeps array
 * boundaries and the `null`/`""` distinction intact.
 * @param state - The travel state to serialize.
 * @returns A stable, unambiguous string encoding.
 */
function serializeTravel(state: TravelState): string {
  return JSON.stringify([
    state.tier,
    state.discovered,
    state.location,
    state.wallet.grist,
  ]);
}

/**
 * Stable FNV-1a digest of the canonical travel serialization, as zero-padded hex —
 * the scene-agnostic analogue of the combat/region state-hash. Equal states hash
 * equal, and any change to a tracked field (tier, knowledge, location, grist) changes
 * the digest, so two seeded runs of the same action sequence produce an identical
 * digest progression. Pure.
 * @param state - The travel state to hash.
 * @returns An 8-character hex digest.
 */
export function hashTravel(state: TravelState): string {
  const hash = [...serializeTravel(state)].reduce(
    (acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME),
    FNV_OFFSET
  );
  return (hash >>> 0).toString(16).padStart(8, "0");
}
