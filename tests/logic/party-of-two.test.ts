import { describe, expect, it } from "vitest";

import { ENCOUNTERS, EncounterIds, PARTY } from "../../src/content";
import {
  ActionKinds,
  BattleSides,
  advanceToNextTurn,
  nextActor,
  readyActors,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
  type CombatantRef,
} from "../../src/logic/combat";

/**
 * #110 — the demo runs a *controllable party of two* (Wren + Tobi) through the
 * EXISTING ATB turn engine, with no engine changes. These tests field the pair
 * via the unmodified `startBattle` / `step` reducer and prove BOTH members each
 * take a ready turn and resolve an action in a single battle. The reducer itself
 * is untouched — this is a behavioral guarantee on the already-shipped engine.
 */
const SEED = 0x0110c0de;
const ENEMY: CombatantRef = { side: BattleSides.enemies, index: 0 };

/**
 * Build the two-member party battle against the simplest authored encounter.
 * @returns The fresh two-member battle state.
 */
function startPartyOfTwo(): BattleState {
  return startBattle(
    [PARTY.wren, PARTY.tobi],
    ENCOUNTERS[EncounterIds.warrenStreet],
    SEED
  );
}

/**
 * A Strike action for a given party index against the lone enemy.
 * @param index - The acting party member's index.
 * @returns The Strike battle action.
 */
function strikeBy(index: number): BattleAction {
  return {
    kind: ActionKinds.strike,
    actor: { side: BattleSides.party, index },
    target: ENEMY,
  };
}

describe("party of two through the existing ATB engine (#110)", () => {
  it("fields exactly two controllable party combatants (Wren + Tobi)", () => {
    const state = startPartyOfTwo();
    expect(state.party).toHaveLength(2);
    expect(state.party.map(seat => seat.ref)).toEqual(["wren", "tobi"]);
  });

  it("each member fills its own ATB gauge and becomes a ready actor", () => {
    // Tick until at least one party member is ready, then drive on until both
    // Wren (index 0) and Tobi (index 1) have each appeared as a ready party actor.
    let state = advanceToNextTurn(startPartyOfTwo());
    const seenReadyPartyIndices = new Set<number>();
    let guard = 0;
    while (seenReadyPartyIndices.size < 2 && guard < 50) {
      guard += 1;
      for (const ref of readyActors(state)) {
        if (ref.side === BattleSides.party) {
          seenReadyPartyIndices.add(ref.index);
        }
      }
      // Spend the next party actor's turn (or tick) so the loop progresses.
      const next = nextActor(state);
      if (next !== null && next.side === BattleSides.party) {
        state = step(state, strikeBy(next.index));
      }
      state = advanceToNextTurn(state);
    }
    expect(seenReadyPartyIndices.has(0)).toBe(true); // Wren acted
    expect(seenReadyPartyIndices.has(1)).toBe(true); // Tobi acted
  });

  it("both members resolve a real action in one battle (turn spent, ATB reset)", () => {
    let state = advanceToNextTurn(startPartyOfTwo());

    // Force both party gauges to ready so each can be ordered to act in the same
    // battle, then resolve Wren and Tobi back to back through the same reducer.
    state = {
      ...state,
      party: state.party.map(seat => ({ ...seat, atb: 100 })),
    };

    const wrenBefore = state.party[0]!;
    state = step(state, strikeBy(0));
    expect(state.party[0]!.atb).toBeLessThan(wrenBefore.atb); // Wren's turn spent

    const tobiBefore = state.party[1]!;
    state = step(state, strikeBy(1));
    expect(state.party[1]!.atb).toBeLessThan(tobiBefore.atb); // Tobi's turn spent

    // Both actions are recorded in the shared battle log — they fought together.
    const partyActions = state.log.filter(
      event => event.kind === ActionKinds.strike
    );
    expect(partyActions.length).toBeGreaterThanOrEqual(2);
  });
});
