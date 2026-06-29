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
import { type CurrentSave } from "../logic/save";
import { type WorldState } from "../logic/world";
import { saveService } from "../services/save-service";
import { type HudModel } from "../ui/battle-controller";
import { WorldStateCell } from "./world-state-cell";

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
  /** The shared grist pool the run has accrued (consumed battle results). */
  readonly grist: number;
  /** The Bound shards acquired so far this run. */
  readonly shards: readonly string[];
  /** The shard whose free-vs-wield choice is pending, or null. */
  readonly pendingChoiceShard: string | null;
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
  /** The shared grist pool the run has accrued from consumed battle results. */
  readonly grist: () => number;
  /** The Bound shards acquired so far this run. */
  readonly shards: () => readonly string[];
  /** The shard whose free-vs-wield choice is pending, or null. */
  readonly pendingChoiceShard: () => string | null;
  /** Examine the nearest examinable prop now (the canonical "agent examined it"). */
  readonly examineNearest: () => void;
  /** Engage the current room's encounter, launching its battle. */
  readonly engage: () => void;
  /** Traverse to the next room, firing its trigger and launching the next battle. */
  readonly traverse: () => void;
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
  /**
   * Deterministically play the launched battle to a terminal outcome and return
   * the phase reached (`"won"` / `"lost"`). The Field↔Battle e2e driver.
   */
  readonly autoWin: (maxTurns?: number) => string;
  readonly field: () => VerifyFieldState | null;
  readonly examine: () => void;
  /** Engage the current room's encounter, launching its battle. */
  readonly engage: () => void;
  /** Traverse to the next room, firing its trigger and launching the next battle. */
  readonly traverse: () => void;
  /**
   * Persist a {@link CurrentSave} to IndexedDB via the real {@link SaveService}
   * and resolve once the write commits. The persistence-journey driver: the e2e
   * calls this with a representative run payload, then reloads the page and calls
   * {@link VerifyApi.loadSave} to assert it was restored exactly from IndexedDB
   * (PRD #41 AC7 + AC5). Resolves false if persistence is unavailable.
   */
  readonly save: (save: CurrentSave) => Promise<boolean>;
  /**
   * Restore the persisted save from IndexedDB via the real {@link SaveService}
   * (the post-reload read). Returns a fresh empty save when nothing is stored or
   * the payload is unrecoverable — never throws.
   */
  readonly loadSave: () => Promise<CurrentSave>;
  /** Whether a save record is present in IndexedDB. */
  readonly hasSave: () => Promise<boolean>;
  /** Delete the persisted save (reset between e2e runs). */
  readonly clearSave: () => Promise<void>;
  /**
   * The bridge-held current world-state, or null if none has been adopted yet.
   * Seeded by {@link VerifyApi.save} (which adopts the payload's `worldState`) and
   * flipped in place by {@link VerifyApi.reckon}. Lets the world-state e2e (#134)
   * assert the Act I `reach` → Act II `ashfall` flip without a battle scene.
   */
  readonly worldState: () => WorldState | null;
  /**
   * Apply the Reckoning {@link reckon} flip to the bridge-held world-state — the
   * in-memory flip the world-state e2e drives (`reach` → `ashfall`, idempotent).
   * The flip consumes no RNG. No-op until a world-state has been adopted.
   */
  readonly reckon: () => void;
  /**
   * A demonstrative resolver read *through* the live world-state flag: the region
   * tone (`"verdant"` in `reach`, `"ashen"` in `ashfall`), or null before a
   * world-state is adopted. Lets the e2e observe a resolver returning its Ashfall
   * value once {@link VerifyApi.reckon} has fired.
   */
  readonly regionTone: () => string | null;
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
      grist: view.grist(),
      shards: view.shards(),
      pendingChoiceShard: view.pendingChoiceShard(),
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
   * Engage the current room's encounter via the active field view — fires its
   * trigger and launches the battle (the "agent engaged the encounter"
   * verification action). No-op outside the Field scene.
   * @returns void
   */
  engage(): void {
    this.#fieldView?.engage();
  }

  /**
   * Traverse to the next room via the active field view — fires the next room's
   * encounter trigger and launches its battle (the "agent walked to the next
   * encounter" verification action). No-op outside the Field scene.
   * @returns void
   */
  traverse(): void {
    this.#fieldView?.traverse();
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

  /**
   * Deterministically play the launched battle to a terminal outcome — the
   * "an agent fought the encounter to the end on the live canvas" driver the
   * Field↔Battle e2e (#82) uses to prove a launched fight resolves and control
   * returns to the Field. Each turn it advances to the next player decision, then
   * has Wren cast the flux **Spark** (the slice's strongest single-target action —
   * ×1.5 on the flux-weak construct/Ashling, building Pressure → Break) when she
   * can afford the AP, else a free **Strike**, at the first standing enemy. Bounded
   * by `maxTurns` so a stalemate can never hang the suite. No-op outside a battle.
   * @param maxTurns - The hard cap on decision iterations (default 400).
   * @returns The terminal phase reached (`"won"` / `"lost"`), or "" if not in battle.
   */
  autoWin(maxTurns = 400): string {
    for (let turn = 0; turn < maxTurns; turn += 1) {
      // Re-read the attached view each turn: a resolution may swap the scene
      // (Battle → Field) mid-drive, after which there is nothing left to act on.
      const view = this.#view;
      if (!view) {
        return "";
      }
      view.advanceTurn();
      const phase = this.#driveAutoTurn(view);
      if (phase !== null) {
        return phase;
      }
    }
    return this.#view?.state()?.phase ?? "";
  }

  /**
   * Drive one {@link autoWin} turn against an attached battle view: cast Spark when
   * Wren can afford it, else Strike, at the first standing enemy. Returns the
   * terminal phase when the battle has ended (or there is nothing to act on), or
   * null when the fight is still live and the caller should keep driving.
   * @param view - The attached battle view to act on.
   * @returns The terminal phase to stop on, or null to continue.
   */
  #driveAutoTurn(view: BattleView): string | null {
    const sparkApCost = 4;
    const state = view.state();
    if (!state) {
      return "";
    }
    if (state.phase === "won" || state.phase === "lost") {
      return state.phase;
    }
    const targetIndex = state.enemies.findIndex(enemy => enemy.hp > 0);
    if (targetIndex < 0) {
      return state.phase;
    }
    const wrenAp = state.party[0]?.ap ?? 0;
    const actor = { side: BattleSides.party, index: 0 } as const;
    const target = { side: BattleSides.enemies, index: targetIndex } as const;
    view.act(
      wrenAp >= sparkApCost
        ? { kind: "craft", id: "spark", actor, target }
        : { kind: "strike", actor, target }
    );
    return null;
  }
}

/** The shared verification controller (also read by gameplay code for seeding). */
export const verifyBridge = new VerifyController();

/**
 * The bridge-held world-state cell (#134). A module singleton, like
 * {@link verifyBridge}: the world-state flag the e2e flips and reads lives here in
 * memory (flip + resolve semantics delegated to `logic/world`), while the
 * canonical flag still rides the persisted save. Kept off the controller so the
 * bridge stays under its line budget — it is a pure test seam, not gameplay state.
 */
const worldStateCell = new WorldStateCell();

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
    autoWin: (maxTurns?: number) => verifyBridge.autoWin(maxTurns),
    field: () => verifyBridge.field(),
    examine: () => verifyBridge.examine(),
    engage: () => verifyBridge.engage(),
    traverse: () => verifyBridge.traverse(),
    // Drive the real shared SaveService so the e2e writes, reloads, and reads the
    // same IndexedDB store the game uses — proving the round-trip survives a page
    // reload (PRD #41 AC7 / AC5).
    save: async (save: CurrentSave) => {
      // Adopt the payload's world-state into the held cell so the in-memory
      // flip/read path (worldState/reckon/regionTone) and the persisted path stay
      // consistent: the flag the e2e saves is the flag the bridge then exposes.
      worldStateCell.adopt(save.worldState);
      try {
        await saveService.save(save);
        return true;
      } catch {
        return false;
      }
    },
    loadSave: () => saveService.load(),
    hasSave: () => saveService.has(),
    clearSave: () => saveService.clear(),
    worldState: () => worldStateCell.read(),
    reckon: () => worldStateCell.reckon(),
    regionTone: () => worldStateCell.regionTone(),
  };
}
