/**
 * Verification (UAT) test bridge. Exposes a tiny, typed `window.__VERIFY__` API so
 * the Playwright verification suite can drive the canvas deterministically: read
 * the active scene, the live {@link BattleState} + HUD model, the integer render
 * scale, and the stable state {@link hashState hash}; seed/restart the battle;
 * push a {@link BattleAction} into the sim; and fast-forward to the next player
 * decision (`advanceTurn`). It is OFF in normal builds — enabled only in dev or
 * when the page is loaded with `?uat=1` — and never referenced by gameplay code
 * outside this module.
 *
 * Together these let an e2e play a seeded encounter to victory (Strike / Craft /
 * Bind), assert the resource economy (AP on Craft, grist on Bind), and run the
 * determinism state-hash gate (same seed + same action sequence ⇒ identical hash
 * progression) — the "an agent actually played it" definition of done for #40.
 * @module uat/bridge
 */
import {
  BattleSides,
  type BattleAction,
  type BattleState,
  type Combatant,
} from "../logic/combat";
import { type HudModel } from "../ui/battle-controller";

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
  readonly hud: () => HudModel | null;
  readonly hash: () => string | null;
  readonly restart: (seed: number) => void;
  readonly act: (action: BattleAction) => void;
  readonly advanceTurn: () => void;
}

/** A read-only snapshot of Wren's logical (384×216) position in the field. */
interface VerifyFieldPosition {
  readonly x: number;
  readonly y: number;
}

/** A read-only snapshot of the running field session for assertions. */
interface VerifyFieldState {
  readonly scene: string;
  readonly room: string;
  readonly phase: string;
  readonly wren: VerifyFieldPosition;
  /** The lore text currently surfaced by the last examine, or null. */
  readonly lore: string | null;
}

/**
 * The live link the Field scene registers with the bridge. Lets the field e2e
 * read the resolved integer scale (scene-agnostic — the same shape battle uses),
 * Wren's live position (to assert it changed after a move), the current room /
 * phase, and the surfaced lore beat after an examine. Kept separate from
 * {@link BattleView} so neither path constrains the other; the controller stores
 * whichever is attached and the bridge dispatches by which one is present.
 */
export interface FieldView {
  readonly resolution: () => VerifyResolution;
  readonly room: () => string;
  readonly phase: () => string;
  readonly wren: () => VerifyFieldPosition;
  readonly lore: () => string | null;
  /** Examine the nearest examinable prop now (the canonical "agent examined it"). */
  readonly examineNearest: () => void;
}

/** The shape installed on `window.__VERIFY__`. */
interface VerifyApi {
  readonly scene: () => string;
  readonly state: () => VerifyBattleState | null;
  readonly resolution: () => VerifyResolution | null;
  readonly hud: () => HudModel | null;
  readonly hash: () => string | null;
  readonly seed: (seed: number) => void;
  readonly act: (action: BattleAction) => void;
  readonly advanceTurn: () => void;
  readonly strike: () => void;
  readonly field: () => VerifyFieldState | null;
  readonly examine: () => void;
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
 * Whether an attached view is a {@link FieldView} (vs a {@link BattleView}). The
 * two views are structurally disjoint — only the field view exposes `room()` —
 * so a single discriminating property distinguishes them without a tag field.
 * @param view - The attached gameplay view.
 * @returns True when the view is a field view.
 */
function isFieldView(view: BattleView | FieldView): view is FieldView {
  return "room" in view;
}

/**
 * Holds the live link between the running scene and the test bridge. Gameplay
 * reads `takeSeed()`; the bridge reads `state()` / `resolution()` and pushes
 * actions through `act()`.
 */
class VerifyController {
  #sceneKey = "";
  #view: BattleView | null = null;
  #fieldView: FieldView | null = null;
  #pendingSeed: number | null = null;

  /**
   * Link the active scene + the view it exposes so the bridge can observe and
   * drive it. A scene attaches whichever view it implements — a {@link BattleView}
   * (Battle) or a {@link FieldView} (Field) — and the bridge dispatches each query
   * to the present view. Non-gameplay scenes (Boot / Preloader) attach `null`.
   * Attaching one view clears the other so a stale link can never be read across a
   * scene transition.
   * @param sceneKey - The active scene's key.
   * @param view - The battle or field view, or null for non-gameplay scenes.
   * @returns void
   */
  attach(sceneKey: string, view: BattleView | FieldView | null): void {
    this.#sceneKey = sceneKey;
    if (view !== null && isFieldView(view)) {
      this.#fieldView = view;
      this.#view = null;
      return;
    }
    this.#view = view;
    this.#fieldView = null;
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
   * The integer render scale the ScaleManager resolved, read from whichever
   * gameplay view is attached (Battle or Field), or null on a non-gameplay scene.
   * Scene-agnostic so the field e2e can assert 384×216 + integer zoom without a
   * BattleView.
   * @returns The resolution snapshot or null.
   */
  resolution(): VerifyResolution | null {
    return (this.#view ?? this.#fieldView)?.resolution() ?? null;
  }

  /**
   * A snapshot of the running field session (room, phase, Wren's logical
   * position, surfaced lore), or null outside the Field scene. Lets the field
   * e2e assert Wren's position changed after a move and that an examine surfaced
   * the authored lore beat.
   * @returns The current field snapshot or null.
   */
  field(): VerifyFieldState | null {
    const view = this.#fieldView;
    if (!view) {
      return null;
    }
    return {
      scene: this.#sceneKey,
      room: view.room(),
      phase: view.phase(),
      wren: view.wren(),
      lore: view.lore(),
    };
  }

  /**
   * Examine the nearest examinable prop via the active field view — the
   * canonical "an agent examined the rendering notice" verification action.
   * No-op outside the Field scene.
   * @returns void
   */
  examine(): void {
    this.#fieldView?.examineNearest();
  }

  /**
   * The live HUD view-model (speed, active actor, target, command menu with
   * costs/affordability, per-enemy Break, and the last input/action), or null
   * outside a battle scene. Lets the verification suite assert the HUD reflects
   * the sim and that input was routed through the semantic InputService.
   * @returns The HUD model or null.
   */
  hud(): HudModel | null {
    return this.#view?.hud() ?? null;
  }

  /**
   * The stable digest of the live {@link BattleState} ({@link hashState}), or null
   * outside a battle scene. The determinism gate samples this across two seeded
   * play-throughs and asserts an identical progression — same seed + same action
   * sequence ⇒ identical hashes.
   * @returns The 8-char state hash, or null.
   */
  hash(): string | null {
    return this.#view?.hash() ?? null;
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
   * Deterministically advance the sim to the next player decision point (fill the
   * ATB, auto-resolving enemy turns, until a party member is ready or the battle
   * resolves). Lets the verification suite drive a seeded battle turn-by-turn
   * without depending on wall-clock pacing.
   * @returns void
   */
  advanceTurn(): void {
    this.#view?.advanceTurn();
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
    hud: () => verifyBridge.hud(),
    hash: () => verifyBridge.hash(),
    seed: (seed: number) => verifyBridge.seed(seed),
    act: (action: BattleAction) => verifyBridge.act(action),
    advanceTurn: () => verifyBridge.advanceTurn(),
    strike: () => verifyBridge.strike(),
    field: () => verifyBridge.field(),
    examine: () => verifyBridge.examine(),
  };
}
