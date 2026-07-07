/**
 * Headless, seeded combat-balance sweep harness (issue #266). The combat sim is
 * pure, deterministic, and Phaser-free, so balance can be validated by *evidence*
 * rather than vibes: play batches of seeded fights per encounter tier under
 * scripted player policies and report win rate, mean turns, KO incidence, and
 * party HP remaining. The band assertions in `balance.test.ts` consume these
 * aggregates so future content can never silently trivialize combat again, and
 * `scripts/balance-sweep.ts` prints the same tables for the PR body.
 *
 * A "policy" is a pure function from the live {@link BattleState} plus the ready
 * party actor to the {@link BattleAction} that actor should take — the three the
 * ticket mandates are {@link strikeSpam} (naive), {@link telegraphDefend}
 * (telegraph-aware Defend), and {@link craftMixed} (Craft + Break rotation).
 * Nothing here reads `Math.random`/`Date` — the seed list is fixed — so a sweep
 * is itself reproducible.
 * @module tests/logic/balance/harness
 */
import {
  enemyTelegraph,
  isResolved,
  nextActor,
  runToNextDecision,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
  type CombatantRef,
} from "../../../src/logic/combat";
import {
  ENEMIES,
  PARTY,
  type EncounterDef,
  type EnemyId,
  type PartyMemberDef,
} from "../../../src/content";
import { type WorldState } from "../../../src/logic/world";

/** The canonical reachable slice party the QA pass fought (Wren + Tobi). */
export const SLICE_PARTY: readonly PartyMemberDef[] = [PARTY.wren, PARTY.tobi];

/** AP cost of Wren's Spark — the mixed policy's weakness/Break engine. */
const SPARK_AP_COST = 4;
/** Telegraph charge at which the telegraph-aware policy braces (Defend). */
const DEFEND_CHARGE = 0.85;
/** Hard cap on party decisions per fight — a stalemate counts as a loss. */
const MAX_ROUNDS = 400;

/** The outcome of one played-out seeded fight. */
interface FightOutcome {
  /** Whether the party won (all enemies down, party alive). */
  readonly won: boolean;
  /** Party decisions taken to reach the outcome (the "turns" measure). */
  readonly turns: number;
  /** Whether any party member's HP hit 0 at any point (a live KO). */
  readonly anyKO: boolean;
  /** Party HP remaining at the end, as a fraction of the party's max HP. */
  readonly partyHpFrac: number;
  /** Grist in the shared pool at the end (economy signal). */
  readonly endGrist: number;
}

/** Aggregated statistics over a batch of seeded fights. */
interface SweepStats {
  /** Number of fights in the batch. */
  readonly fights: number;
  /** Fraction of fights won (0–1). */
  readonly winRate: number;
  /** Mean party decisions across the batch. */
  readonly meanTurns: number;
  /** Fraction of fights in which a party member was KO'd at any point (0–1). */
  readonly koRate: number;
  /** Mean party-HP-remaining fraction across the batch (0–1). */
  readonly avgHpRemaining: number;
}

/** A scripted player policy: pick the action a ready party actor should take. */
type Policy = (state: BattleState, actor: CombatantRef) => BattleAction;

/**
 * Index of the first living enemy, or -1 when every enemy is down.
 * @param state - The battle state.
 * @returns The first living enemy index, or -1.
 */
function firstLivingEnemy(state: BattleState): number {
  return state.enemies.findIndex(enemy => enemy.hp > 0);
}

/**
 * Index of the living enemy with the lowest HP (focus-fire), or -1 when every
 * enemy is down.
 * @param state - The battle state.
 * @returns The lowest-HP living enemy index, or -1.
 */
function weakestLivingEnemy(state: BattleState): number {
  return state.enemies.reduce((best, enemy, index) => {
    if (enemy.hp <= 0) {
      return best;
    }
    return best < 0 || enemy.hp < (state.enemies[best]?.hp ?? Infinity)
      ? index
      : best;
  }, -1);
}

/**
 * Index of a living enemy Spark (flux) hits a weakness on, else the lowest-HP
 * living enemy — the mixed policy targets a flux-weak enemy first to drive
 * Pressure → Break, the combat-spec's "core skill expression".
 * @param state - The battle state.
 * @returns The preferred Spark target index, or -1 when none live.
 */
function sparkTarget(state: BattleState): number {
  const weak = state.enemies.findIndex(
    enemy =>
      enemy.hp > 0 && (ENEMIES[enemy.ref as EnemyId]?.elements?.flux ?? 1) > 1
  );
  return weak >= 0 ? weak : weakestLivingEnemy(state);
}

/**
 * Whether a party member's kit can cast Spark (only Wren, in the slice).
 * @param ref - The party member's content id.
 * @returns True when the member can cast Spark.
 */
function canSpark(ref: string): boolean {
  return ref === "wren";
}

/**
 * A Strike action from `actor` at the enemy at `targetIndex`.
 * @param actor - The acting party member's ref.
 * @param targetIndex - The enemy index to strike.
 * @returns The Strike battle action.
 */
function strike(actor: CombatantRef, targetIndex: number): BattleAction {
  return {
    kind: "strike",
    actor,
    target: { side: "enemies", index: targetIndex },
  };
}

/**
 * Naive Strike-spam: every actor strikes the first living enemy, always.
 * @param state - The battle state.
 * @param actor - The ready party actor.
 * @returns The Strike action.
 */
const strikeSpam: Policy = (state, actor) => {
  const target = firstLivingEnemy(state);
  return strike(actor, target < 0 ? 0 : target);
};

/**
 * Telegraph-aware Defend: the focus target (front member) braces with Defend
 * when an enemy telegraph has charged near release; otherwise it Strikes. Proves
 * Defend now mitigates the telegraphed blow (survival) versus naive spam.
 * @param state - The battle state.
 * @param actor - The ready party actor.
 * @returns A Defend when bracing a telegraph, else a Strike.
 */
const telegraphDefend: Policy = (state, actor) => {
  const tel = enemyTelegraph(state);
  const target = firstLivingEnemy(state);
  if (tel !== null && tel.charge >= DEFEND_CHARGE && actor.index === 0) {
    return { kind: "defend", actor };
  }
  return strike(actor, target < 0 ? 0 : target);
};

/**
 * Craft/Break mixed rotation: the caster (Wren) casts Spark when she can afford
 * the AP — targeting a flux-weak enemy to build Pressure → Break (×2) — and
 * Strikes to bank AP otherwise; non-casters focus-fire the weakest enemy. This
 * is the systems-literate line the ticket wants to beat pure Strike-spam.
 * @param state - The battle state.
 * @param actor - The ready party actor.
 * @returns A Spark when affordable, else a focus-fire Strike.
 */
const craftMixed: Policy = (state, actor) => {
  const member = actor.index === 0 ? state.party[0] : state.party[actor.index];
  const ap = member?.ap ?? 0;
  if (member && canSpark(member.ref) && ap >= SPARK_AP_COST) {
    const target = sparkTarget(state);
    if (target >= 0) {
      return {
        kind: "craft",
        id: "spark",
        actor,
        target: { side: "enemies", index: target },
      };
    }
  }
  const focus = weakestLivingEnemy(state);
  return strike(actor, focus < 0 ? 0 : focus);
};

/** The three mandated policies, keyed for the sweep tables. */
export const POLICIES: Readonly<Record<string, Policy>> = {
  "strike-spam": strikeSpam,
  "telegraph-defend": telegraphDefend,
  "craft-mixed": craftMixed,
};

/**
 * The party's summed max HP — the denominator for HP-remaining fractions.
 * @param party - The fielded party.
 * @returns The summed base HP across the party.
 */
function partyMaxHp(party: readonly PartyMemberDef[]): number {
  return party.reduce((sum, member) => sum + member.baseStats.hp, 0);
}

/** The running state of one played-out fight (threaded, never mutated). */
interface PlayProgress {
  /** The live battle state. */
  readonly state: BattleState;
  /** Whether any party member has hit 0 HP so far. */
  readonly anyKO: boolean;
  /** Party decisions taken so far. */
  readonly rounds: number;
}

/**
 * Advance a fight one player decision at a time until it resolves, no actor is
 * ready, or the stalemate cap is hit — pure recursion (no mutable loop state).
 * @param progress - The current play progress.
 * @param policy - The policy driving party decisions.
 * @returns The terminal play progress.
 */
function playOut(progress: PlayProgress, policy: Policy): PlayProgress {
  if (isResolved(progress.state) || progress.rounds >= MAX_ROUNDS) {
    return progress;
  }
  const actor = nextActor(progress.state);
  if (actor === null) {
    return progress;
  }
  const next = runToNextDecision(
    step(progress.state, policy(progress.state, actor))
  );
  return playOut(
    {
      state: next,
      anyKO: progress.anyKO || next.party.some(member => member.hp <= 0),
      rounds: progress.rounds + 1,
    },
    policy
  );
}

/**
 * Play one seeded fight to its terminal outcome (or a stalemate cap) under a
 * policy, returning the win/turns/KO/HP signals. Deterministic in the seed.
 * @param party - The party to field.
 * @param encounter - The encounter to fight.
 * @param worldState - `reach` (Act I) or `ashfall` (Act II variants).
 * @param seed - The 32-bit battle seed.
 * @param policy - The player policy driving party decisions.
 * @returns The fight outcome signals.
 */
function runFight(
  party: readonly PartyMemberDef[],
  encounter: EncounterDef,
  worldState: WorldState,
  seed: number,
  policy: Policy
): FightOutcome {
  const maxHp = partyMaxHp(party);
  const end = playOut(
    {
      state: runToNextDecision(startBattle(party, encounter, seed, worldState)),
      anyKO: false,
      rounds: 0,
    },
    policy
  );
  const hpLeft = end.state.party.reduce(
    (sum, member) => sum + Math.max(0, member.hp),
    0
  );
  return {
    won: end.state.phase === "won",
    turns: end.rounds,
    anyKO: end.anyKO,
    partyHpFrac: maxHp === 0 ? 0 : hpLeft / maxHp,
    endGrist: end.state.grist,
  };
}

/**
 * A deterministic, well-spread 32-bit seed for batch index `i`.
 * @param i - The batch index.
 * @returns A 32-bit seed.
 */
function seedAt(i: number): number {
  return (0x1234_0000 + Math.imul(i + 1, 0x9e37_79b1)) >>> 0;
}

/**
 * A fixed batch of `n` deterministic seeds (no RNG — reproducible sweeps).
 * @param n - The batch size.
 * @returns `n` deterministic 32-bit seeds.
 */
export function seeds(n: number): readonly number[] {
  return Array.from({ length: n }, (_unused, i) => seedAt(i));
}

/**
 * Sweep a batch of seeded fights and aggregate the balance signals.
 * @param party - The party to field.
 * @param encounter - The encounter to sweep.
 * @param worldState - `reach` or `ashfall`.
 * @param policy - The policy to drive.
 * @param batch - The seeds to play.
 * @returns The aggregated {@link SweepStats}.
 */
export function sweep(
  party: readonly PartyMemberDef[],
  encounter: EncounterDef,
  worldState: WorldState,
  policy: Policy,
  batch: readonly number[]
): SweepStats {
  const outcomes = batch.map(seed =>
    runFight(party, encounter, worldState, seed, policy)
  );
  const n = outcomes.length;
  const wins = outcomes.filter(o => o.won).length;
  const kos = outcomes.filter(o => o.anyKO).length;
  const turns = outcomes.reduce((s, o) => s + o.turns, 0);
  const hp = outcomes.reduce((s, o) => s + o.partyHpFrac, 0);
  return {
    fights: n,
    winRate: n === 0 ? 0 : wins / n,
    meanTurns: n === 0 ? 0 : turns / n,
    koRate: n === 0 ? 0 : kos / n,
    avgHpRemaining: n === 0 ? 0 : hp / n,
  };
}
