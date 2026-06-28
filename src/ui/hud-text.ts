/**
 * HUD text primitives: a churn-free {@link GuardedText} wrapper (it re-renders the
 * Phaser text texture only when the string or color actually changes, so the
 * per-frame HUD render allocates nothing and repaints nothing static), a factory
 * for the HUD's monospace label style, and a combatant display-name resolver. The
 * slice has no bitmap font asset, so high-churn values are kept cheap by guarding
 * `setText`/`setColor` rather than by a BitmapText atlas — the same effect, no
 * asset pipeline. Pure helpers around Phaser objects; no game state.
 * @module ui/hud-text
 */
import Phaser from "phaser";
import { ENEMIES, PARTY } from "../content";
import { HudColors } from "./layout";

/** The HUD label font: small, crisp monospace that reads at 384×216. */
const HUD_FONT = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: HudColors.text,
} as const;

/**
 * A Phaser {@link Phaser.GameObjects.Text} that only repaints when its content or
 * color changes — the key to a steady-state-allocation-free HUD. Construct via
 * {@link makeText}; drive with {@link set} each frame.
 */
export class GuardedText {
  readonly #text: Phaser.GameObjects.Text;
  #lastValue: string | null = null;
  #lastColor: string | null = null;

  /**
   * Wrap a Phaser text object.
   * @param text - The text object to guard.
   */
  constructor(text: Phaser.GameObjects.Text) {
    this.#text = text;
  }

  /**
   * Update the displayed string and (optionally) its color, repainting only on an
   * actual change.
   * @param value - The string to display.
   * @param color - The CSS color to apply, or undefined to leave it.
   * @returns void
   */
  set(value: string, color?: string): void {
    if (value !== this.#lastValue) {
      this.#lastValue = value;
      this.#text.setText(value);
    }
    if (color !== undefined && color !== this.#lastColor) {
      this.#lastColor = color;
      this.#text.setColor(color);
    }
  }

  /**
   * The wrapped text game object (for positioning, depth, interactivity).
   * @returns The underlying Phaser text object.
   */
  get object(): Phaser.GameObjects.Text {
    return this.#text;
  }
}

/**
 * Create a HUD label at a logical position with the shared monospace style and
 * the given origin, wrapped in a {@link GuardedText}.
 * @param scene - The owning scene.
 * @param x - Logical x.
 * @param y - Logical y.
 * @param originX - Horizontal origin (0 left … 1 right).
 * @param originY - Vertical origin (0 top … 1 bottom).
 * @returns The guarded label.
 */
export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  originX = 0,
  originY = 0
): GuardedText {
  const text = scene.add.text(x, y, "", HUD_FONT).setOrigin(originX, originY);
  return new GuardedText(text);
}

/**
 * The display name for a combatant `ref` (party member or enemy), falling back to
 * the raw ref id when unknown.
 * @param ref - The combatant content id.
 * @returns The human-readable name.
 */
export function nameForRef(ref: string): string {
  const party = (
    PARTY as Record<string, { readonly name: string } | undefined>
  )[ref];
  const enemy = (
    ENEMIES as Record<string, { readonly name: string } | undefined>
  )[ref];
  return party?.name ?? enemy?.name ?? ref;
}
