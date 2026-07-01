import { describe, expect, it } from "vitest";
import {
  GRIST_GOLD,
  GRIST_GOLD_CSS,
  GristPalette,
  desaturate,
  hexToCss,
  hexToRgb,
  mixHex,
  rgbToHex,
} from "../../src/logic/render/palette";

describe("palette color primitives", () => {
  it("round-trips a hex through rgb and back", () => {
    for (const hex of [0x000000, 0xffffff, 0x1b2230, 0xffd166, 0x6fd08c]) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    }
  });

  it("splits a hex into 8-bit channels", () => {
    expect(hexToRgb(0x1b2230)).toEqual({ r: 0x1b, g: 0x22, b: 0x30 });
    expect(hexToRgb(0xffd166)).toEqual({ r: 0xff, g: 0xd1, b: 0x66 });
  });

  it("clamps channels back into 0x000000..0xffffff on compose", () => {
    expect(rgbToHex({ r: 300, g: -5, b: 0x66 })).toBe(0xff0066);
  });
});

describe("desaturate", () => {
  it("is the identity at amount 0", () => {
    for (const hex of [0x1b2230, 0xffd166, 0x6fd08c]) {
      expect(desaturate(hex, 0)).toBe(hex);
    }
  });

  it("collapses to a single gray at amount 1 (r == g == b)", () => {
    const gray = hexToRgb(desaturate(0x6fd08c, 1));
    expect(gray.r).toBe(gray.g);
    expect(gray.g).toBe(gray.b);
  });

  it("preserves perceptual luminance when fully desaturated", () => {
    // The gray produced at amount 1 equals the Rec.601 luma of the source,
    // so a desaturated color keeps its brightness — the pass drains chroma,
    // not light.
    const src = hexToRgb(0x6fd08c);
    const luma = Math.round(0.299 * src.r + 0.587 * src.g + 0.114 * src.b);
    expect(hexToRgb(desaturate(0x6fd08c, 1))).toEqual({
      r: luma,
      g: luma,
      b: luma,
    });
  });

  it("is deterministic (same input, same output)", () => {
    expect(desaturate(0x6fd08c, 0.4)).toBe(desaturate(0x6fd08c, 0.4));
  });

  it("clamps the amount to [0, 1]", () => {
    expect(desaturate(0x6fd08c, 2)).toBe(desaturate(0x6fd08c, 1));
    expect(desaturate(0x6fd08c, -1)).toBe(desaturate(0x6fd08c, 0));
  });

  it("moves a saturated color strictly toward gray between the endpoints", () => {
    const src = hexToRgb(0x6fd08c);
    const mid = hexToRgb(desaturate(0x6fd08c, 0.5));
    const spread = (c: { r: number; g: number; b: number }): number =>
      Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    expect(spread(mid)).toBeLessThan(spread(src));
    expect(spread(mid)).toBeGreaterThan(0);
  });
});

describe("mixHex", () => {
  it("returns the first color at t=0 and the second at t=1", () => {
    expect(mixHex(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixHex(0x000000, 0xffffff, 1)).toBe(0xffffff);
  });

  it("returns a channel-wise midpoint at t=0.5", () => {
    // 255 * 0.5 = 127.5, which rounds to 128 (0x80) on each channel.
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });

  it("clamps t to [0, 1]", () => {
    expect(mixHex(0x102030, 0x405060, 2)).toBe(0x405060);
    expect(mixHex(0x102030, 0x405060, -1)).toBe(0x102030);
  });
});

describe("hexToCss", () => {
  it("formats a color as a zero-padded #rrggbb string", () => {
    expect(hexToCss(0xffd166)).toBe("#ffd166");
    expect(hexToCss(0x000000)).toBe("#000000");
    expect(hexToCss(0x0d111a)).toBe("#0d111a");
  });

  it("exposes grist-gold as a CSS string matching the numeric constant", () => {
    expect(GRIST_GOLD_CSS).toBe(hexToCss(GRIST_GOLD));
    expect(GRIST_GOLD_CSS).toBe("#ffd166");
  });
});

describe("GristPalette", () => {
  it("names grist-gold as its canonical highlight", () => {
    expect(GRIST_GOLD).toBe(0xffd166);
    expect(GristPalette.highlight).toBe(GRIST_GOLD);
  });

  it("is a desaturated cool base (base darker/cooler than the highlight)", () => {
    const base = hexToRgb(GristPalette.base);
    const highlight = hexToRgb(GristPalette.highlight);
    // The grist-gold highlight is warmer (more red than blue) than the cool base.
    expect(highlight.r - highlight.b).toBeGreaterThan(base.r - base.b);
  });

  it("keeps the field floor/wall cooler than the grist-gold highlight", () => {
    // A low chroma spread on the structural tones is what "desaturated" means here.
    const spread = (hex: number): number => {
      const c = hexToRgb(hex);
      return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    };
    expect(spread(GristPalette.floor)).toBeLessThan(
      spread(GristPalette.highlight)
    );
    expect(spread(GristPalette.wall)).toBeLessThan(
      spread(GristPalette.highlight)
    );
  });
});
