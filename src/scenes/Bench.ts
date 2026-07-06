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
import { BenchSinkIds, BENCH_SINKS, type BenchSinkId } from "../content/bench";
import { BoundIds } from "../content/bounds";
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
import { addPanel, enablePanelTap, PanelTint } from "../ui/chrome";
import { CueCaptionView } from "../ui/cue-caption";
import { type BenchView } from "../uat/bench-view";

/** The shard the bench equips (the Ashling reward shard that teaches Cinder). */
const ASHLING_SHARD = BoundIds.marrowBound;
/** The pooled objects for one sink button (its highlight box + label). */
interface SinkButton {
  readonly id: BenchSinkId;
  readonly box: Phaser.GameObjects.NineSlice;
  readonly label: Phaser.GameObjects.Text;
}

/** Renders the growth/bench screen from run-state and emits growth actions. */
export class Bench extends Phaser.Scene {
  /** The cross-scene run progression (grist, shards, learning, stat bonuses). */
  #run: RunState = newRunState();
  #input!: BenchInputService;
  #gristText!: Phaser.GameObjects.Text;
  #equipBox!: Phaser.GameObjects.NineSlice;
  #equipLabel!: Phaser.GameObjects.Text;
  #sinks: readonly SinkButton[] = [];
  #progressFill!: Phaser.GameObjects.Rectangle;
  #progressLabel!: Phaser.GameObjects.Text;
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
    this.#buildChrome();
    this.#equipBox = this.#buildEquipButton();
    this.#sinks = [
      this.#buildSinkButton(BenchSinkIds.runnersReflex, 0),
      this.#buildSinkButton(BenchSinkIds.accelerateCinder, 1),
    ];
    this.#buildProgressBar();
    this.#buildBackControl();

    this.#cueCaption = new CueCaptionView(this);
    soundService.attachUnlock(this);
    eventsCenter.on(BenchEvents.Input, this.#onIntent);
    verifyBridge.attach(SceneKeys.Bench, this.#bridgeView());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#shutdown());

    this.#render();
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
   * Apply a semantic bench intent by threading it through the matching pure
   * reducer, persisting the result, and re-rendering. An equip begins the shard's
   * learning; a buy-sink spends grist and changes the build (a rejected spend —
   * unaffordable, or accelerating a spell not in progress — is a no-op that leaves
   * the run untouched, so nothing is persisted and the render is unchanged). A
   * stable arrow field so it can be unsubscribed on shutdown.
   * @param intent - The semantic bench intent from the bus.
   * @param _device - The originating device (kept for telemetry symmetry).
   * @returns void
   */
  readonly #onIntent = (intent: BenchIntent, _device: string): void => {
    if (intent.kind === "back") {
      this.#back();
      return;
    }
    if (intent.kind === "equip") {
      this.#commit(equipShardAtBench(this.#run, intent.shard));
      return;
    }
    const result = applyBenchSink(this.#run, intent.sink);
    if (result.ok) {
      // A successful sink spends grist — fire the resonant grist-spend stinger
      // (#115) alongside the persisted state change.
      soundService.playCue(AudioCues.gristSpend);
      this.#commit(result.run);
    }
  };

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
    this.#render();
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
   * Build the static title banner and the shared-grist readout (the grist text is
   * retained and updated on render).
   * @returns void
   */
  #buildChrome(): void {
    this.add
      .text(
        GameView.width / 2,
        BenchLayout.titleY,
        "Growth — The Bench",
        BenchTextStyles.title
      )
      .setOrigin(0.5, 0);
    this.#gristText = this.add.text(
      BenchLayout.gristX,
      BenchLayout.gristY,
      "",
      BenchTextStyles.grist
    );
  }

  /**
   * Build the equip-shard button: a tappable box that publishes an `equip` intent
   * for the Ashling shard. The label/stroke reflect equipped state on render.
   * @returns The equip button box (retained for restyle on render).
   */
  #buildEquipButton(): Phaser.GameObjects.NineSlice {
    const box = addPanel(
      this,
      BenchLayout.equipX,
      BenchLayout.equipY,
      BenchLayout.equipWidth,
      BenchLayout.equipHeight
    );
    enablePanelTap(box, BenchLayout.equipWidth, BenchLayout.equipHeight, () => {
      this.#input.tapEquip(ASHLING_SHARD);
    });
    this.#equipLabel = this.add
      .text(BenchLayout.equipX, BenchLayout.equipY, "", BenchTextStyles.button)
      .setOrigin(0.5);
    return box;
  }

  /**
   * Build one sink button at the given row: a tappable box that publishes a
   * `buy-sink` intent for that sink. The label (name + cost) and the enabled
   * styling are set on render.
   * @param id - The sink id this button buys.
   * @param row - The zero-based row index (stacks downward by `rowGap`).
   * @returns The pooled sink button.
   */
  #buildSinkButton(id: BenchSinkId, row: number): SinkButton {
    const y = BenchLayout.firstSinkY + row * BenchLayout.rowGap;
    const box = addPanel(
      this,
      BenchLayout.sinkX,
      y,
      BenchLayout.sinkWidth,
      BenchLayout.sinkHeight
    );
    enablePanelTap(box, BenchLayout.sinkWidth, BenchLayout.sinkHeight, () => {
      this.#input.tapBuySink(id);
    });
    const label = this.add
      .text(BenchLayout.sinkX, y, "", BenchTextStyles.button)
      .setOrigin(0.5);
    return { id, box, label };
  }

  /**
   * Build the Cinder learning-progress bar (background, fill, caption). The fill
   * width and caption are updated on render.
   * @returns void
   */
  #buildProgressBar(): void {
    this.add
      .rectangle(
        BenchLayout.progressX,
        BenchLayout.progressY,
        BenchLayout.progressWidth,
        BenchLayout.progressHeight,
        BenchColors.progressBg
      )
      .setOrigin(0, 0.5);
    this.#progressFill = this.add
      .rectangle(
        BenchLayout.progressX,
        BenchLayout.progressY,
        0,
        BenchLayout.progressHeight,
        BenchColors.progressFill
      )
      .setOrigin(0, 0.5);
    this.#progressLabel = this.add
      .text(
        BenchLayout.progressX,
        BenchLayout.progressY - BenchLayout.progressHeight,
        "",
        BenchTextStyles.progress
      )
      .setOrigin(0, 1);
  }

  /**
   * Render the whole screen from the live run-state: the shared grist, the equip
   * button (equipped vs. not), each sink's affordability styling, and the Cinder
   * progress bar. Pure read of `this.#run` — the scene derives nothing it does not
   * read from state.
   * @returns void
   */
  #render(): void {
    this.#gristText.setText(`Grist: ${this.#run.wallet.grist}`);
    this.#renderEquip();
    this.#sinks.forEach(button => this.#renderSink(button));
    this.#renderProgress();
  }

  /**
   * Style the equip button from whether the Ashling shard is already equipped:
   * once equipped its label reads "equipped" and its stroke turns the equipped
   * accent (re-equipping is a harmless no-op the reducer absorbs).
   * @returns void
   */
  #renderEquip(): void {
    const equipped = this.#run.equippedShards.includes(ASHLING_SHARD);
    this.#equipLabel.setText(
      equipped
        ? "The Marrow Bound — equipped (learning Cinder)"
        : "Equip: The Marrow Bound"
    );
    this.#equipBox.setTint(equipped ? PanelTint.equipped : PanelTint.frame);
  }

  /**
   * Style one sink button from whether the reducer would *accept* its purchase:
   * the wallet must cover the cost AND, for a `teaches` sink, its spell must be in
   * progress (a `teaches` sink no-ops before the shard is equipped — see
   * {@link applyBenchSink}). The label shows the name + grist cost, and a disabled
   * sink is dimmed (fill + text) so it never looks actionable while it would
   * silently no-op. The rule still lives in the reducer — this only mirrors it.
   * @param button - The pooled sink button to restyle.
   * @returns void
   */
  #renderSink(button: SinkButton): void {
    const sink = BENCH_SINKS[button.id];
    const enabled =
      this.#run.wallet.grist >= sink.gristCost &&
      (sink.teaches === undefined ||
        isLearning(this.#run.learning, sink.teaches));
    button.label
      .setText(`${sink.name}  —  ${sink.gristCost} grist`)
      .setColor(
        enabled ? BenchColors.buttonText : BenchColors.buttonTextDisabled
      );
    button.box.setTint(enabled ? PanelTint.frame : PanelTint.disabled);
  }

  /**
   * Render the Cinder progress bar from the learning state: the fill spans the
   * unlock fraction in [0, 1], and the caption reports the percentage (or that
   * Cinder is not yet begun before the shard is equipped).
   * @returns void
   */
  #renderProgress(): void {
    const progress = learningProgress(this.#run.learning, SpellIds.cinder);
    this.#progressFill.setDisplaySize(
      BenchLayout.progressWidth * progress,
      BenchLayout.progressHeight
    );
    const begun =
      isLearning(this.#run.learning, SpellIds.cinder) || progress > 0;
    this.#progressLabel.setText(
      begun
        ? `Cinder: ${Math.round(progress * 100)}%`
        : "Cinder: not begun (equip the shard)"
    );
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
