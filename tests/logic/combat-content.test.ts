import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { Elements, SpellTargets, Statuses } from "../../src/logic/combat";
import {
  BOUNDS,
  BoundIds,
  ENCOUNTERS,
  ENEMIES,
  EncounterIds,
  EnemyIds,
  PARTY,
  PartyMemberIds,
  SPELLS,
  SpellIds,
  type EncounterDef,
} from "../../src/content";

/**
 * Recursively collect every `.ts` source file under a directory.
 * @param dir - Absolute directory path.
 * @returns Absolute paths of all `.ts` files found.
 */
function collectTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectTsFiles(full);
    }
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

// A quoted `phaser` module specifier — the only way phaser enters a module is an
// `import`/`export ... from`/`require` of it, so a quoted "phaser" (or "phaser/…")
// is sufficient proof of a dependency on the engine.
const PHASER_IMPORT = /["']phaser(?:\/[^"']*)?["']/;

describe("combat content: keys resolve (AC1)", () => {
  it("every Phase-1 encounter references only defined enemy keys", () => {
    for (const encounter of Object.values(ENCOUNTERS)) {
      for (const enemyId of encounter.enemies) {
        expect(ENEMIES[enemyId]).toBeDefined();
        expect(ENEMIES[enemyId].id).toBe(enemyId);
      }
    }
  });

  it("every shard teaches and binds only defined spell keys", () => {
    for (const bound of Object.values(BOUNDS)) {
      for (const spellId of bound.teaches) {
        expect(SPELLS[spellId]).toBeDefined();
      }
      expect(bound.bind.id).toBeTruthy();
      expect(Object.values(SpellIds)).toContain(bound.bind.id);
    }
  });

  it("each party member's shard reference resolves to a defined Bound", () => {
    const wren = PARTY[PartyMemberIds.wren];
    expect(wren.shard).toBe(BoundIds.emberwisp);
    expect(BOUNDS[BoundIds.emberwisp]).toBeDefined();
  });
});

describe("combat content: stat tables match the vertical-slice-build (AC2)", () => {
  it("Wren is Lv3 HP120 AP20 POW18 SPD14", () => {
    const wren = PARTY[PartyMemberIds.wren];
    expect(wren.level).toBe(3);
    expect(wren.baseStats.hp).toBe(120);
    expect(wren.baseStats.ap).toBe(20);
    expect(wren.baseStats.pow).toBe(18);
    expect(wren.baseStats.spd).toBe(14);
  });

  it("Tobi is Lv3 HP140 AP24", () => {
    const tobi = PARTY[PartyMemberIds.tobi];
    expect(tobi.level).toBe(3);
    expect(tobi.baseStats.hp).toBe(140);
    expect(tobi.baseStats.ap).toBe(24);
  });

  it("Spark is Flux / AP4 / power12 / single target", () => {
    const spark = SPELLS[SpellIds.spark];
    expect(spark.element).toBe(Elements.flux);
    expect(spark.apCost).toBe(4);
    expect(spark.power).toBe(12);
    expect(spark.target).toBe(SpellTargets.one);
  });

  it("Bind: Wisp is Flux / AoE / grist8", () => {
    const emberwisp = BOUNDS[BoundIds.emberwisp];
    expect(emberwisp.bind.element).toBe(Elements.flux);
    expect(emberwisp.bind.target).toBe(SpellTargets.all);
    expect(emberwisp.bind.gristCost).toBe(8);
  });

  it("Cinder is Flux-opposed Ash / AP5 / power16 and Render applies Rendering", () => {
    const cinder = SPELLS[SpellIds.cinder];
    expect(cinder.element).toBe(Elements.ash);
    expect(cinder.apCost).toBe(5);
    expect(cinder.power).toBe(16);
    const render = SPELLS[SpellIds.render];
    expect(render.element).toBe(Elements.ash);
    expect(render.apCost).toBe(6);
    expect(render.status).toBe(Statuses.rendering);
  });

  it("each enemy carries the spec'd HP, weakness, and loot-grist", () => {
    const scrapper = ENEMIES[EnemyIds.marrowScrapper];
    expect(scrapper.stats.hp).toBe(40);
    expect(scrapper.lootGrist).toBe(6);
    expect(scrapper.elements[Elements.flux]).toBeUndefined();

    const construct = ENEMIES[EnemyIds.renderConstruct];
    expect(construct.stats.hp).toBe(70);
    expect(construct.lootGrist).toBe(10);
    expect(construct.elements[Elements.flux]).toBeGreaterThan(1);

    const ashling = ENEMIES[EnemyIds.theAshling];
    expect(ashling.stats.hp).toBe(220);
    expect(ashling.lootGrist).toBe(20);
    expect(ashling.elements[Elements.flux]).toBeGreaterThan(1);
  });

  it("the Emberwisp shard teaches Spark with a +SPD growth bias and no corruption", () => {
    const emberwisp = BOUNDS[BoundIds.emberwisp];
    expect(emberwisp.teaches).toContain(SpellIds.spark);
    expect(emberwisp.growthBias.spd).toBeGreaterThan(0);
    expect(emberwisp.corruptionRate).toBe(0);
  });

  it("the Marrow Bound teaches Cinder and Render with a +FOC growth bias", () => {
    const marrow = BOUNDS[BoundIds.marrowBound];
    expect(marrow.teaches).toContain(SpellIds.cinder);
    expect(marrow.teaches).toContain(SpellIds.render);
    expect(marrow.growthBias.foc).toBeGreaterThan(0);
  });
});

describe("combat content: imports no Phaser (AC3)", () => {
  it("no module under src/content or src/logic/combat imports phaser", () => {
    const roots = [
      fileURLToPath(new URL("../../src/content", import.meta.url)),
      fileURLToPath(new URL("../../src/logic/combat", import.meta.url)),
    ];
    const files = roots.flatMap(collectTsFiles);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter(file =>
      PHASER_IMPORT.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});

describe("combat content: encounter loadout shape (AC4 interim)", () => {
  it("the Phase-1 party is exactly the two spec'd combatants with HP/AP", () => {
    const party = Object.values(PARTY);
    expect(party).toHaveLength(2);
    for (const member of party) {
      expect(member.baseStats.hp).toBeGreaterThan(0);
      expect(member.baseStats.ap).toBeGreaterThan(0);
    }
  });

  it("the boss encounter resolves N enemy combatants carrying HP", () => {
    const cage = ENCOUNTERS[EncounterIds.theCage];
    expect(cage.enemies.length).toBeGreaterThanOrEqual(1);
    for (const enemyId of cage.enemies) {
      expect(ENEMIES[enemyId].stats.hp).toBeGreaterThan(0);
    }
  });

  it("the full slice exercises all three authored enemies", () => {
    const referenced = new Set(
      Object.values(ENCOUNTERS).flatMap(encounter => [...encounter.enemies])
    );
    expect(referenced).toEqual(new Set(Object.keys(ENEMIES)));
  });
});

describe("combat content: typed keys reject undefined references (AC1)", () => {
  it("an out-of-set enemy id is a compile error", () => {
    const invalid: EncounterDef = {
      id: "ghost-fight",
      // @ts-expect-error - "ghost-enemy" is not a defined EnemyId, so the
      // typed-union key rejects it at compile time (this is the guarantee).
      enemies: ["ghost-enemy"],
      backdrop: "marrow",
    };
    expect(invalid.enemies).toHaveLength(1);
  });
});
