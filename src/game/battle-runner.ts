/**
 * Battle adapter — the thin bridge between the pure combat sim (`src/logic/combat`)
 * and the Phaser scene. It owns the live {@link BattleState} and is the *only*
 * place a {@link BattleAction} is threaded through the deterministic reducer
 * ({@link step}); it holds no combat rules of its own (decision 0006, T3:
 * sim-authoritative). The scene publishes actions on the EventsCenter bus and this
 * adapter — subscribed once — applies them. Between turns it fills the ATB gauges
 * on a fixed real-time step and pauses the instant a combatant is ready (ATB-Wait,
 * combat-spec), so the event log never grows unbounded.
 * @module game/battle-runner
 */
import { BattleEvents } from "../consts";
import { type EncounterDef, type PartyMemberDef } from "../content";
import {
  ActionKinds,
  isResolved,
  nextActor,
  resolveEnemyTurns,
  runToNextDecision,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
} from "../logic/combat";
import { eventsCenter } from "../services/events";
import { DEFAULT_SPEED, speedTickMs, type BattleSpeed } from "./speed";

/** Owns and advances one battle's pure state; renders nothing. */
export class BattleRunner {
  readonly #party: readonly PartyMemberDef[];
  readonly #encounter: EncounterDef;
  #state: BattleState;
  #accumulatorMs = 0;
  #speed: BattleSpeed = DEFAULT_SPEED;

  /**
   * Build the initial battle and subscribe to the action bus.
   * @param party - The party member definitions to field.
   * @param encounter - The encounter whose enemy lineup to resolve.
   * @param seed - The 32-bit battle seed.
   */
  constructor(
    party: readonly PartyMemberDef[],
    encounter: EncounterDef,
    seed: number
  ) {
    this.#party = party;
    this.#encounter = encounter;
    this.#state = startBattle(party, encounter, seed);
    eventsCenter.on(BattleEvents.ActionRequested, this.#onAction);
  }

  /**
   * The live battle state (a frozen-safe immutable snapshot reference).
   * @returns The current battle state.
   */
  state(): BattleState {
    return this.#state;
  }

  /**
   * Bus handler: thread one requested action through the pure reducer. A stable
   * arrow field so it can be unsubscribed by reference in {@link dispose}.
   * @param action - The requested battle action.
   * @returns void
   */
  readonly #onAction = (action: BattleAction): void => {
    this.#state = step(this.#state, action);
  };

  /**
   * The current battle speed (Wait / Normal / Fast).
   * @returns The active speed setting.
   */
  speed(): BattleSpeed {
    return this.#speed;
  }

  /**
   * Set the battle speed mid-fight. The new cadence applies to the next
   * {@link advance}; the accumulator is reset so a slow→fast switch never dumps a
   * backlog of ticks at once.
   * @param speed - The speed to switch to.
   * @returns void
   */
  setSpeed(speed: BattleSpeed): void {
    this.#speed = speed;
    this.#accumulatorMs = 0;
  }

  /**
   * Fill ATB gauges for the elapsed real time at the current speed's cadence,
   * pausing the moment a combatant is ready to act (ATB-Wait), the battle
   * resolves, or the speed is full-Wait (frozen fill). Deterministic in elapsed
   * sim-time at a fixed speed: the same total delta applies the same number of
   * ticks regardless of frame rate. Allocation-free in the caller's `update` loop.
   * @param deltaMs - Milliseconds elapsed since the previous frame.
   * @returns void
   */
  advance(deltaMs: number): void {
    const tickMs = speedTickMs(this.#speed);
    if (tickMs === null || isResolved(this.#state)) {
      this.#accumulatorMs = 0;
      return;
    }
    // Auto-resolve any enemy whose gauge has filled (deterministic AI) so the ATB
    // loop never stalls on a ready enemy that has no player to act for it; pause
    // only for a ready *party* member, whose turn waits for input.
    this.#state = resolveEnemyTurns(this.#state);
    if (isResolved(this.#state) || nextActor(this.#state) !== null) {
      this.#accumulatorMs = 0;
      return;
    }
    this.#accumulatorMs += deltaMs;
    while (
      this.#accumulatorMs >= tickMs &&
      nextActor(this.#state) === null &&
      !isResolved(this.#state)
    ) {
      this.#accumulatorMs -= tickMs;
      this.#state = resolveEnemyTurns(
        step(this.#state, { kind: ActionKinds.tick })
      );
    }
  }

  /**
   * Deterministically fast-forward to the next player decision point — filling
   * the ATB and auto-resolving enemy turns until a party member is ready or the
   * battle resolves — independent of wall-clock pacing. The verification bridge
   * drives a seeded battle through this so an e2e (and the determinism gate) can
   * play turn-by-turn without racing the per-frame {@link advance} loop.
   * @returns void
   */
  advanceTurn(): void {
    this.#state = runToNextDecision(this.#state);
    this.#accumulatorMs = 0;
  }

  /**
   * Restart the battle from scratch under a fresh seed (verification reseed).
   * @param seed - The 32-bit battle seed.
   * @returns void
   */
  restart(seed: number): void {
    this.#state = startBattle(this.#party, this.#encounter, seed);
    this.#accumulatorMs = 0;
  }

  /**
   * Unsubscribe from the action bus. Call from the owning scene's shutdown.
   * @returns void
   */
  dispose(): void {
    eventsCenter.off(BattleEvents.ActionRequested, this.#onAction);
  }
}
