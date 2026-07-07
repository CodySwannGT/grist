/**
 * The growth/bench **board** view (#246) — the pooled game objects that render the
 * Bench's build state (the shared-grist readout, the equip-shard button, the two
 * grist-sink buttons, and the Cinder learning-progress bar) plus their pointer taps.
 * Extracted from the {@link import("../scenes/Bench").Bench} scene so the scene stays
 * under its line budget and the board's Phaser plumbing lives next to the state it
 * draws, the way {@link import("./help-panel").HelpPanel} and the ledger codex panel
 * were split out of the Menu.
 *
 * It owns NO economy or learning rules — it only RENDERS a {@link RunState} the scene
 * hands it and EMITS the concrete `equip` / `buy-sink` intents through the shared
 * {@link BenchInputService} on a tap (the same semantic boundary the keyboard's
 * navigate-then-confirm path uses). Affordability styling mirrors the pure
 * {@link applyBenchSink} reducer so a disabled sink never looks actionable while it
 * would silently no-op; the rule still lives in the reducer.
 * @module ui/bench-board
 */
import Phaser from "phaser";
import { BenchColors, BenchLayout, BenchTextStyles, GameView } from "../consts";
import { BenchSinkIds, BENCH_SINKS, type BenchSinkId } from "../content/bench";
import { BoundIds } from "../content/bounds";
import { SpellIds } from "../content/spells";
import { type RunState } from "../logic/run-state";
import { isLearning, learningProgress } from "../logic/spell-learning";
import { type BenchInputService } from "../services/bench-input";
import { addPanel, enablePanelTap, PanelTint } from "./chrome";

/** The shard the bench equips (the Ashling reward shard that teaches Cinder). */
export const ASHLING_SHARD = BoundIds.marrowBound;

/**
 * The sinks the board stacks, top to bottom — Runner's Reflex then Accelerate:
 * Cinder. Authored explicitly so the row order stays locked to the focus ring's
 * sink order in {@link import("../logic/bench-focus").BENCH_CONTROL_ORDER}.
 */
const SINK_ROWS: readonly BenchSinkId[] = [
  BenchSinkIds.runnersReflex,
  BenchSinkIds.accelerateCinder,
];

/** The pooled objects for one sink button (its highlight box + label). */
interface SinkButton {
  readonly id: BenchSinkId;
  readonly box: Phaser.GameObjects.NineSlice;
  readonly label: Phaser.GameObjects.Text;
}

/** Renders the bench's build state and emits the concrete growth taps. */
export class BenchBoard {
  readonly #gristText: Phaser.GameObjects.Text;
  readonly #equipBox: Phaser.GameObjects.NineSlice;
  readonly #equipLabel: Phaser.GameObjects.Text;
  readonly #sinks: readonly SinkButton[];
  readonly #progressFill: Phaser.GameObjects.Rectangle;
  readonly #progressLabel: Phaser.GameObjects.Text;

  /**
   * Build the static board chrome (title, grist readout, equip button, the sink
   * buttons, the progress bar) and wire each button's pointer tap to the semantic
   * input service. Call {@link render} to paint the live run-state.
   * @param scene - The owning Bench scene (for its display list).
   * @param input - The bench input service the taps publish intents through.
   */
  constructor(scene: Phaser.Scene, input: BenchInputService) {
    scene.add
      .text(
        GameView.width / 2,
        BenchLayout.titleY,
        "Growth — The Bench",
        BenchTextStyles.title
      )
      .setOrigin(0.5, 0);
    this.#gristText = scene.add.text(
      BenchLayout.gristX,
      BenchLayout.gristY,
      "",
      BenchTextStyles.grist
    );
    this.#equipBox = this.#buildEquipButton(scene, input);
    this.#equipLabel = scene.add
      .text(BenchLayout.equipX, BenchLayout.equipY, "", BenchTextStyles.button)
      .setOrigin(0.5);
    this.#sinks = SINK_ROWS.map((id, row) =>
      this.#buildSinkButton(scene, input, id, row)
    );
    this.#progressFill = this.#buildProgressBar(scene);
    this.#progressLabel = scene.add
      .text(
        BenchLayout.progressX,
        BenchLayout.progressY - BenchLayout.progressHeight,
        "",
        BenchTextStyles.progress
      )
      .setOrigin(0, 1);
  }

  /**
   * Build the equip-shard button: a tappable box that publishes an `equip` intent
   * for the Ashling shard.
   * @param scene - The owning scene.
   * @param input - The input service the tap publishes through.
   * @returns The equip button box (retained for restyle on render).
   */
  #buildEquipButton(
    scene: Phaser.Scene,
    input: BenchInputService
  ): Phaser.GameObjects.NineSlice {
    const box = addPanel(
      scene,
      BenchLayout.equipX,
      BenchLayout.equipY,
      BenchLayout.equipWidth,
      BenchLayout.equipHeight
    );
    enablePanelTap(box, BenchLayout.equipWidth, BenchLayout.equipHeight, () => {
      input.tapEquip(ASHLING_SHARD);
    });
    return box;
  }

  /**
   * Build one sink button at the given row: a tappable box that publishes a
   * `buy-sink` intent for that sink. The label and enabled styling are set on render.
   * @param scene - The owning scene.
   * @param input - The input service the tap publishes through.
   * @param id - The sink id this button buys.
   * @param row - The zero-based row index (stacks downward by `rowGap`).
   * @returns The pooled sink button.
   */
  #buildSinkButton(
    scene: Phaser.Scene,
    input: BenchInputService,
    id: BenchSinkId,
    row: number
  ): SinkButton {
    const y = BenchLayout.firstSinkY + row * BenchLayout.rowGap;
    const box = addPanel(
      scene,
      BenchLayout.sinkX,
      y,
      BenchLayout.sinkWidth,
      BenchLayout.sinkHeight
    );
    enablePanelTap(box, BenchLayout.sinkWidth, BenchLayout.sinkHeight, () => {
      input.tapBuySink(id);
    });
    const label = scene.add
      .text(BenchLayout.sinkX, y, "", BenchTextStyles.button)
      .setOrigin(0.5);
    return { id, box, label };
  }

  /**
   * Build the Cinder learning-progress bar (background, fill, caption). The fill
   * width and caption are updated on render.
   * @param scene - The owning scene.
   * @returns The progress fill rectangle (retained for resize on render).
   */
  #buildProgressBar(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
    scene.add
      .rectangle(
        BenchLayout.progressX,
        BenchLayout.progressY,
        BenchLayout.progressWidth,
        BenchLayout.progressHeight,
        BenchColors.progressBg
      )
      .setOrigin(0, 0.5);
    return scene.add
      .rectangle(
        BenchLayout.progressX,
        BenchLayout.progressY,
        0,
        BenchLayout.progressHeight,
        BenchColors.progressFill
      )
      .setOrigin(0, 0.5);
  }

  /**
   * Render the whole board from the live run-state: the shared grist, the equip
   * button (equipped vs. not), each sink's affordability styling, and the Cinder
   * progress bar. A pure read of the run — the board derives nothing it does not read.
   * @param run - The live run-state to paint.
   * @returns void
   */
  render(run: RunState): void {
    this.#gristText.setText(`Grist: ${run.wallet.grist}`);
    this.#renderEquip(run);
    this.#sinks.forEach(button => this.#renderSink(run, button));
    this.#renderProgress(run);
  }

  /**
   * Style the equip button from whether the Ashling shard is already equipped:
   * once equipped its label reads "equipped" and its tint turns the equipped accent.
   * @param run - The live run-state.
   * @returns void
   */
  #renderEquip(run: RunState): void {
    const equipped = run.equippedShards.includes(ASHLING_SHARD);
    this.#equipLabel.setText(
      equipped
        ? "The Marrow Bound — equipped (learning Cinder)"
        : "Equip: The Marrow Bound"
    );
    this.#equipBox.setTint(equipped ? PanelTint.equipped : PanelTint.frame);
  }

  /**
   * Style one sink button from whether the reducer would *accept* its purchase: the
   * wallet must cover the cost AND, for a `teaches` sink, its spell must be in
   * progress. A disabled sink is dimmed so it never looks actionable while it would
   * silently no-op. The rule still lives in the reducer — this only mirrors it.
   * @param run - The live run-state.
   * @param button - The pooled sink button to restyle.
   * @returns void
   */
  #renderSink(run: RunState, button: SinkButton): void {
    const sink = BENCH_SINKS[button.id];
    const enabled =
      run.wallet.grist >= sink.gristCost &&
      (sink.teaches === undefined || isLearning(run.learning, sink.teaches));
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
   * @param run - The live run-state.
   * @returns void
   */
  #renderProgress(run: RunState): void {
    const progress = learningProgress(run.learning, SpellIds.cinder);
    this.#progressFill.setDisplaySize(
      BenchLayout.progressWidth * progress,
      BenchLayout.progressHeight
    );
    const begun = isLearning(run.learning, SpellIds.cinder) || progress > 0;
    this.#progressLabel.setText(
      begun
        ? `Cinder: ${Math.round(progress * 100)}%`
        : "Cinder: not begun (equip the shard)"
    );
  }
}
