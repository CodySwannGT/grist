import { describe, expect, it } from "vitest";

import { Elements, Statuses } from "../../src/logic/combat";
import {
  BENCH_SINKS,
  BenchSinkIds,
  BOUNDS,
  BoundIds,
  ENCOUNTERS,
  ENEMIES,
  EncounterIds,
  EnemyIds,
  MARROW_MAP,
  MarrowRoomIds,
  SLICE_ECONOMY,
  SLICE_EARN,
  SliceEarnSourceIds,
  SPELLS,
  SpellIds,
} from "../../src/content";
import { GristTuning } from "../../src/logic/grist";

/**
 * Slice content modules (#79 / VS-2.0). These cases assert the genuinely-new
 * slice data that extends the Phase-1 tables: the Render-construct's canonical
 * name "Vesper" + its Rendering teach, the Ashling's self-element Ash +
 * Break-gated phase-1 flag + shard reward, the Ashling shard's free/wield
 * variants, the bench sinks, the slice economy earn table, and the 3-room
 * Marrow map with props and encounter triggers. Exact, deterministic numbers
 * from the vertical-slice-build.
 */

describe("slice enemy + boss data (#79 AC: enemies)", () => {
  it('the Render-construct is named "Vesper", HP70, Flux-weak, teaches Rendering, loot 10', () => {
    const vesper = ENEMIES[EnemyIds.renderConstruct];
    expect(vesper.name).toContain("Vesper");
    expect(vesper.stats.hp).toBe(70);
    expect(vesper.elements[Elements.flux]).toBeGreaterThan(1);
    expect(vesper.teaches).toContain(Statuses.rendering);
    expect(vesper.lootGrist).toBe(10);
  });

  it("the Ashling is HP220, element Ash, Flux-weak phase 1, Break-gated, loot 20 + shard", () => {
    const ashling = ENEMIES[EnemyIds.theAshling];
    expect(ashling.stats.hp).toBe(220);
    expect(ashling.element).toBe(Elements.ash);
    expect(ashling.elements[Elements.flux]).toBeGreaterThan(1);
    expect(ashling.breakGatedPhase1).toBe(true);
    expect(ashling.lootGrist).toBe(20);
    expect(ashling.shardReward).toBe(BoundIds.marrowBound);
    expect(BOUNDS[ashling.shardReward!]).toBeDefined();
  });

  it("the Marrow scrapper stays HP40 loot 6 (Phase-1 carry-over not regressed)", () => {
    const scrapper = ENEMIES[EnemyIds.marrowScrapper];
    expect(scrapper.stats.hp).toBe(40);
    expect(scrapper.lootGrist).toBe(6);
  });
});

describe("slice shards: Ashling shard free/wield variants (#79 AC: shards)", () => {
  it("the Ashling shard teaches Cinder + Render with +FOC bias", () => {
    const marrow = BOUNDS[BoundIds.marrowBound];
    expect(marrow.teaches).toContain(SpellIds.cinder);
    expect(marrow.teaches).toContain(SpellIds.render);
    expect(marrow.growthBias.foc).toBeGreaterThan(0);
  });

  it("Cinder is Ash / AP5 / power16 and Render is Ash / AP6 / Rendering", () => {
    const marrow = BOUNDS[BoundIds.marrowBound];
    expect(marrow.element).toBe(Elements.ash);

    // The shard's taught spell payloads — what the case title locks.
    const cinder = SPELLS[SpellIds.cinder];
    expect(cinder.element).toBe(Elements.ash);
    expect(cinder.apCost).toBe(5);
    expect(cinder.power).toBe(16);
    const render = SPELLS[SpellIds.render];
    expect(render.element).toBe(Elements.ash);
    expect(render.apCost).toBe(6);
    expect(render.status).toBe(Statuses.rendering);

    // free variant: no corruption; wield variant: corruption accrues.
    expect(marrow.variants.free.corruptionRate).toBe(0);
    expect(marrow.variants.wield.corruptionRate).toBeGreaterThan(0);
  });
});

describe("slice bench sinks (#79 AC: bench)", () => {
  it("the bench offers Runner's Reflex (+2 SPD, 25 grist)", () => {
    const reflex = BENCH_SINKS[BenchSinkIds.runnersReflex];
    expect(reflex.gristCost).toBe(25);
    expect(reflex.statBonus?.spd).toBe(2);
  });

  it("the bench offers accelerate-Cinder (20 grist)", () => {
    const accel = BENCH_SINKS[BenchSinkIds.accelerateCinder];
    expect(accel.gristCost).toBe(20);
    expect(accel.teaches).toBe(SpellIds.cinder);
  });
});

describe("slice economy (#79 AC: economy 10, earn 6/10/12/20)", () => {
  it("the party starts at 10 grist (matches the wallet tuning)", () => {
    expect(SLICE_ECONOMY.startingGrist).toBe(10);
    expect(SLICE_ECONOMY.startingGrist).toBe(GristTuning.startingGrist);
  });

  it("the earn sources are exactly 6, 10, 12, 20", () => {
    const amounts = Object.values(SLICE_EARN)
      .map(source => source.grist)
      .sort((a, b) => a - b);
    expect(amounts).toEqual([6, 10, 12, 20]);
  });

  it("the salvage-cache source supplies the off-enemy 12 grist", () => {
    expect(SLICE_EARN[SliceEarnSourceIds.salvageCache].grist).toBe(12);
  });

  it("each enemy-loot earn source matches its enemy's lootGrist", () => {
    expect(SLICE_EARN[SliceEarnSourceIds.scrapper].grist).toBe(
      ENEMIES[EnemyIds.marrowScrapper].lootGrist
    );
    expect(SLICE_EARN[SliceEarnSourceIds.vesper].grist).toBe(
      ENEMIES[EnemyIds.renderConstruct].lootGrist
    );
    expect(SLICE_EARN[SliceEarnSourceIds.ashling].grist).toBe(
      ENEMIES[EnemyIds.theAshling].lootGrist
    );
  });
});

describe("slice 3-room map (#79 AC: map)", () => {
  it("defines rooms A (Warren Street), B (The Drip), C (The Cage)", () => {
    expect(MARROW_MAP[MarrowRoomIds.a].name).toContain("Warren Street");
    expect(MARROW_MAP[MarrowRoomIds.b].name).toContain("The Drip");
    expect(MARROW_MAP[MarrowRoomIds.c].name).toContain("The Cage");
  });

  it("each room carries at least one prop", () => {
    for (const room of Object.values(MARROW_MAP)) {
      expect(room.props.length).toBeGreaterThan(0);
    }
  });

  it("each room's encounter trigger resolves to a defined encounter", () => {
    expect(MARROW_MAP[MarrowRoomIds.a].encounter).toBe(
      EncounterIds.warrenStreet
    );
    expect(MARROW_MAP[MarrowRoomIds.b].encounter).toBe(EncounterIds.theDrip);
    expect(MARROW_MAP[MarrowRoomIds.c].encounter).toBe(EncounterIds.theCage);
    for (const room of Object.values(MARROW_MAP)) {
      expect(ENCOUNTERS[room.encounter]).toBeDefined();
    }
  });
});
