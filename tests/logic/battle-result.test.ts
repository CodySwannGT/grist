/**
 * Unit suite for the pure battle-result extraction (`src/logic/battle-result`):
 * the function the Field↔Battle launcher uses to *consume* a resolved battle —
 * turning the terminal {@link BattleState} + the {@link EncounterDef} that ran
 * into the four observable outcomes the Field needs (win/lose, grist gained,
 * shard acquired, free-vs-wield choice trigger). Pure data-in/data-out, so the
 * whole contract is asserted headless under Vitest with no Phaser.
 */
import { describe, expect, it } from "vitest";
import { ENCOUNTERS, EncounterIds } from "../../src/content/encounters";
import { BoundIds } from "../../src/content/bounds";
import {
  BattlePhases,
  resolveOutcome,
  startBattle,
  type BattleState,
  type Combatant,
} from "../../src/logic/combat";
import { PARTY } from "../../src/content/party";
import {
  extractBattleResult,
  BattleOutcomes,
  type BattleResult,
} from "../../src/logic/battle-result";

const SEED = 0x1234abcd;
const LINEUP = [PARTY.wren, PARTY.tobi] as const;

/**
 * Assert the extraction produced a result (a resolved battle always does) and
 * narrow it from `BattleResult | null` so the assertions can read its fields.
 * @param result - The extracted result to narrow.
 * @returns The non-null result.
 */
function assertResolved(result: BattleResult | null): BattleResult {
  expect(result).not.toBeNull();
  if (result === null) {
    throw new Error("expected a resolved battle result");
  }
  return result;
}

/**
 * Down a combatant (HP to 0) so the outcome predicates see it defeated.
 * @param combatant - The combatant to down.
 * @returns The combatant with HP zeroed.
 */
function down(combatant: Combatant): Combatant {
  return { ...combatant, hp: 0 };
}

/**
 * Build a genuinely-resolved battle state by downing the losing side and
 * threading the result through the sim's own {@link resolveOutcome}, so the
 * terminal phase is derived from the combatants exactly as a real fight would —
 * never hand-set.
 * @param encounterId - The encounter to build the lineup from.
 * @param phase - The terminal phase to resolve to (won downs enemies, lost the party).
 * @param grist - The accumulated battle pool to seed.
 * @returns The resolved battle state.
 */
function resolvedState(
  encounterId: (typeof EncounterIds)[keyof typeof EncounterIds],
  phase: typeof BattlePhases.won | typeof BattlePhases.lost,
  grist: number
): BattleState {
  const base = startBattle(LINEUP, ENCOUNTERS[encounterId], SEED);
  const won = phase === BattlePhases.won;
  const enemies = won ? base.enemies.map(down) : base.enemies;
  const party = won ? base.party : base.party.map(down);
  return resolveOutcome({ ...base, enemies, party, grist });
}

describe("extractBattleResult", () => {
  it("reports a WIN with the grist gained on the Room A scrapper fight", () => {
    const state = resolvedState(
      EncounterIds.warrenStreet,
      BattlePhases.won,
      16
    );
    const result = assertResolved(
      extractBattleResult(state, ENCOUNTERS[EncounterIds.warrenStreet])
    );
    expect(result.outcome).toBe(BattleOutcomes.win);
    expect(result.gristGained).toBe(16);
    expect(result.shard).toBeNull();
    expect(result.choiceTriggered).toBe(false);
  });

  it("reports a LOSE and grants no grist on a party wipe", () => {
    const state = resolvedState(
      EncounterIds.warrenStreet,
      BattlePhases.lost,
      0
    );
    const result = assertResolved(
      extractBattleResult(state, ENCOUNTERS[EncounterIds.warrenStreet])
    );
    expect(result.outcome).toBe(BattleOutcomes.lose);
    // A loss yields no grist regardless of what the battle pool happened to hold.
    expect(result.gristGained).toBe(0);
    expect(result.shard).toBeNull();
    expect(result.choiceTriggered).toBe(false);
  });

  it("awards the shard and triggers the choice when the Ashling (boss) is won", () => {
    const state = resolvedState(EncounterIds.theCage, BattlePhases.won, 20);
    const result = assertResolved(
      extractBattleResult(state, ENCOUNTERS[EncounterIds.theCage])
    );
    expect(result.outcome).toBe(BattleOutcomes.win);
    expect(result.gristGained).toBe(20);
    expect(result.shard).toBe(BoundIds.marrowBound);
    // A shard acquisition surfaces the free-vs-wield choice trigger (#75 consumes it).
    expect(result.choiceTriggered).toBe(true);
  });

  it("does NOT award the boss shard on a loss to the Ashling", () => {
    const state = resolvedState(EncounterIds.theCage, BattlePhases.lost, 0);
    const result = assertResolved(
      extractBattleResult(state, ENCOUNTERS[EncounterIds.theCage])
    );
    expect(result.outcome).toBe(BattleOutcomes.lose);
    expect(result.shard).toBeNull();
    expect(result.choiceTriggered).toBe(false);
  });

  it("awards no shard for a non-boss encounter even on a win", () => {
    const state = resolvedState(EncounterIds.theDrip, BattlePhases.won, 10);
    const result = assertResolved(
      extractBattleResult(state, ENCOUNTERS[EncounterIds.theDrip])
    );
    expect(result.outcome).toBe(BattleOutcomes.win);
    expect(result.shard).toBeNull();
    expect(result.choiceTriggered).toBe(false);
  });

  it("returns null for a still-live (unresolved) battle", () => {
    const live = startBattle(
      LINEUP,
      ENCOUNTERS[EncounterIds.warrenStreet],
      SEED
    );
    expect(
      extractBattleResult(live, ENCOUNTERS[EncounterIds.warrenStreet])
    ).toBeNull();
  });
});
