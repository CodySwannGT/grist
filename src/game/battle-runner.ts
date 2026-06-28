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
import { BattleEvents, BattleTiming } from "../consts";
import { type EncounterDef, type PartyMemberDef } from "../content";
import {
  ActionKinds,
  isResolved,
  nextActor,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
} from "../logic/combat";
import { eventsCenter } from "../services/events";

/** Owns and advances one battle's pure state; renders nothing. */
export class BattleRunner {
  readonly #party: readonly PartyMemberDef[];
  readonly #encounter: EncounterDef;
  #state: BattleState;
  #accumulatorMs = 0;

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
   * Fill ATB gauges for the elapsed real time on a fixed step, pausing the moment
   * a combatant is ready to act (ATB-Wait) or the battle resolves. Deterministic
   * in elapsed sim-time: the same total delta applies the same number of ticks
   * regardless of frame rate. Allocation-free in the caller's `update` loop.
   * @param deltaMs - Milliseconds elapsed since the previous frame.
   * @returns void
   */
  advance(deltaMs: number): void {
    if (isResolved(this.#state) || nextActor(this.#state) !== null) {
      this.#accumulatorMs = 0;
      return;
    }
    this.#accumulatorMs += deltaMs;
    while (
      this.#accumulatorMs >= BattleTiming.atbTickMs &&
      nextActor(this.#state) === null &&
      !isResolved(this.#state)
    ) {
      this.#accumulatorMs -= BattleTiming.atbTickMs;
      this.#state = step(this.#state, { kind: ActionKinds.tick });
    }
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
