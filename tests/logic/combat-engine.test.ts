import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  advanceToNextTurn,
  combatantAt,
  hashState,
  nextActor,
  readyActors,
  startBattle,
  step,
  type BattleAction,
  type BattleState,
  type Combatant,
  type CombatantRef,
} from "../../src/logic/combat";
import { ENCOUNTERS, ENEMIES, PARTY } from "../../src/content";

// The slice's "The Drip" lineup gives four distinct SPDs — Wren 14, Tobi 9,
// scrapper 8, construct 7 — a clean spread for ATB / turn-order assertions.
const wrenDef = PARTY.wren;
const tobiDef = PARTY.tobi;
const drip = ENCOUNTERS["the-drip"];

const WREN: CombatantRef = { side: "party", index: 0 };
const TOBI: CombatantRef = { side: "party", index: 1 };
const SCRAPPER: CombatantRef = { side: "enemies", index: 0 };
const CONSTRUCT: CombatantRef = { side: "enemies", index: 1 };

const wrenSpd = wrenDef.baseStats.spd;
const tobiSpd = tobiDef.baseStats.spd;
const scrapperSpd = ENEMIES["marrow-scrapper"].stats.spd;

/**
 * Fetch the combatant a ref points at, throwing if absent (test-only helper).
 * @param state - The battle state.
 * @param ref - The combatant ref.
 * @returns The combatant.
 */
function get(state: BattleState, ref: CombatantRef): Combatant {
  const found = combatantAt(state, ref);
  if (!found) {
    throw new Error(`no combatant at ${ref.side}#${ref.index}`);
  }
  return found;
}

/**
 * Start the canonical Wren + Tobi vs. The Drip battle.
 * @param seed - The battle seed.
 * @returns The initial battle state.
 */
function newBattle(seed: number): BattleState {
  return startBattle([wrenDef, tobiDef], drip, seed);
}

/**
 * Apply `n` ATB ticks.
 * @param state - The starting state.
 * @param n - Number of ticks.
 * @returns The advanced state.
 */
function ticks(state: BattleState, n: number): BattleState {
  let current = state;
  for (let i = 0; i < n; i++) {
    current = step(current, { kind: "tick" });
  }
  return current;
}

/**
 * Run a scripted action sequence, hashing the state after start and each step.
 * @param seed - The battle seed.
 * @param script - The actions to apply in order.
 * @returns The per-step hashes and the final state.
 */
function runScript(
  seed: number,
  script: readonly BattleAction[]
): { hashes: string[]; final: BattleState } {
  const hashes: string[] = [];
  let state = newBattle(seed);
  hashes.push(hashState(state));
  for (const action of script) {
    state = step(state, action);
    hashes.push(hashState(state));
  }
  return { hashes, final: state };
}

/**
 * Recursively freeze a value so any in-place mutation throws in strict mode.
 * @param value - The value to freeze.
 * @returns The same value, deeply frozen.
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Build a minimal combatant for synthetic turn-order states.
 * @param ref - The content ref.
 * @param spd - The SPD stat.
 * @param atb - The starting ATB gauge.
 * @returns A combatant.
 */
function makeCombatant(ref: string, spd: number, atb: number): Combatant {
  return {
    ref,
    stats: { hp: 1, ap: 0, pow: 0, foc: 0, def: 0, wrd: 0, spd, lck: 0 },
    hp: 1,
    ap: 0,
    atb,
    statuses: [],
    pressure: 0,
    broken: false,
  };
}

// A scripted mix of ticks and acting turns (acting turns consume seeded rolls).
const SCRIPT: readonly BattleAction[] = [
  { kind: "tick" },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "strike", actor: WREN, target: SCRAPPER },
  { kind: "tick" },
  { kind: "tick" },
  { kind: "craft", actor: TOBI, id: "spark", target: SCRAPPER },
  { kind: "tick" },
  { kind: "strike", actor: SCRAPPER, target: WREN },
];

describe("startBattle", () => {
  it("builds full-HP, empty-gauge combatants from the typed content", () => {
    const start = newBattle(9);
    expect(start.party).toHaveLength(2);
    expect(start.enemies).toHaveLength(2);
    expect(get(start, WREN).ref).toBe("wren");
    expect(get(start, WREN).hp).toBe(wrenDef.baseStats.hp);
    expect(get(start, WREN).ap).toBe(wrenDef.baseStats.ap);
    expect(get(start, WREN).atb).toBe(0);
    expect(get(start, WREN).broken).toBe(false);
    expect(get(start, WREN).statuses).toEqual([]);
    expect(get(start, SCRAPPER).ref).toBe("marrow-scrapper");
  });

  it("seeds the threaded RNG and opens in the select phase", () => {
    const start = newBattle(9);
    expect(start.seed).toBe(9);
    expect(start.rngState).toBe(9);
    expect(start.tick).toBe(0);
    expect(start.grist).toBe(0);
    expect(start.phase).toBe("select");
    expect(start.log).toEqual([]);
  });

  it("normalizes the seed to an unsigned 32-bit value", () => {
    expect(newBattle(-1).rngState).toBe(0xffffffff);
  });
});

describe("ATB engine — fill and turn order follow SPD (AC2)", () => {
  it("fills every gauge exactly proportionally to SPD", () => {
    const after = ticks(newBattle(1), 5); // 5 * 14 = 70, nothing clamps yet
    expect(get(after, WREN).atb).toBe(wrenSpd * 5);
    expect(get(after, TOBI).atb).toBe(tobiSpd * 5);
    expect(get(after, SCRAPPER).atb).toBe(scrapperSpd * 5);
    // Cross-multiplied ratio is exact (no float drift): wren/tobi == spd ratio.
    expect(get(after, WREN).atb * tobiSpd).toBe(get(after, TOBI).atb * wrenSpd);
    expect(readyActors(after)).toHaveLength(0);
  });

  it("clamps a full gauge at the ready threshold", () => {
    const after = ticks(newBattle(1), 100);
    expect(get(after, WREN).atb).toBe(100);
  });

  it("makes the highest-SPD ready combatant act first", () => {
    const ready = advanceToNextTurn(newBattle(1));
    expect(nextActor(ready)).toEqual(WREN);
  });

  it("orders all ready combatants by descending SPD", () => {
    const after = ticks(newBattle(1), 15); // every gauge full
    expect(readyActors(after)).toEqual([WREN, TOBI, SCRAPPER, CONSTRUCT]);
  });

  it("breaks SPD ties deterministically: party before enemies, then index", () => {
    const tie: BattleState = {
      party: [makeCombatant("a", 10, 100), makeCombatant("b", 10, 100)],
      enemies: [makeCombatant("c", 10, 100)],
      grist: 0,
      seed: 0,
      rngState: 0,
      tick: 0,
      phase: "select",
      log: [],
    };
    expect(readyActors(tie)).toEqual([
      { side: "party", index: 0 },
      { side: "party", index: 1 },
      { side: "enemies", index: 0 },
    ]);
  });

  it("reports no next actor before any gauge fills", () => {
    expect(nextActor(newBattle(1))).toBeNull();
  });

  it("advanceToNextTurn honors its safety bound", () => {
    const start = newBattle(1);
    expect(advanceToNextTurn(start, 0)).toBe(start);
  });
});

describe("determinism — same seed yields identical progression (AC1)", () => {
  it("produces identical per-step hashes across two identical runs", () => {
    const first = runScript(0xc0ffee, SCRIPT);
    const second = runScript(0xc0ffee, SCRIPT);
    expect(first.hashes).toEqual(second.hashes);
    expect(first.final.rngState).toBe(second.final.rngState);
  });

  it("diverges for a different seed (the RNG truly threads through state)", () => {
    const a = runScript(1, SCRIPT);
    const b = runScript(2, SCRIPT);
    expect(a.hashes).not.toEqual(b.hashes);
  });

  it("hashState is stable, hex, and reacts to any change", () => {
    const start = newBattle(5);
    expect(hashState(start)).toBe(hashState(newBattle(5)));
    expect(hashState(start)).toMatch(/^[0-9a-f]{8}$/);
    expect(hashState(start)).not.toBe(hashState(step(start, { kind: "tick" })));
  });

  it("hashState folds combatant statuses into the digest", () => {
    const base = makeCombatant("x", 10, 0);
    const withStatus: Combatant = {
      ...base,
      statuses: [{ id: "rendering", turns: 3 }],
    };
    const plain: BattleState = {
      party: [base],
      enemies: [],
      grist: 0,
      seed: 0,
      rngState: 0,
      tick: 0,
      phase: "select",
      log: [],
    };
    const afflicted: BattleState = { ...plain, party: [withStatus] };
    expect(hashState(plain)).not.toBe(hashState(afflicted));
    expect(hashState(afflicted)).toBe(
      hashState({ ...plain, party: [withStatus] })
    );
  });
});

describe("RNG threading", () => {
  it("an acting turn consumes one roll in [0,1) and advances rngState", () => {
    const start = newBattle(123);
    const next = step(start, { kind: "strike", actor: WREN, target: SCRAPPER });
    expect(next.rngState).not.toBe(start.rngState);
    const last = next.log.at(-1);
    expect(last?.kind).toBe("strike");
    expect(last?.roll).toBeGreaterThanOrEqual(0);
    expect(last?.roll).toBeLessThan(1);
  });

  it("a tick advances gauges without consuming the RNG", () => {
    const start = newBattle(123);
    const next = step(start, { kind: "tick" });
    expect(next.rngState).toBe(start.rngState);
    expect(next.log.at(-1)).toEqual({ tick: 1, kind: "tick" });
  });
});

describe("the reducer is pure (AC3)", () => {
  it("does not mutate a frozen input and returns fresh state", () => {
    const frozen = deepFreeze(newBattle(7));
    const next = step(frozen, { kind: "tick" });
    expect(next).not.toBe(frozen);
    expect(frozen.tick).toBe(0);
    expect(get(frozen, WREN).atb).toBe(0);
    expect(next.tick).toBe(1);
    expect(get(next, WREN).atb).toBe(wrenSpd);
  });

  it("structurally shares the untouched side (no needless copy, no mutation)", () => {
    const start = newBattle(7);
    const next = step(start, { kind: "strike", actor: WREN, target: SCRAPPER });
    expect(next.enemies).toBe(start.enemies);
    expect(next.party).not.toBe(start.party);
    expect(get(next, WREN).atb).toBe(0);
  });

  it("is a no-op for an actor-less or out-of-range action (totality)", () => {
    const start = newBattle(7);
    expect(step(start, { kind: "strike" })).toBe(start);
    expect(
      step(start, { kind: "strike", actor: { side: "enemies", index: 9 } })
    ).toBe(start);
  });
});

// A quoted `phaser` specifier is the only way the engine enters a module, so a
// quoted "phaser" (or "phaser/…") is sufficient proof of a dependency on it.
const PHASER_IMPORT = /["']phaser(?:\/[^"']*)?["']/;

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

describe("src/logic imports no Phaser (AC4)", () => {
  it("no module anywhere under src/logic imports phaser", () => {
    const root = fileURLToPath(new URL("../../src/logic", import.meta.url));
    const files = collectTsFiles(root);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter(file =>
      PHASER_IMPORT.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
