/**
 * The verification bridge's world-state cell (#134) — a tiny in-memory holder the
 * `__VERIFY__` bridge owns so the world-state e2e can flip and read the Act I
 * *reach* / Act II *ashfall* flag scene-agnostically, while the canonical flag
 * still rides the persisted save (`logic/save`). The cell only *holds* the value;
 * all flip + resolve *semantics* live in `logic/world`, which this delegates to —
 * the bridge never re-implements the rules.
 *
 * Extracted from `uat/bridge.ts` so the bridge stays under its line budget and the
 * world-state seam is independently readable. Zero Phaser, no I/O, no RNG.
 * @module uat/world-state-cell
 */
import {
  reckon,
  resolveByWorldState,
  type WorldState,
  type WorldStateResolver,
} from "../logic/world";

/**
 * A demonstrative resolver the cell reads through the live flag, so an e2e can
 * observe a resolver returning its Ashfall value the instant the Reckoning fires.
 * Stands in for the region/encounter/economy resolvers the content layer (#133)
 * will author — the framework, not the content. Region "tone" reads `"verdant"`
 * in Act I `reach` and `"ashen"` in Act II `ashfall`.
 */
const REGION_TONE: WorldStateResolver<string> = {
  reach: "verdant",
  ashfall: "ashen",
};

/**
 * The bridge-held world-state cell: adopt a flag, flip it via the Reckoning, and
 * read it (or a resolver through it). `null` until a save/`adopt` seeds one, so a
 * stray flip on a fresh boot cannot fabricate a state.
 */
export class WorldStateCell {
  #worldState: WorldState | null = null;

  /**
   * Adopt a world-state into the cell — the seam the persistence path uses so a
   * restored save's flag becomes readable in memory. Pure: stores the value.
   * @param worldState - The world-state to hold (`reach` or `ashfall`).
   * @returns void
   */
  adopt(worldState: WorldState): void {
    this.#worldState = worldState;
  }

  /**
   * The held world-state, or null before one has been adopted.
   * @returns The held world-state, or null.
   */
  read(): WorldState | null {
    return this.#worldState;
  }

  /**
   * Apply the Reckoning {@link reckon} flip to the held world-state (`reach` →
   * `ashfall`, idempotent), delegating the semantics to `logic/world`. No-op until
   * a world-state has been adopted. The flip consumes no RNG.
   * @returns void
   */
  reckon(): void {
    if (this.#worldState !== null) {
      this.#worldState = reckon(this.#worldState);
    }
  }

  /**
   * The region tone resolved *through* the held flag — a demonstrative
   * {@link resolveByWorldState} read proving resolvers switch to their Ashfall
   * value once {@link WorldStateCell.reckon} fires (`"verdant"` in `reach`,
   * `"ashen"` in `ashfall`). Null before a world-state is adopted.
   * @returns The resolved region tone, or null.
   */
  regionTone(): string | null {
    return this.#worldState === null
      ? null
      : resolveByWorldState(this.#worldState, REGION_TONE);
  }
}
