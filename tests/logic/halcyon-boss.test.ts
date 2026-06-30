/**
 * Halcyon frame-knight boss — the Ch.2 chase boss (#109, Story #96 / PD-3.5, PRD
 * #42 FR3 + AC5). The boss is authored as DATA in `src/content` reusing the
 * shipped Phase-2 combat core (Pressure→Break→Severance + the shared grist pool);
 * there are NO sim changes. These cases assert, in the headless `tests/logic`
 * lane (zero Phaser, seeded RNG only):
 *
 *  1. the Halcyon boss EnemyDef exists, is a distinct identity from the
 *     out-of-scope `halcyon` PARTY member (the defector), and carries the
 *     Break-gated boss markers (`ai: "break-boss"`, `breakGatedPhase1`);
 *  2. a solo-boss EncounterDef references it and sits at the TOP of the
 *     escalation ladder (the end-of-Ch.2 climax — strictly the hardest);
 *  3. behaviorally, on the existing sim: the boss is fought, the Break-gated
 *     beat is triggerable (accruing Pressure to the Break threshold flips the
 *     boss Broken, enabling Severance), and the "spend grist to win faster?"
 *     tension is live — the boss is beatable WITHOUT spending grist
 *     [EVIDENCE: no-spend-path], while a grist spend draws the SHARED pool down
 *     (the accelerant), proving the tension is observable in the encounter.
 *
 * @module tests/logic/halcyon-boss
 */
import { describe, expect, it } from "vitest";

import {
  ENCOUNTERS,
  ENEMIES,
  EncounterIds,
  EnemyIds,
  ESCALATION_LADDER,
  PARTY,
  PartyMemberIds,
  encounterDifficulty,
  isStrictlyEscalating,
} from "../../src/content";
import {
  CombatTuning,
  addPressure,
  combatantAt,
  severanceAvailable,
  startBattle,
  BattleSides,
} from "../../src/logic/combat";
import { earnGrist, newWallet, spendGrist } from "../../src/logic/grist";

/** A fixed seed — the headless lane is seed-deterministic (no Math.random). */
const SEED = 0x4a1c0de;

describe("Halcyon boss — enemy identity & Break-gated markers (#109)", () => {
  it("defines a Halcyon frame-knight boss EnemyDef distinct from the halcyon party member", () => {
    const boss = ENEMIES[EnemyIds.halcyonKnight];
    expect(boss).toBeDefined();
    expect(boss.id).toBe(EnemyIds.halcyonKnight);
    expect(boss.name).toContain("Halcyon");
    // CRITICAL (triage edge case): the boss enemy id must NOT collide with the
    // out-of-scope playable defector's party-member id.
    expect(EnemyIds.halcyonKnight).not.toBe(PartyMemberIds.halcyon);
    expect(PARTY[PartyMemberIds.halcyon]).toBeDefined();
  });

  it("carries the Break-gated boss markers (reuses the existing break-boss core)", () => {
    const boss = ENEMIES[EnemyIds.halcyonKnight];
    expect(boss.ai).toBe("break-boss");
    expect(boss.breakGatedPhase1).toBe(true);
  });

  it("is a genuine boss — strictly tougher than the Phase-2 Ashling boss", () => {
    // The Ch.2 chase boss is the climax; its lone stat block must out-survive
    // the slice boss so it tops the escalation ladder.
    expect(ENEMIES[EnemyIds.halcyonKnight].stats.hp).toBeGreaterThan(
      ENEMIES[EnemyIds.theAshling].stats.hp
    );
  });
});

describe("Halcyon boss — encounter & escalation placement (#109)", () => {
  it("defines a solo-boss EncounterDef referencing the Halcyon boss", () => {
    const enc = ENCOUNTERS[EncounterIds.halcyonChase];
    expect(enc).toBeDefined();
    expect(enc.id).toBe(EncounterIds.halcyonChase);
    expect(enc.enemies).toEqual([EnemyIds.halcyonKnight]);
  });

  it("sits at the top of the escalation ladder (the end-of-Ch.2 climax)", () => {
    expect(ESCALATION_LADDER).toContain(EncounterIds.halcyonChase);
    expect(ESCALATION_LADDER[ESCALATION_LADDER.length - 1]).toBe(
      EncounterIds.halcyonChase
    );
  });

  it("keeps the ladder strictly escalating with the boss appended", () => {
    expect(isStrictlyEscalating(ESCALATION_LADDER)).toBe(true);
    // And it is strictly the hardest encounter on the ladder.
    const halcyon = encounterDifficulty(ENCOUNTERS[EncounterIds.halcyonChase]);
    for (const id of ESCALATION_LADDER) {
      if (id !== EncounterIds.halcyonChase) {
        expect(halcyon).toBeGreaterThan(encounterDifficulty(ENCOUNTERS[id]));
      }
    }
  });
});

describe("Halcyon boss — Break-gated beat is triggerable on the existing sim (#109)", () => {
  it("starts a real battle against the Halcyon boss (the boss is fought)", () => {
    const state = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS[EncounterIds.halcyonChase],
      SEED
    );
    const boss = combatantAt(state, { side: BattleSides.enemies, index: 0 });
    expect(boss).not.toBeNull();
    expect(boss!.broken).toBe(false);
    expect(severanceAvailable(boss!)).toBe(false);
  });

  it("triggers the Break-gated beat — Pressure to threshold flips Broken, enabling Severance", () => {
    const state = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS[EncounterIds.halcyonChase],
      SEED
    );
    const boss = combatantAt(state, { side: BattleSides.enemies, index: 0 })!;
    // Below threshold: not yet broken, Severance gated.
    const nudged = addPressure(boss, CombatTuning.breakThreshold - 1);
    expect(nudged.broken).toBe(false);
    expect(severanceAvailable(nudged)).toBe(false);
    // One more hit on the already-pressured boss crosses the threshold: this
    // advances `nudged` (not the pristine boss) by 1, proving Pressure ACCUMULATES
    // across hits rather than being overwritten — the Break beat fires, the boss
    // is Broken, Severance opens.
    const broken = addPressure(nudged, 1);
    expect(broken.broken).toBe(true);
    expect(severanceAvailable(broken)).toBe(true);
  });
});

describe("Halcyon boss — grist-spend tension is live (#109 AC)", () => {
  it("is beatable WITHOUT spending grist — the grist spend is an accelerant, not a hard gate [no-spend-path]", () => {
    // Reaching Break needs only Pressure (the sim's free path); no grist spend is
    // required to open Severance, so a no-spend run can still win.
    const state = startBattle(
      [PARTY.wren, PARTY.tobi],
      ENCOUNTERS[EncounterIds.halcyonChase],
      SEED
    );
    const boss = combatantAt(state, { side: BattleSides.enemies, index: 0 })!;
    const brokenNoSpend = addPressure(boss, CombatTuning.breakThreshold);
    expect(severanceAvailable(brokenNoSpend)).toBe(true);
    // The shared wallet is never required to spend to reach the Break.
    const wallet = earnGrist(
      newWallet(),
      ENEMIES[EnemyIds.halcyonKnight].lootGrist
    );
    expect(wallet.grist).toBeGreaterThan(0);
  });

  it("a grist spend draws down the SHARED pool — the 'win faster?' tension is observable", () => {
    // The accelerant: spending grist (a costed Bind) from the shared pool to
    // press the Break faster trades the world-resource against bench growth.
    const funded = earnGrist(newWallet(), 12);
    const afterBind = spendGrist(funded, 8);
    expect(afterBind.ok).toBe(true);
    expect(afterBind.wallet.grist).toBe(funded.grist - 8);
    // Over-spend is rejected (no debt) — the tension is real, not free.
    const broke = spendGrist(newWallet(0), 8);
    expect(broke.ok).toBe(false);
  });
});
