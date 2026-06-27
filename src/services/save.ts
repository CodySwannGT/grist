/**
 * SaveService — typed, versioned persistence over localStorage with a migration
 * chain. Game code must never touch localStorage directly (lint-enforced); it
 * goes through this service so the on-disk schema can evolve safely. This file
 * lives under src/services, the one place the storage ban is relaxed.
 * @module services/save
 */

const SAVE_KEY = "phaser-starter:save";
const CURRENT_VERSION = 1;

/** Versioned save payload. Bump the version and extend the migration chain when the shape changes. */
interface SaveDataV1 {
  readonly version: 1;
  readonly highScore: number;
}

/** The current save shape (alias the latest version). */
type SaveData = SaveDataV1;

/**
 * Migrate an unknown parsed payload to the current schema. Unknown/corrupt input
 * collapses to a fresh save. Extend this chain (v1→v2→…) as the schema evolves.
 * @param raw - Parsed-but-untrusted localStorage value.
 * @returns A valid current-version save.
 */
function migrate(raw: unknown): SaveData {
  const fresh: SaveData = { version: CURRENT_VERSION, highScore: 0 };
  if (typeof raw !== "object" || raw === null) {
    return fresh;
  }
  const record = raw as Record<string, unknown>;
  const highScore = record["highScore"];
  if (typeof highScore !== "number" || !Number.isFinite(highScore)) {
    return fresh;
  }
  return {
    version: CURRENT_VERSION,
    highScore: Math.max(0, Math.floor(highScore)),
  };
}

/** Reads and writes the player's persistent save. */
export class SaveService {
  #data: SaveData;

  /** Load the existing save (or a fresh one) from storage. */
  constructor() {
    this.#data = this.#load();
  }

  /**
   * The best score recorded so far.
   * @returns The high score.
   */
  get highScore(): number {
    return this.#data.highScore;
  }

  /**
   * Record a finished run's score, persisting it if it's a new best.
   * @param score - The score from the run that just ended.
   * @returns True if this set a new high score.
   */
  recordScore(score: number): boolean {
    if (score <= this.#data.highScore) {
      return false;
    }
    this.#data = { version: CURRENT_VERSION, highScore: score };
    this.#persist();
    return true;
  }

  /**
   * Load + migrate the save from localStorage, tolerating absence/corruption.
   * @returns The loaded (or fresh) save.
   */
  #load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw === null) {
        return { version: CURRENT_VERSION, highScore: 0 };
      }
      return migrate(JSON.parse(raw));
    } catch {
      // Unavailable or corrupt storage — start fresh rather than crash.
      return { version: CURRENT_VERSION, highScore: 0 };
    }
  }

  /**
   * Persist the current save, ignoring storage failures (e.g. private mode).
   * @returns void
   */
  #persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.#data));
    } catch {
      // Storage may be unavailable (private mode, quota) — saving is best-effort.
    }
  }
}
