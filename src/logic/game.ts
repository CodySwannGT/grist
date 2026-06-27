/**
 * Pure, engine-free game simulation for the "collector" vertical slice: a player
 * slides left/right to catch items falling from the top; a missed item costs a
 * life. This module imports NO Phaser — it takes plain data in and mutates plain
 * state, which is what makes the game unit-testable and deterministic. Scenes are
 * thin adapters that render this state and feed it input.
 * @module logic/game
 */
import { Rng } from "./rng";
import { Tunables } from "../consts";

/** Run state of the simulation. */
type GameStatus = "playing" | "over";

/**
 * Clamp a value into [min, max].
 * @param value - Value to clamp.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * One falling item. Items are pooled and reused — never allocated per frame.
 */
class Item {
  x = 0;
  y = 0;
  active = false;
}

/**
 * Outcome of a single {@link GameSim.advance} step, for scenes/HUD to react to.
 * A single instance is reused each step (no per-frame allocation).
 */
export class AdvanceResult {
  caught = 0;
  missed = 0;
  scoreChanged = false;
  gameOver = false;

  /**
   * Reset all fields to their empty state.
   * @returns void
   */
  reset(): void {
    this.caught = 0;
    this.missed = 0;
    this.scoreChanged = false;
    this.gameOver = false;
  }
}

/**
 * The collector simulation. Deterministic given a seed; advance one step per
 * frame with a delta and a movement intent (-1, 0, or 1).
 */
export class GameSim {
  readonly width = Tunables.width;
  score = 0;
  lives: number = Tunables.startingLives;
  playerX = Tunables.width / 2;
  status: GameStatus = "playing";
  readonly items: readonly Item[] = Array.from(
    { length: Tunables.maxItems },
    () => new Item()
  );

  readonly #rng: Rng;
  readonly #result = new AdvanceResult();
  #spawnTimer = 0;

  /**
   * Create a new simulation.
   * @param seed - Seed for the deterministic spawn RNG.
   */
  constructor(seed: number) {
    this.#rng = new Rng(seed);
  }

  /**
   * Reset to a fresh run with a new seed.
   * @param seed - Seed for the deterministic spawn RNG.
   * @returns void
   */
  reset(seed: number): void {
    this.score = 0;
    this.lives = Tunables.startingLives;
    this.playerX = Tunables.width / 2;
    this.status = "playing";
    this.#spawnTimer = 0;
    this.#rng.reseed(seed);
    for (const item of this.items) {
      item.active = false;
    }
  }

  /**
   * Advance the simulation one step.
   * @param dtSeconds - Elapsed time in seconds since the last step.
   * @param intent - Movement intent: -1 (left), 0 (still), or 1 (right).
   * @returns The reused result describing what happened this step.
   */
  advance(dtSeconds: number, intent: number): AdvanceResult {
    const result = this.#result;
    result.reset();
    if (this.status === "over") {
      return result;
    }

    this.playerX = clamp(
      this.playerX + intent * Tunables.playerSpeed * dtSeconds,
      Tunables.playerHalfWidth,
      this.width - Tunables.playerHalfWidth
    );

    this.#spawnTimer += dtSeconds;
    if (this.#spawnTimer >= Tunables.spawnInterval) {
      this.#spawnTimer -= Tunables.spawnInterval;
      this.#spawn();
    }

    for (const item of this.items) {
      if (!item.active) {
        continue;
      }
      item.y += Tunables.itemFallSpeed * dtSeconds;
      if (item.y >= Tunables.playerY) {
        this.#resolveLanding(item);
      }
    }

    return result;
  }

  /**
   * Resolve an item that reached the catch line: caught (score) or missed
   * (life), updating the reused result and run status.
   * @param item - The landed item; deactivated here.
   * @returns void
   */
  #resolveLanding(item: Item): void {
    item.active = false;
    const result = this.#result;
    if (Math.abs(item.x - this.playerX) <= Tunables.catchRadius) {
      this.score += 1;
      result.caught += 1;
      result.scoreChanged = true;
      return;
    }
    this.lives -= 1;
    result.missed += 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = "over";
      result.gameOver = true;
    }
  }

  /**
   * Number of currently-active (falling) items.
   * @returns The active item count.
   */
  activeItemCount(): number {
    return this.items.filter(item => item.active).length;
  }

  /**
   * Activate a pooled item at a deterministic random x above the field.
   * @returns void
   */
  #spawn(): void {
    const item = this.items.find(candidate => !candidate.active);
    if (!item) {
      return;
    }
    item.active = true;
    item.x = this.#rng.range(
      Tunables.itemRadius,
      this.width - Tunables.itemRadius
    );
    item.y = -Tunables.itemRadius;
  }
}
