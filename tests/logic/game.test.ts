import { describe, expect, it } from "vitest";
import { GameSim } from "../../src/logic/game";
import { Tunables } from "../../src/consts";

const POOL_EMPTY = "item pool is empty";

describe("GameSim", () => {
  it("starts playing with full lives and zero score", () => {
    const sim = new GameSim(1);
    expect(sim.status).toBe("playing");
    expect(sim.lives).toBe(Tunables.startingLives);
    expect(sim.score).toBe(0);
  });

  it("moves the player by intent and clamps to the field", () => {
    const sim = new GameSim(1);
    const start = sim.playerX;
    sim.advance(0.1, 1);
    expect(sim.playerX).toBeGreaterThan(start);

    for (let i = 0; i < 200; i++) {
      sim.advance(0.1, 1);
    }
    expect(sim.playerX).toBeLessThanOrEqual(
      Tunables.width - Tunables.playerHalfWidth
    );

    for (let i = 0; i < 400; i++) {
      sim.advance(0.1, -1);
    }
    expect(sim.playerX).toBeGreaterThanOrEqual(Tunables.playerHalfWidth);
  });

  it("scores when an item reaches the player", () => {
    const sim = new GameSim(1);
    const item = sim.items[0];
    expect(item).toBeDefined();
    if (!item) {
      return;
    }
    item.active = true;
    item.x = sim.playerX;
    item.y = Tunables.playerY - 1;
    const result = sim.advance(0.1, 0);
    expect(sim.score).toBe(1);
    expect(result.caught).toBe(1);
    expect(result.scoreChanged).toBe(true);
  });

  it("loses a life when an item is missed", () => {
    const sim = new GameSim(1);
    const item = sim.items[0];
    if (!item) {
      throw new Error(POOL_EMPTY);
    }
    item.active = true;
    item.x = sim.playerX + Tunables.catchRadius + 100;
    item.y = Tunables.playerY - 1;
    const result = sim.advance(0.1, 0);
    expect(sim.lives).toBe(Tunables.startingLives - 1);
    expect(result.missed).toBe(1);
  });

  it("ends after lives are exhausted, then no-ops", () => {
    const sim = new GameSim(1);
    let lastGameOver = false;
    for (let n = 0; n < Tunables.startingLives; n++) {
      const item = sim.items[0];
      if (!item) {
        throw new Error(POOL_EMPTY);
      }
      item.active = true;
      item.x = 100000;
      item.y = Tunables.playerY - 1;
      lastGameOver = sim.advance(0.1, 0).gameOver;
    }
    expect(sim.status).toBe("over");
    expect(sim.lives).toBe(0);
    expect(lastGameOver).toBe(true);

    const before = sim.score;
    sim.advance(0.1, 0);
    expect(sim.score).toBe(before);
  });

  it("is deterministic for a given seed and input sequence", () => {
    const run = (): { score: number; lives: number; player: number } => {
      const sim = new GameSim(42);
      for (let i = 0; i < 600; i++) {
        sim.advance(1 / 60, i % 2 === 0 ? 1 : -1);
      }
      return { score: sim.score, lives: sim.lives, player: sim.playerX };
    };
    expect(run()).toEqual(run());
  });

  it("resets to a fresh run", () => {
    const sim = new GameSim(1);
    const item = sim.items[0];
    if (!item) {
      throw new Error(POOL_EMPTY);
    }
    item.active = true;
    item.x = 100000;
    item.y = Tunables.playerY - 1;
    sim.advance(0.1, 0);
    sim.reset(2);
    expect(sim.score).toBe(0);
    expect(sim.lives).toBe(Tunables.startingLives);
    expect(sim.status).toBe("playing");
    expect(sim.activeItemCount()).toBe(0);
  });
});
