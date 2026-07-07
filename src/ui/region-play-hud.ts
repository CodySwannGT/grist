/**
 * The **region player-mode HUD** (#241) — the thin Phaser painter the Region scene
 * overlays on the shipped side-view when a region is entered from the World Map (the
 * harness `?scene=region` mode is unchanged, so this HUD is never mounted there). It
 * owns no region rules: it renders the run's progress and exposes two controls — an
 * **Engage next encounter** button and a **Back to map** exit — each a tap target (via
 * {@link enablePanelTap}) that fires the callback the scene wired, so the keyboard and
 * pointer paths drive the same actions and no surface is a dead end (#239).
 *
 * `render(cursor, total, complete)` updates the Engage label / progress caption from
 * the pure region run the scene reads; the scene decides when the region is complete
 * (cursor at the playlist end) and this HUD swaps the Engage affordance for a "region
 * cleared" read. Mirrors the Bench's back-control chrome and the shared `ui/*` painter
 * convention. Freed with {@link destroy} from the scene's SHUTDOWN handler.
 * @module ui/region-play-hud
 */
import Phaser from "phaser";
import { GameView } from "../consts";
import {
  RegionPlayColors,
  RegionPlayLayout,
  RegionPlayTextStyles,
} from "../world-map-consts";
import { addPanel, enablePanelTap } from "./chrome";

/** The callbacks the Region scene wires to the HUD's two controls. */
interface RegionPlayHudCallbacks {
  /** Engage the encounter under the run cursor (launch its battle). */
  readonly onEngage: () => void;
  /** Leave the region back to the World Map. */
  readonly onBack: () => void;
}

/** Renders the region player-mode Engage / Back controls and progress caption. */
export class RegionPlayHud {
  readonly #scene: Phaser.Scene;
  readonly #engage: Phaser.GameObjects.NineSlice;
  readonly #engageLabel: Phaser.GameObjects.Text;
  readonly #back: Phaser.GameObjects.NineSlice;
  readonly #hint: Phaser.GameObjects.Text;

  /**
   * Build the Engage button, the Back-to-map control, and the bottom controls hint,
   * wiring each tappable control to the given callback (the keyboard path calls the
   * same callbacks from the scene).
   * @param scene - The owning Region scene.
   * @param callbacks - The Engage / Back handlers.
   */
  constructor(scene: Phaser.Scene, callbacks: RegionPlayHudCallbacks) {
    this.#scene = scene;
    const { engageX, engageY, engageWidth, engageHeight } = RegionPlayLayout;
    this.#engage = addPanel(
      scene,
      engageX,
      engageY,
      engageWidth,
      engageHeight
    ).setOrigin(0.5);
    enablePanelTap(this.#engage, engageWidth, engageHeight, callbacks.onEngage);
    this.#engageLabel = scene.add
      .text(engageX, engageY, "", { ...RegionPlayTextStyles.button })
      .setOrigin(0.5);
    const { backX, backY, backWidth, backHeight } = RegionPlayLayout;
    this.#back = addPanel(scene, backX, backY, backWidth, backHeight).setOrigin(
      0.5
    );
    enablePanelTap(this.#back, backWidth, backHeight, callbacks.onBack);
    scene.add
      .text(backX, backY, "‹ Map", { ...RegionPlayTextStyles.button })
      .setOrigin(0.5);
    this.#hint = scene.add
      .text(
        GameView.width / 2,
        RegionPlayLayout.hintY,
        "[Enter] engage · [Esc] map",
        { ...RegionPlayTextStyles.hint }
      )
      .setOrigin(0.5);
  }

  /**
   * Update the Engage affordance + progress caption from the run cursor. When the
   * region is complete the Engage button is hidden and the hint reads "cleared" — the
   * player leaves via Back, so the surface never dead-ends.
   * @param cursor - Encounters cleared so far.
   * @param total - The live variant's playlist length.
   * @param complete - Whether the region's playlist is finished.
   * @returns void
   */
  render(cursor: number, total: number, complete: boolean): void {
    const progress = `${cursor}/${total}`;
    this.#engage.setVisible(!complete);
    this.#engageLabel
      .setVisible(!complete)
      .setText(`Engage next encounter (${progress})`);
    this.#hint.setText(
      complete
        ? `Region cleared (${progress}) · [Esc] map`
        : "[Enter] engage · [Esc] map"
    );
    this.#hint.setColor(
      complete ? RegionPlayColors.buttonText : RegionPlayColors.hint
    );
  }

  /**
   * Free the tap listeners (the `require-shutdown-cleanup` contract) — the scene calls
   * this from its SHUTDOWN handler.
   * @returns void
   */
  destroy(): void {
    this.#engage.off(Phaser.Input.Events.POINTER_DOWN);
    this.#back.off(Phaser.Input.Events.POINTER_DOWN);
    this.#scene.children.remove(this.#hint);
  }
}
