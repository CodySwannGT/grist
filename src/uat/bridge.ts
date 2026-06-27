/**
 * Verification (UAT) test bridge. Exposes a tiny, typed `window.__VERIFY__` API
 * so the Playwright verification suite can drive the canvas deterministically:
 * seed the RNG, read live game state, and inject a held movement intent. It is
 * OFF in normal builds — enabled only in dev or when the page is loaded with
 * `?uat=1`, and never referenced by gameplay code outside this module.
 * @module uat/bridge
 */
import type { GameSim } from "../logic/game";

/** Position of one active falling item. */
interface VerifyItem {
  readonly x: number;
  readonly y: number;
}

/** A read-only snapshot of the running simulation for assertions. */
interface VerifyState {
  readonly scene: string;
  readonly score: number;
  readonly lives: number;
  readonly status: string;
  readonly playerX: number;
  readonly activeItems: number;
  readonly items: readonly VerifyItem[];
}

/** The shape installed on `window.__VERIFY__`. */
interface VerifyApi {
  readonly scene: () => string;
  readonly state: () => VerifyState | null;
  readonly setIntent: (intent: number) => void;
  readonly clearIntent: () => void;
  readonly seed: (seed: number) => void;
}

declare global {
  /** Augments the browser Window with the optional verification bridge. */
  interface Window {
    __VERIFY__?: VerifyApi;
  }
}

/**
 * Holds the live links between the running scene/sim and the test bridge.
 * Gameplay reads `intentOverride()`/`takeSeed()`; the bridge reads `state()`.
 */
class VerifyController {
  #sceneKey = "";
  #sim: GameSim | null = null;
  #intentOverride: number | null = null;
  #pendingSeed: number | null = null;

  /**
   * Link the active scene + sim so the bridge can observe them.
   * @param sceneKey - The active scene's key.
   * @param sim - The running simulation, or null for non-game scenes.
   * @returns void
   */
  attach(sceneKey: string, sim: GameSim | null): void {
    this.#sceneKey = sceneKey;
    this.#sim = sim;
  }

  /**
   * Consume a seed queued by the bridge (one-shot).
   * @returns The pending seed, or null if none was set.
   */
  takeSeed(): number | null {
    const seed = this.#pendingSeed;
    this.#pendingSeed = null;
    return seed;
  }

  /**
   * The currently injected movement intent, if the bridge is steering.
   * @returns -1/0/1, or null when not overriding.
   */
  intentOverride(): number | null {
    return this.#intentOverride;
  }

  /**
   * The active scene key.
   * @returns The scene key.
   */
  scene(): string {
    return this.#sceneKey;
  }

  /**
   * A snapshot of the running sim, or null outside the Game scene.
   * @returns The current state or null.
   */
  state(): VerifyState | null {
    const sim = this.#sim;
    if (!sim) {
      return null;
    }
    return {
      scene: this.#sceneKey,
      score: sim.score,
      lives: sim.lives,
      status: sim.status,
      playerX: sim.playerX,
      activeItems: sim.activeItemCount(),
      items: sim.items
        .filter(item => item.active)
        .map(item => ({ x: item.x, y: item.y })),
    };
  }

  /**
   * Inject a held movement intent (the Game scene uses it instead of input).
   * @param intent - -1/0/1.
   * @returns void
   */
  setIntent(intent: number): void {
    this.#intentOverride = intent;
  }

  /**
   * Stop overriding input; return control to the InputService.
   * @returns void
   */
  clearIntent(): void {
    this.#intentOverride = null;
  }

  /**
   * Queue a seed for the next Game run (call before starting it).
   * @param seed - The seed.
   * @returns void
   */
  seed(seed: number): void {
    this.#pendingSeed = seed;
  }
}

/** The shared verification controller (also read by gameplay code). */
export const verifyBridge = new VerifyController();

/**
 * Whether the verification bridge should be exposed on `window`.
 * @returns True in dev or when loaded with `?uat=1`.
 */
function isEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  return new URLSearchParams(window.location.search).has("uat");
}

/**
 * Install `window.__VERIFY__` when enabled. Called once at bootstrap.
 * @returns void
 */
export function installVerifyBridge(): void {
  if (!isEnabled()) {
    return;
  }
  window.__VERIFY__ = {
    scene: () => verifyBridge.scene(),
    state: () => verifyBridge.state(),
    setIntent: (intent: number) => verifyBridge.setIntent(intent),
    clearIntent: () => verifyBridge.clearIntent(),
    seed: (seed: number) => verifyBridge.seed(seed),
  };
}
