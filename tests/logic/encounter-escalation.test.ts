import { describe, expect, it } from "vitest";

import {
  Backdrops,
  ENCOUNTERS,
  ENEMIES,
  EncounterIds,
  ESCALATION_LADDER,
  encounterDifficulty,
  isStrictlyEscalating,
} from "../../src/content";

// The set of valid backdrop ids, for schema-validity checks.
const BACKDROP_IDS = new Set<string>(Object.values(Backdrops));

describe("encounter escalation: the ladder is a real run (#108 AC)", () => {
  it("offers at least four ATB encounters", () => {
    // ">=4 distinct ATB encounters are playable across the run".
    expect(ESCALATION_LADDER.length).toBeGreaterThanOrEqual(4);
  });

  it("lists every encounter exactly once (no repeats)", () => {
    const ids = [...ESCALATION_LADDER];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("references only schema-valid encounters, enemies, and backdrops", () => {
    for (const id of ESCALATION_LADDER) {
      const def = ENCOUNTERS[id];
      expect(def).toBeDefined();
      expect(def.id).toBe(id);
      // At least one enemy, each resolving to a defined ENEMIES row.
      expect(def.enemies.length).toBeGreaterThanOrEqual(1);
      for (const enemyId of def.enemies) {
        expect(ENEMIES[enemyId]).toBeDefined();
        expect(ENEMIES[enemyId].id).toBe(enemyId);
      }
      // The backdrop is one of the defined Backdrops values.
      expect(BACKDROP_IDS.has(def.backdrop)).toBe(true);
    }
  });
});

describe("encounter escalation: difficulty escalates (#108 AC)", () => {
  it("reports strictly-increasing difficulty across the ladder", () => {
    expect(isStrictlyEscalating(ESCALATION_LADDER)).toBe(true);
  });

  it("has strictly-increasing raw difficulty scores on every adjacent step", () => {
    const scores = ESCALATION_LADDER.map(id =>
      encounterDifficulty(ENCOUNTERS[id])
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]!).toBeGreaterThan(scores[i - 1]!);
    }
  });
});

describe("encounter escalation: difficulty metric is pure (#108)", () => {
  it("is deterministic — the same encounter yields the identical score twice", () => {
    for (const id of ESCALATION_LADDER) {
      const def = ENCOUNTERS[id];
      expect(encounterDifficulty(def)).toBe(encounterDifficulty(def));
    }
  });

  it("derives a higher score for a strictly stronger lineup", () => {
    // The lone Ashling boss must out-score the lone tutorial enforcer — the
    // metric reads the existing stat blocks, so the heavier block wins.
    const boss = encounterDifficulty(ENCOUNTERS[EncounterIds.theCage]);
    const tutorial = encounterDifficulty(
      ENCOUNTERS[EncounterIds.tutorialAmbush]
    );
    expect(boss).toBeGreaterThan(tutorial);
  });
});

describe("encounter escalation: validator correctness (#108)", () => {
  it("rejects a descending ladder", () => {
    expect(
      isStrictlyEscalating([EncounterIds.theCage, EncounterIds.tutorialAmbush])
    ).toBe(false);
  });

  it("rejects a flat ladder of one encounter repeated", () => {
    expect(
      isStrictlyEscalating([EncounterIds.theDrip, EncounterIds.theDrip])
    ).toBe(false);
  });

  it("accepts a known-good ascending pair", () => {
    expect(
      isStrictlyEscalating([EncounterIds.tutorialAmbush, EncounterIds.theCage])
    ).toBe(true);
  });

  it("treats a zero- or single-step ladder as vacuously escalating", () => {
    expect(isStrictlyEscalating([])).toBe(true);
    expect(isStrictlyEscalating([EncounterIds.theDrip])).toBe(true);
  });
});

describe("encounter escalation: reuses the Phase-2 core (#108)", () => {
  it("draws every ladder enemy from the existing ENEMIES table", () => {
    // The structural proof of "no parallel combat schema": every enemy in every
    // ladder encounter is an existing ENEMIES key (we authored no new engine).
    const enemyKeys = new Set<string>(Object.keys(ENEMIES));
    for (const id of ESCALATION_LADDER) {
      for (const enemyId of ENCOUNTERS[id].enemies) {
        expect(enemyKeys.has(enemyId)).toBe(true);
      }
    }
  });

  it("conforms every ladder entry to the existing EncounterDef shape", () => {
    for (const id of ESCALATION_LADDER) {
      const def = ENCOUNTERS[id];
      expect(typeof def.id).toBe("string");
      expect(Array.isArray(def.enemies)).toBe(true);
      expect(typeof def.backdrop).toBe("string");
    }
  });
});
