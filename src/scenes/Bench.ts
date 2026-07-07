/**
 * Bench (growth) scene — the thin Phaser adapter for the slice's out-of-battle
 * grist sink (Story #76 / sub-task #86, PRD #41 FR8 + the spend-side of AC6: "the
 * growth screen is spent grist"). It owns NO economy or learning rules: the pure
 * run-state reducers (`equipShardAtBench` / `applyBenchSink` in `logic/run-state`,
 * composing `logic/grist` + `logic/spell-learning`) hold every rule; this scene
 * RENDERS the run-state (shared grist, equipped shard, Cinder learning progress,
 * the SPD the build has grown) and EMITS the two growth actions — equip the
 * Ashling shard, and spend grist on a sink (Runner's Reflex → +2 SPD, or
 * Accelerate: Cinder → faster unlock). That is the "sim-authoritative" AC.
 *
 * Player actions arrive as semantic {@link BenchIntent}s on the EventsCenter bus
 * (published by {@link BenchInputService} from the interactive buttons); no raw
 * pointer is read in this scene. Every subscription is freed on shutdown. No
 * allocations in `update()` — the bench is event-driven, so it has none.
 * @module scenes/Bench
 */
import Phaser from "phaser";
import {
  BenchColors,
  BenchEvents,
  BenchLayout,
  BenchTextStyles,
  GameView,
  SceneKeys,
  type BenchLaunchData,
} from "../consts";
import { resolveBenchBack } from "../logic/bench-nav";
import {
  controlId,
  focusedControl,
  moveBenchFocus,
  newBenchFocus,
  type BenchFocusState,
} from "../logic/bench-focus";
import { BenchSinkIds, type BenchSinkId } from "../content/bench";
import { type BoundId } from "../content/bounds";
import { SpellIds } from "../content/spells";
import { earnGrist } from "../logic/grist";
import {
  applyBenchSink,
  equipShardAtBench,
  newRunState,
  type RunState,
} from "../logic/run-state";
import { isLearning, learningProgress } from "../logic/spell-learning";
import { AudioCues } from "../logic/audio";
import { eventsCenter } from "../services/events";
import { BenchInputService } from "../services/bench-input";
import { type BenchIntent } from "../services/bench-input-map";
import {
  getRunState,
  persistRunEconomy,
  setRunState,
} from "../services/run-store";
import { soundService } from "../services/sound-service";
import { isVerificationEnabled, verifyBridge } from "../uat/bridge";
import { addCursor, addPanel, enablePanelTap } from "../ui/chrome";
import { ASHLING_SHARD, BenchBoard } from "../ui/bench-board";
import { CueCaptionView } from "../ui/cue-caption";
import { type BenchView } from "../uat/bench-view";

/** Where the keyboard focus caret parks for one control (#246). */
interface CaretTarget {
  readonly x: number;
  readonly y: number;
}

/** Renders the growth/bench screen from run-state and emits growth actions. */
export class Bench extends Phaser.Scene {
  /** The cross-scene run progression (grist, shards, learning, stat bonuses). */
  #run: RunState = newRunState();
  #input!: BenchInputService;
  /** The pooled board view: grist readout, equip + sink buttons, progress bar. */
  #board!: BenchBoard;
  /** The keyboard focus-ring cursor over the bench controls (#246). */
  #focus: BenchFocusState = newBenchFocus();
  /** The grist-gold caret parked beside the focused control (#246). */
  #caret!: Phaser.GameObjects.Image;
  /** Per-control caret parking spots, parallel to {@link BENCH_CONTROL_ORDER}. */
  #caretTargets: readonly CaretTarget[] = [];
  /** The redundant on-screen caption for audio cues (#115, FR11 / AC12). */
  #cueCaption!: CueCaptionView;
  /**
   * The launch payload naming the caller to resume when the Bench is closed with
   * Back/Esc (#239) — the pause Menu when opened from Builds, plus the resume payload
   * that re-opened Menu needs — or undefined when the Bench was reached standalone via
   * `?scene=bench` (no caller, so Back stays put, preserving the verification seam).
   */
  #launch: BenchLaunchData | undefined = undefined;

  /** Register the scene key. */
  constructor() {
    super(SceneKeys.Bench);
  }

  /**
   * Read the run-state, build the static growth-screen chrome (title, grist readout,
   * equip button, sink buttons, Cinder progress bar, Back control), wire the semantic
   * input service + bus subscription, attach the verification bridge, and render the
   * initial state. A {@link BenchLaunchData} caller (#239) is remembered so Back/Esc
   * resumes it (the pause Menu, via Builds); absent (`?scene=bench`) Back stays put.
   * @param data - The launch payload naming the caller scene, or undefined standalone.
   * @returns void
   */
  create(data?: BenchLaunchData): void {
    this.#launch = data;
    this.#run = this.#seedWallet(getRunState(this.registry));
    this.#input = new BenchInputService(this);

    this.cameras.main.setBackgroundColor(BenchColors.backdrop);
    this.#board = new BenchBoard(this, this.#input);
    this.#buildBackControl();
    this.#buildCaret();

    this.#cueCaption = new CueCaptionView(this);
    soundService.attachUnlock(this);
    eventsCenter.on(BenchEvents.Input, this.#onIntent);
    verifyBridge.attach(SceneKeys.Bench, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());

    this.#board.render(this.#run);
    this.#renderFocus();
  }

  /**
   * A verification-only seam: when the page carries `?grist=N` (a non-negative
   * integer), credit the run's wallet up to that balance so the bench e2e can
   * drive the "given a funded wallet" AC without first playing battles to earn
   * grist (the slice starts at 10, below the sink costs). It only ever *adds* the
   * shortfall via the pure {@link earnGrist} — never mints below the current
   * balance.
   *
   * **Gated behind {@link isVerificationEnabled}** — it honors `?grist=` only in
   * dev or under `?uat=1`, exactly like the `__VERIFY__` bridge and the `?seed=`
   * seam. In a normal production build (no `?uat=1`) it returns the original run
   * untouched — never calling `earnGrist`/`setRunState` — so `?scene=bench&grist=9999`
   * cannot become a public economy bypass. A no-op without the query, in a
   * non-browser test context, and whenever verification is disabled.
   * @param run - The run read from the registry.
   * @returns The run, with its wallet topped up to `?grist=N` when the seam applies.
   */
  #seedWallet(run: RunState): RunState {
    if (!isVerificationEnabled() || typeof window === "undefined") {
      return run;
    }
    const raw = new URLSearchParams(window.location.search).get("grist");
    if (raw === null) {
      return run;
    }
    const target = Number(raw);
    if (!Number.isFinite(target) || target <= run.wallet.grist) {
      return run;
    }
    const funded: RunState = {
      ...run,
      wallet: earnGrist(run.wallet, target - run.wallet.grist),
    };
    setRunState(this.registry, funded);
    return funded;
  }

  /**
   * Apply a semantic bench intent. Pointer taps arrive as the concrete `equip` /
   * `buy-sink` / `back` verbs (a tap knows what it hit); the keyboard arrives as
   * `move` (step the focus ring) and `confirm` (activate the focused control, #246)
   * — the navigate-then-activate path that gives keyboard/gamepad/Deck players the
   * build system a mouse had all to itself. Every activation threads through the
   * same pure reducers a tap does, so a keyboard confirm and a click are one code
   * path. A stable arrow field so it can be unsubscribed on shutdown.
   * @param intent - The semantic bench intent from the bus.
   * @param _device - The originating device (kept for telemetry symmetry).
   * @returns void
   */
  readonly #onIntent = (intent: BenchIntent, _device: string): void => {
    switch (intent.kind) {
      case "move":
        this.#focus = moveBenchFocus(this.#focus, intent.delta);
        this.#renderFocus();
        return;
      case "confirm":
        this.#confirmFocused();
        return;
      case "back":
        this.#back();
        return;
      case "equip":
        this.#applyEquip(intent.shard);
        return;
      case "buy-sink":
        this.#applyBuySink(intent.sink);
        return;
    }
  };

  /**
   * Activate the keyboard-focused control (#246): equip the shard, buy the focused
   * sink, or back out — the same effect the pointer tap on that control emits, so
   * Enter/Space on a focused control is exactly a click on it. A focused but
   * unaffordable sink is confirm-visitable-but-inert: {@link #applyBuySink} routes
   * it through the reducer, which no-ops the rejected spend (the Menu handles its
   * `unavailable` entries the same way).
   * @returns void
   */
  #confirmFocused(): void {
    const control = focusedControl(this.#focus);
    if (control.kind === "equip") {
      this.#applyEquip(ASHLING_SHARD);
      return;
    }
    if (control.kind === "back") {
      this.#back();
      return;
    }
    this.#applyBuySink(control.sink);
  }

  /**
   * Equip a shard through the pure reducer, persisting and re-rendering. Begins the
   * shard's learning; re-equipping is a harmless no-op the reducer absorbs.
   * @param shard - The shard to equip.
   * @returns void
   */
  #applyEquip(shard: BoundId): void {
    this.#commit(equipShardAtBench(this.#run, shard));
  }

  /**
   * Buy a grist sink through the pure reducer. A successful spend fires the
   * resonant grist-spend stinger (#115) alongside the persisted state change; a
   * rejected spend (unaffordable, or accelerating a spell not in progress) is a
   * no-op that leaves the run untouched, so nothing is persisted or re-rendered.
   * @param sink - The sink to buy.
   * @returns void
   */
  #applyBuySink(sink: BenchSinkId): void {
    const result = applyBenchSink(this.#run, sink);
    if (result.ok) {
      soundService.playCue(AudioCues.gristSpend);
      this.#commit(result.run);
    }
  }

  /**
   * Adopt a new run-state: persist it to the typed registry wrapper so every scene
   * observes the same instance, then re-render the screen from it.
   * @param run - The next run state.
   * @returns void
   */
  #commit(run: RunState): void {
    this.#run = run;
    setRunState(this.registry, run);
    // Write the bench-changed economy THROUGH to the save (#235) so a spent wallet,
    // a bought augment, and an equipped shard survive a reload and Continue restores
    // them — best-effort/fire-and-forget so a storage write never blocks the render.
    void persistRunEconomy(run);
    this.#board.render(this.#run);
  }

  /**
   * Close the Bench (#239): resolve the pure {@link resolveBenchBack} decision and, when
   * there is a caller, hand control back to it — the pause Menu (via Builds), re-opened
   * with the same resume payload so ITS own Esc then drops the player back on the Field
   * where they paused. A standalone bench (`?scene=bench`, no caller) stays put. The run
   * economy is persisted on every commit, so the wallet/build grown here survives the exit.
   * @returns void
   */
  #back(): void {
    const outcome = resolveBenchBack(this.#launch?.returnTo ?? null);
    if (outcome.kind === "return") {
      this.scene.start(outcome.scene, this.#launch?.resume);
    }
  }

  /**
   * Build the Bench's exit affordances (#239): a tappable "‹ Back" button in the top-
   * right 9-slice chrome (the pointer-first Bench's pointer exit) and a bottom "[Esc]
   * back" hint for the keyboard binding — the symmetric return the Bench lacked the
   * moment Builds routed players into it. Both feed the same semantic `back` intent.
   * @returns void
   */
  #buildBackControl(): void {
    const box = addPanel(
      this,
      BenchLayout.backX,
      BenchLayout.backY,
      BenchLayout.backWidth,
      BenchLayout.backHeight
    );
    enablePanelTap(box, BenchLayout.backWidth, BenchLayout.backHeight, () => {
      this.#input.tapBack();
    });
    this.add
      .text(
        BenchLayout.backX,
        BenchLayout.backY,
        "‹ Back",
        BenchTextStyles.button
      )
      .setOrigin(0.5);
    this.add
      .text(
        GameView.width / 2,
        BenchLayout.hintY,
        "[Esc] back",
        BenchTextStyles.hint
      )
      .setOrigin(0.5);
  }

  /**
   * Build the keyboard focus caret (#246): the grist-gold `arrow` cursor rotated to
   * point right, plus the per-control parking spots it hops between — one for each
   * control in {@link BENCH_CONTROL_ORDER} (equip, the two sinks, Back), each just
   * left of its control. The caret sits beside the focused control so keyboard/
   * gamepad players see what Enter will activate; the parked-caret idiom mirrors the
   * pause menu's focus cursor, and it never fights the box tints (equipped-green /
   * disabled-dim) the way a focus tint would.
   * @returns void
   */
  #buildCaret(): void {
    const left = (centerX: number, width: number): number =>
      centerX - width / 2 - BenchLayout.caretGap;
    // Parallel to BENCH_CONTROL_ORDER: equip, Runner's Reflex sink, Accelerate sink, Back.
    this.#caretTargets = [
      {
        x: left(BenchLayout.equipX, BenchLayout.equipWidth),
        y: BenchLayout.equipY,
      },
      {
        x: left(BenchLayout.sinkX, BenchLayout.sinkWidth),
        y: BenchLayout.firstSinkY,
      },
      {
        x: left(BenchLayout.sinkX, BenchLayout.sinkWidth),
        y: BenchLayout.firstSinkY + BenchLayout.rowGap,
      },
      {
        x: left(BenchLayout.backX, BenchLayout.backWidth),
        y: BenchLayout.backY,
      },
    ];
    const first = this.#caretTargets[0] ?? { x: 0, y: 0 };
    this.#caret = addCursor(this, first.x, first.y, -Math.PI / 2).setOrigin(
      0.5
    );
  }

  /**
   * Park the caret beside the focused control, reading the spot parallel to the
   * pure focus cursor (#246). Called on open and after every `move` intent.
   * @returns void
   */
  #renderFocus(): void {
    const target =
      this.#caretTargets[this.#focus.cursor] ?? this.#caretTargets[0];
    if (target) {
      this.#caret.setPosition(target.x, target.y);
    }
  }

  /**
   * The live link handed to the verification bridge (#86): the render scale and a
   * read of the run-state the bench drives (grist, shard, Cinder learning, SPD
   * bonus), plus the three growth actions routed through the same semantic input
   * the buttons use — so the e2e drives exactly the player's path.
   * @returns The bench view.
   */
  #bridgeView(): BenchView {
    return {
      resolution: () => {
        const { gameSize, displaySize } = this.scale;
        return {
          width: gameSize.width,
          height: gameSize.height,
          zoom: displaySize.width / gameSize.width,
        };
      },
      grist: () => this.#run.wallet.grist,
      shardEquipped: () => this.#run.equippedShards.includes(ASHLING_SHARD),
      cinderLearning: () => isLearning(this.#run.learning, SpellIds.cinder),
      cinderProgress: () =>
        learningProgress(this.#run.learning, SpellIds.cinder),
      spdBonus: () => this.#run.statBonuses.spd ?? 0,
      focus: () => controlId(focusedControl(this.#focus)),
      equipShard: () => this.#input.tapEquip(ASHLING_SHARD),
      buyRunnersReflex: () =>
        this.#input.tapBuySink(BenchSinkIds.runnersReflex),
      accelerateCinder: () =>
        this.#input.tapBuySink(BenchSinkIds.accelerateCinder),
      back: () => this.#input.tapBack(),
    };
  }

  /**
   * Free every external subscription on scene shutdown (the
   * `require-shutdown-cleanup` contract): detach the bridge first (so
   * `__VERIFY__.bench()` returns null out of the scene), then unsubscribe the
   * bench-intent bus listener and dispose the input service's Back-key listener (#239).
   * @returns void
   */
  #shutdown(): void {
    verifyBridge.attach("", null);
    this.#cueCaption.destroy();
    eventsCenter.off(BenchEvents.Input, this.#onIntent);
    this.#input.dispose();
  }
}
