/**
 * Pure, Phaser-free color model for the demo palette pass (PD-3.9 / #114). GRIST
 * reads as a drained, cold world lit by one warm signal — **grist-gold** — so the
 * demo's "desaturation + grist-gold" grade is a *transform*, not a bag of
 * hand-picked hex: this module owns the canonical {@link GristPalette} and the
 * deterministic {@link desaturate} / {@link mixHex} primitives that produce it.
 * Scene color constants (`FieldColors`, `RegionColors`, …) derive their structural
 * tones from here so the grade is coherent across every surface and a change is a
 * single edit.
 *
 * Zero Phaser, zero I/O, zero randomness — the whole module typechecks under plain
 * `tsc` and is asserted headless by `tests/logic/palette.test.ts`. Colors are plain
 * 24-bit `0xRRGGBB` numbers (Phaser's fill format) so the values round-trip and the
 * transform is a total function of its inputs. Per decision 0006 the 384×216
 * baseline is untouched — this is a color grade, not a resolution change.
 * @module logic/render/palette
 */

/** The maximum value of one 8-bit color channel. */
const CHANNEL_MAX = 255;

/** Rec.601 luma weights — the perceptual brightness of a color, summing to 1. */
const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

/**
 * The canonical **grist-gold** highlight (`0xffd166`) — the one warm accent in the
 * drained palette (the wallet readout, the room-name banner, a cleared marker).
 * Every surface that wants "the grist signal" imports this, so the gold can never
 * drift between the HUD, the field, and the region views.
 */
export const GRIST_GOLD = 0xffd166;

/** A color decomposed into its three 8-bit channels. Plain, serializable data. */
export interface Rgb {
  /** The red channel, 0–255. */
  readonly r: number;
  /** The green channel, 0–255. */
  readonly g: number;
  /** The blue channel, 0–255. */
  readonly b: number;
}

/**
 * Clamp a number into the closed range `[min, max]`. Total — used to keep composed
 * channels and lerp factors in bounds so a caller can never produce an out-of-gamut
 * color or read past an endpoint.
 * @param value - The value to clamp.
 * @param min - The lower bound (inclusive).
 * @param max - The upper bound (inclusive).
 * @returns The value clamped into `[min, max]`.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Split a 24-bit `0xRRGGBB` color into its three 8-bit channels.
 * @param hex - The packed color.
 * @returns The `{ r, g, b }` channels, each 0–255.
 */
export function hexToRgb(hex: number): Rgb {
  return {
    r: (hex >> 16) & CHANNEL_MAX,
    g: (hex >> 8) & CHANNEL_MAX,
    b: hex & CHANNEL_MAX,
  };
}

/**
 * Pack three channels back into a 24-bit `0xRRGGBB` color, rounding and clamping
 * each into `0..255` first so an arithmetic result (a lerp, a desaturation) can
 * never overflow its channel or leak into an adjacent one.
 * @param rgb - The channels to pack (may be fractional / out of range).
 * @returns The packed `0xRRGGBB` color.
 */
export function rgbToHex(rgb: Rgb): number {
  const r = clamp(Math.round(rgb.r), 0, CHANNEL_MAX);
  const g = clamp(Math.round(rgb.g), 0, CHANNEL_MAX);
  const b = clamp(Math.round(rgb.b), 0, CHANNEL_MAX);
  return (r << 16) | (g << 8) | b;
}

/**
 * The Rec.601 perceptual luma of a color (its gray value): the brightness a fully
 * desaturated version keeps. Weighted so green reads brightest and blue darkest,
 * matching human perception.
 * @param rgb - The color to measure.
 * @returns The luma, 0–255 (fractional).
 */
function luma(rgb: Rgb): number {
  return LUMA_R * rgb.r + LUMA_G * rgb.g + LUMA_B * rgb.b;
}

/**
 * Drain a color toward gray by `amount` (0 = unchanged, 1 = fully gray at the
 * color's own luma) — the demo's desaturation pass as a pure, deterministic
 * transform. Each channel lerps toward the shared {@link luma}, so brightness is
 * preserved while chroma collapses; `amount` is clamped to `[0, 1]`.
 * @param hex - The source `0xRRGGBB` color.
 * @param amount - How far to desaturate, clamped to `[0, 1]`.
 * @returns The desaturated `0xRRGGBB` color.
 */
export function desaturate(hex: number, amount: number): number {
  const t = clamp(amount, 0, 1);
  const rgb = hexToRgb(hex);
  const gray = luma(rgb);
  return rgbToHex({
    r: rgb.r + (gray - rgb.r) * t,
    g: rgb.g + (gray - rgb.g) * t,
    b: rgb.b + (gray - rgb.b) * t,
  });
}

/**
 * Linearly blend two colors channel-wise: `t = 0` returns `from`, `t = 1` returns
 * `to`, values between mix them. `t` is clamped to `[0, 1]`. Used to derive a tone
 * (e.g. a mid-desaturated structural color, or a fade frame) from two anchors.
 * @param from - The `0xRRGGBB` color at `t = 0`.
 * @param to - The `0xRRGGBB` color at `t = 1`.
 * @param t - The blend factor, clamped to `[0, 1]`.
 * @returns The blended `0xRRGGBB` color.
 */
export function mixHex(from: number, to: number, t: number): number {
  const k = clamp(t, 0, 1);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  });
}

/**
 * Format a 24-bit `0xRRGGBB` color as a CSS `#rrggbb` string — the form Phaser text
 * styles want (fill colors take the number, text colors take the string). Lets a
 * single palette constant drive both a rectangle fill and a label color, so the
 * grist-gold can never drift between a shape and its text.
 * @param hex - The packed `0xRRGGBB` color.
 * @returns The color as a lowercase `#rrggbb` CSS string.
 */
export function hexToCss(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** The grist-gold highlight as a CSS `#rrggbb` string (for Phaser text styles). */
export const GRIST_GOLD_CSS = hexToCss(GRIST_GOLD);

/**
 * The canonical demo palette: a desaturated, cool structural base lit by the one
 * warm {@link GRIST_GOLD} highlight. The structural tones (`base`/`floor`/`wall`/
 * `line`) are the existing cool Marrow hues run through a light desaturation so the
 * world reads drained; `highlight` is the untouched grist-gold so the grist signal
 * stays vivid against it. Scene color constants pull their structural tones from
 * here to keep the grade coherent. Frozen `as const` — the palette is data.
 */
export const GristPalette = {
  /** The darkest cool base (backdrops / panel fills). */
  base: desaturate(0x141821, 0.35),
  /** The Marrow floor tone. */
  floor: desaturate(0x1b2230, 0.35),
  /** The Marrow wall tone (darker than the floor). */
  wall: desaturate(0x10141d, 0.35),
  /** The structural line/edge tone. */
  line: desaturate(0x39455c, 0.35),
  /** The one warm accent — the grist signal. Left un-desaturated on purpose. */
  highlight: GRIST_GOLD,
} as const;
