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
  type BattleAction,
  type BattleState,
  type Combatant,
} from "../logic/combat";
import { type RegionAction } from "../logic/region";
import { type FxSelection } from "../ui/battle-fx";
import { type HudModel } from "../ui/battle-controller";
import { autoWinView, strikeView } from "./battle-driver";
import { BenchCell, type BenchView, type VerifyBenchState } from "./bench-view";
import {
  DialogueCell,
  dialogueApi,
  type DialogueApi,
  type DialogueView,
} from "./dialogue-view";
import { dataCellApi, type DataCellApi } from "./data-cell-api";
import {
  toVerifyFieldState,
  type FieldView,
  type VerifyFieldState,
} from "./field-view";
import { RenderCell, renderApi, type RenderApi } from "./render-cell";
import {
  RegionSceneCell,
  type RegionView,
  type VerifyRegionSceneState,
} from "./region-scene-view";

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
export interface VerifyResolution {
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
  /** The last FX the stage played (element action strip or Break burst), #201. */
  readonly fx: () => FxSelection | null;
  readonly restart: (seed: number) => void;
  readonly act: (action: BattleAction) => void;
  readonly advanceTurn: () => void;
}

// The field view contract + snapshot mapper live in `./field-view` (extracted to
// keep this bridge under its line budget, like the bench/dialogue cells). The
// `FieldView` type is re-exported below so the Field scene's existing import from
// `./bridge` is unchanged.
export type { FieldView };

/** The shape installed on `window.__VERIFY__`. */
interface VerifyApi extends DialogueApi, DataCellApi, RenderApi {
  readonly scene: () => string;
  readonly state: () => VerifyBattleState | null;
  readonly resolution: () => VerifyResolution | null;
  readonly hud: () => HudModel | null;
  readonly hash: () => string | null;
  /**
   * The last battle FX the stage played — the resolved action's element-read
   * strip ({@link FxSelection.element} names the element, or null for a neutral
   * Strike) or the Break burst — or null outside a battle / before any FX. Lets
   * the verification suite prove an action read by its element and the Break beat
   * fired, without inspecting pixels (#201).
   */
  readonly fx: () => FxSelection | null;
  readonly seed: (seed: number) => void;
  /**
   * Push an action into the active gameplay scene. A {@link BattleAction} drives
   * the Battle scene's sim; a {@link RegionAction} (`advance` / `reckon`) drives the
   * booted Region scene's harness (#137). The bridge dispatches by which view is
   * attached, so the same `act()` entry serves both — battle callers are unaffected.
   */
  readonly act: (action: BattleAction | RegionAction) => void;
  readonly advanceTurn: () => void;
  readonly strike: () => void;
  /**
   * Deterministically play the launched battle to a terminal outcome and return
   * the phase reached (`"won"` / `"lost"`). The Field↔Battle e2e driver.
   */
  readonly autoWin: (maxTurns?: number) => string;
  readonly field: () => VerifyFieldState | null;
  readonly examine: () => void;
  /** Summon or dismiss the field mini-map overlay (#107). No-op outside Field. */
  readonly toggleMiniMap: () => void;
  /** Engage the current room's encounter, launching its battle. */
  readonly engage: () => void;
  /** Traverse to the next room, firing its trigger and launching the next battle. */
  readonly traverse: () => void;
  /**
   * A snapshot of the growth/bench screen (grist, shard, learning, build), or
   * null outside the Bench scene. Lets the bench e2e (#86) assert the equip /
   * spend outcomes on the live canvas.
   */
  readonly bench: () => VerifyBenchState | null;
  /** Equip the Ashling shard at the bench (begins Cinder learning). */
  readonly equipShard: () => void;
  /** Buy Runner's Reflex at the bench (+2 SPD); a no-op if unaffordable. */
  readonly buyRunnersReflex: () => void;
  /** Buy Accelerate: Cinder at the bench; a no-op if unaffordable or not learning. */
  readonly accelerateCinder: () => void;
  // The save / world-state / region-data / enemy-family read entries are
  // contributed by {@link DataCellApi} (composed from the bridge-held data
  // cells), the `dialogueApi` way — keeping this file under its line budget.
  /**
   * A snapshot of the BOOTED Region scene (#137), or null outside it — the
   * rendered-scene counterpart of {@link VerifyApi.field}. The Region scene
   * registers a {@link RegionView}; the bridge dispatches this (and `scene()` /
   * `hash()` / `act()` / `resolution()`) to it. `booted` is false (with a non-null
   * `error`) when the region threw on boot — the harness-failure state the e2e asserts.
   */
  readonly regionRun: () => VerifyRegionSceneState | null;
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
 * Whether an attached view is a {@link FieldView}. The gameplay views are
 * structurally disjoint — only the field view exposes `room()` — so a single
 * discriminating property distinguishes them without a tag field.
 * @param view - The attached gameplay view.
 * @returns True when the view is a field view.
 */
function isFieldView(
  view: BattleView | FieldView | BenchView | DialogueView | RegionView
): view is FieldView {
  return "room" in view;
}

/**
 * Holds the live link between the running scene and the test bridge. Gameplay
 * reads `takeSeed()`; the bridge reads `state()` / `resolution()` and pushes
 * actions through `act()`. The bench seam is delegated to a composed
 * {@link BenchCell} so its plumbing lives next to its types.
 */
class VerifyController {
  #sceneKey = "";
  #view: BattleView | null = null;
  #fieldView: FieldView | null = null;
  /** The composed region-scene seam (#137), public like {@link dialogue}. */
  readonly region = new RegionSceneCell();
  readonly #bench = new BenchCell();
  readonly dialogue = new DialogueCell();
  #pendingSeed: number | null = null;

  /**
   * Link the active scene + the view it exposes so the bridge can observe and
   * drive it. A scene attaches whichever view it implements — a {@link BattleView}
   * (Battle), a {@link FieldView} (Field), a {@link BenchView} (Bench), a
   * {@link DialogueView} (Dialogue), or a {@link RegionView} (Region, #137) — and
   * the bridge dispatches each query to the present view. Non-gameplay scenes
   * (Boot / Preloader) attach `null`. Attaching one view clears the others so a
   * stale link can never be read across a scene transition.
   * @param sceneKey - The active scene's key.
   * @param view - The battle / field / bench / dialogue / region view, or null for non-gameplay scenes.
   * @returns void
   */
  attach(
    sceneKey: string,
    view: BattleView | FieldView | BenchView | DialogueView | RegionView | null
  ): void {
    this.#sceneKey = sceneKey;
    this.#view = null;
    this.#fieldView = null;
    this.region.attach(null);
    this.#bench.attach(null);
    this.dialogue.attach(null);
    if (view === null) {
      return;
    }
    if (isFieldView(view)) {
      this.#fieldView = view;
    } else if (RegionSceneCell.claims(view)) {
      this.region.attach(view);
    } else if (BenchCell.claims(view)) {
      this.#bench.attach(view);
    } else if (DialogueCell.claims(view)) {
      this.dialogue.attach(view);
    } else {
      this.#view = view;
    }
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
    const battle = this.#view?.state();
    return battle ? toVerifyState(this.#sceneKey, battle) : null;
  }

  /**
   * The integer render scale the ScaleManager resolved, read from whichever
   * gameplay view is attached (Battle or Field), or null on a non-gameplay scene.
   * Scene-agnostic so the field e2e can assert 384×216 + integer zoom without a
   * BattleView.
   * @returns The resolution snapshot or null.
   */
  resolution(): VerifyResolution | null {
    const view =
      this.#view ??
      this.#fieldView ??
      this.region.view() ??
      this.#bench.view() ??
      this.dialogue.view();
    return view?.resolution() ?? null;
  }

  /**
   * A snapshot of the running field session (room, phase, Wren's logical
   * position, surfaced lore), or null outside the Field scene. Lets the field
   * e2e assert Wren's position changed after a move and that an examine surfaced
   * the authored lore beat.
   * @returns The current field snapshot or null.
   */
  field(): VerifyFieldState | null {
    return this.#fieldView
      ? toVerifyFieldState(this.#sceneKey, this.#fieldView)
      : null;
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
   * Summon or dismiss the field mini-map overlay via the active field view — the
   * "an agent summoned the mini-map" verification action (#107). No-op outside
   * the Field scene.
   * @returns void
   */
  toggleMiniMap(): void {
    this.#fieldView?.toggleMiniMap();
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
   * The composed bench seam (#86): the bridge reads its snapshot for the active
   * scene (`bench.snapshot(scene())`) and drives growth actions through its view
   * (`bench.view()?.equipShard()` …), each a no-op outside the Bench scene.
   * @returns The bench cell.
   */
  bench(): BenchCell {
    return this.#bench;
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
   * The last battle FX the stage played (element-read action strip or Break
   * burst), or null outside a battle / before any FX. Dispatched to the attached
   * BattleView; the verification suite reads it to prove the element/Break FX
   * (#201).
   * @returns The last FX selection, or null.
   */
  fx(): FxSelection | null {
    return this.#view?.fx() ?? null;
  }

  /**
   * The stable digest of the live scene — the {@link BattleState} hash in a battle,
   * or the booted region-session hash ({@link hashRegionRun}) in the Region scene
   * (#137), else null. The determinism gate samples this across two seeded
   * play-throughs and asserts an identical progression — same seed + same action
   * sequence ⇒ identical hashes. Dispatched by which view is attached.
   * @returns The 8-char state hash, or null.
   */
  hash(): string | null {
    return this.region.hash() ?? this.#view?.hash() ?? null;
  }

  /**
   * Push an action into the active gameplay scene. A {@link BattleAction} threads
   * the Battle scene's sim; a {@link RegionAction} (`advance` / `reckon`) drives the
   * booted Region scene's harness (#137). `attach` clears the inactive view, so each
   * branch is a no-op for the other scene — only the attached view receives its action.
   * @param action - The battle or region action to apply.
   * @returns void
   */
  act(action: BattleAction | RegionAction): void {
    this.region.act(action as RegionAction);
    this.#view?.act(action as BattleAction);
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
   * Drive a Strike from the front party member at the first standing enemy via
   * {@link strikeView} — the canonical "an agent landed a hit" verification
   * action. No-op outside a battle scene.
   * @returns void
   */
  strike(): void {
    if (this.#view) {
      strikeView(this.#view);
    }
  }

  /**
   * Deterministically play the launched battle to a terminal outcome via
   * {@link autoWinView} — the "an agent fought the encounter to the end on the
   * live canvas" driver the Field↔Battle e2e (#82) uses. No-op outside a battle.
   * @param maxTurns - The hard cap on decision iterations (default 400).
   * @returns The terminal phase reached (`"won"` / `"lost"`), or "" if not in battle.
   */
  autoWin(maxTurns?: number): string {
    return autoWinView(() => this.#view, maxTurns);
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
 * Whether the verification (UAT) surface is enabled: true in dev, or in a
 * production build only when the page is loaded with `?uat=1`. This is the single
 * gate every verification-only seam shares — the `__VERIFY__` bridge installs
 * under it, and scene-level verification entry points (the Bench `?grist=` wallet
 * seed) must guard on it too so a production user without `?uat=1` can never reach
 * them. Guarded for non-browser (test) contexts where `window` is absent.
 * @returns True when the verification surface is enabled.
 */
export function isVerificationEnabled(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).has("uat");
}

/**
 * Install `window.__VERIFY__` when enabled. Called once at bootstrap.
 * @returns void
 */
export function installVerifyBridge(): void {
  if (!isVerificationEnabled()) {
    return;
  }
  window.__VERIFY__ = {
    // `scene()` / `hash()` / `act()` are dispatched by the active view inside the
    // controller: the Region scene (#137) registers a RegionView, so `scene()`
    // reports the Region key, `hash()` returns the booted-session digest, and
    // `act()` routes a RegionAction to the harness — the same entry points a battle
    // uses, with the controller selecting the attached view.
    scene: () => verifyBridge.scene(),
    state: () => verifyBridge.state(),
    resolution: () => verifyBridge.resolution(),
    hud: () => verifyBridge.hud(),
    hash: () => verifyBridge.hash(),
    fx: () => verifyBridge.fx(),
    seed: (seed: number) => verifyBridge.seed(seed),
    act: (action: BattleAction | RegionAction) => verifyBridge.act(action),
    advanceTurn: () => verifyBridge.advanceTurn(),
    strike: () => verifyBridge.strike(),
    autoWin: (maxTurns?: number) => verifyBridge.autoWin(maxTurns),
    field: () => verifyBridge.field(),
    examine: () => verifyBridge.examine(),
    toggleMiniMap: () => verifyBridge.toggleMiniMap(),
    engage: () => verifyBridge.engage(),
    traverse: () => verifyBridge.traverse(),
    bench: () => verifyBridge.bench().snapshot(verifyBridge.scene()),
    equipShard: () => verifyBridge.bench().view()?.equipShard(),
    buyRunnersReflex: () => verifyBridge.bench().view()?.buyRunnersReflex(),
    accelerateCinder: () => verifyBridge.bench().view()?.accelerateCinder(),
    ...dialogueApi(verifyBridge.dialogue, () => verifyBridge.scene()),
    // The save / world-state / region-data / enemy-family entries — composed
    // from the bridge-held data cells, the `dialogueApi` way; null outside the
    // scene/state each reads (PRD #41 AC5/AC7).
    ...dataCellApi(),
    // The palette + transition render seams (#114 AC1/AC2) — scene-agnostic pure
    // reads over `logic/render`, the `dialogueApi` way, so the demo-polish e2e proves
    // the grade + readable fade against the SAME modules the scenes consume.
    ...renderApi(new RenderCell()),
    // The BOOTED Region scene snapshot (#137) — read for the active scene, the same
    // way `bench` reads its cell; null outside the Region scene.
    regionRun: () => verifyBridge.region.snapshot(verifyBridge.scene()),
  };
}
