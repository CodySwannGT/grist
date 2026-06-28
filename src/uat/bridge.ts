/**
 * Verification (UAT) test bridge. Exposes a tiny, typed `window.__VERIFY__` API so
 * the Playwright verification suite can drive the canvas deterministically: read
 * the active scene, the live {@link BattleState}, and the integer render scale;
 * seed/restart the battle; and push a {@link BattleAction} into the sim. It is OFF
 * in normal builds — enabled only in dev or when the page is loaded with `?uat=1`
 * — and never referenced by gameplay code outside this module.
 *
 * This is the minimal battle-facing bridge CP-1.5 needs to prove its scene boots,
 * renders at 384×216 integer-scaled, and turns a Strike into an HP change. The
 * full determinism/replay surface lands with the verification sub-task (#40).
 * @module uat/bridge
 */
import {
  BattleSides,
  type BattleAction,
  type BattleState,
  type Combatant,
} from "../logic/combat";

/** A read-only snapshot of one combatant for assertions. */
interface VerifyCombatant {
  readonly ref: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly ap: number;
  readonly maxAp: number;
  readonly atb: number;
  readonly broken: boolean;
  readonly spent: boolean;
}

/** A read-only snapshot of the running battle for assertions. */
interface VerifyBattleState {
  readonly scene: string;
  readonly phase: string;
  readonly tick: number;
  readonly grist: number;
  readonly party: readonly VerifyCombatant[];
  readonly enemies: readonly VerifyCombatant[];
}

/** The integer render scale the ScaleManager resolved for the viewport. */
interface VerifyResolution {
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

/**
 * The live link a battle scene registers with the bridge: read its sim state and
 * resolved scale, restart it under a fresh seed, and feed it actions. Implemented
 * by the Battle scene; null for non-battle scenes (Boot / Preloader).
 */
export interface BattleView {
  readonly state: () => BattleState | null;
  readonly resolution: () => VerifyResolution;
  readonly restart: (seed: number) => void;
  readonly act: (action: BattleAction) => void;
}

/** The shape installed on `window.__VERIFY__`. */
interface VerifyApi {
  readonly scene: () => string;
  readonly state: () => VerifyBattleState | null;
  readonly resolution: () => VerifyResolution | null;
  readonly seed: (seed: number) => void;
  readonly act: (action: BattleAction) => void;
  readonly strike: () => void;
}

declare global {
  /** Augments the browser Window with the optional verification bridge. */
  interface Window {
    __VERIFY__?: VerifyApi;
  }
}

/**
 * Map a sim {@link Combatant} to its read-only verification snapshot.
 * @param combatant - The live combatant.
 * @returns The read-only snapshot.
 */
function toVerifyCombatant(combatant: Combatant): VerifyCombatant {
  return {
    ref: combatant.ref,
    hp: combatant.hp,
    maxHp: combatant.stats.hp,
    ap: combatant.ap,
    maxAp: combatant.stats.ap,
    atb: combatant.atb,
    broken: combatant.broken,
    spent: combatant.spent,
  };
}

/**
 * Map a sim {@link BattleState} to the read-only verification snapshot.
 * @param scene - The active scene key.
 * @param state - The live battle state.
 * @returns The read-only battle snapshot.
 */
function toVerifyState(scene: string, state: BattleState): VerifyBattleState {
  return {
    scene,
    phase: state.phase,
    tick: state.tick,
    grist: state.grist,
    party: state.party.map(toVerifyCombatant),
    enemies: state.enemies.map(toVerifyCombatant),
  };
}

/**
 * Holds the live link between the running scene and the test bridge. Gameplay
 * reads `takeSeed()`; the bridge reads `state()` / `resolution()` and pushes
 * actions through `act()`.
 */
class VerifyController {
  #sceneKey = "";
  #view: BattleView | null = null;
  #pendingSeed: number | null = null;

  /**
   * Link the active scene + its battle view so the bridge can observe and drive it.
   * @param sceneKey - The active scene's key.
   * @param view - The battle view, or null for non-battle scenes.
   * @returns void
   */
  attach(sceneKey: string, view: BattleView | null): void {
    this.#sceneKey = sceneKey;
    this.#view = view;
  }

  /**
   * Consume a seed queued by the bridge or the `?seed=` query (one-shot).
   * @returns The pending/URL seed, or null if none was set.
   */
  takeSeed(): number | null {
    const queued = this.#pendingSeed;
    this.#pendingSeed = null;
    return queued ?? urlSeed();
  }

  /**
   * The active scene key.
   * @returns The scene key.
   */
  scene(): string {
    return this.#sceneKey;
  }

  /**
   * A snapshot of the running battle, or null outside a battle scene.
   * @returns The current battle snapshot or null.
   */
  state(): VerifyBattleState | null {
    const state = this.#view?.state() ?? null;
    return state ? toVerifyState(this.#sceneKey, state) : null;
  }

  /**
   * The integer render scale the ScaleManager resolved, or null pre-battle.
   * @returns The resolution snapshot or null.
   */
  resolution(): VerifyResolution | null {
    return this.#view?.resolution() ?? null;
  }

  /**
   * Push an action into the sim via the active battle view.
   * @param action - The battle action to apply.
   * @returns void
   */
  act(action: BattleAction): void {
    this.#view?.act(action);
  }

  /**
   * Restart the active battle under a seed (queuing it for the next battle too).
   * @param seed - The 32-bit battle seed.
   * @returns void
   */
  seed(seed: number): void {
    this.#pendingSeed = seed;
    this.#view?.restart(seed);
  }

  /**
   * Drive a Strike from the front party member at the first standing enemy — the
   * canonical "an agent landed a hit" verification action.
   * @returns void
   */
  strike(): void {
    const state = this.#view?.state();
    if (!state) {
      return;
    }
    const targetIndex = state.enemies.findIndex(enemy => enemy.hp > 0);
    if (targetIndex < 0) {
      return;
    }
    this.act({
      kind: "strike",
      actor: { side: BattleSides.party, index: 0 },
      target: { side: BattleSides.enemies, index: targetIndex },
    });
  }
}

/** The shared verification controller (also read by gameplay code for seeding). */
export const verifyBridge = new VerifyController();

/**
 * The seed encoded in the `?seed=` query, or null when absent/invalid. Lets a
 * battle boot deterministically without a post-load restart.
 * @returns The parsed seed, or null.
 */
function urlSeed(): number | null {
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (raw === null) {
    return null;
  }
  const seed = Number(raw);
  return Number.isFinite(seed) ? seed : null;
}

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
    resolution: () => verifyBridge.resolution(),
    seed: (seed: number) => verifyBridge.seed(seed),
    act: (action: BattleAction) => verifyBridge.act(action),
    strike: () => verifyBridge.strike(),
  };
}
