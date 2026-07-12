import { describe, expect, it } from "vitest";
import { hsvToRgb, isHexColor, rgbToHsv } from "./color";

describe("hsv/rgb conversion", () => {
  it("round-trips primary colors", () => {
    const cases: [number, number, number][] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [0, 0, 0],
      [255, 255, 255],
      [18, 171, 52],
    ];
    for (const [r, g, b] of cases) {
      const { h, s, v } = rgbToHsv(r, g, b);
      const [r2, g2, b2] = hsvToRgb(h, s, v).map(Math.round);
      expect([r2, g2, b2]).toEqual([r, g, b]);
    }
  });

  it("maps hue 0 / 120 / 240 to red / green / blue", () => {
    expect(hsvToRgb(0, 1, 1).map(Math.round)).toEqual([255, 0, 0]);
    expect(hsvToRgb(120, 1, 1).map(Math.round)).toEqual([0, 255, 0]);
    expect(hsvToRgb(240, 1, 1).map(Math.round)).toEqual([0, 0, 255]);
  });

  it("reports zero saturation for greys", () => {
    expect(rgbToHsv(128, 128, 128).s).toBe(0);
  });
});

describe("isHexColor", () => {
  it("accepts #rgb and #rrggbb, with or without the hash", () => {
    for (const s of ["#fff", "fff", "#ffffff", "#12ab34", "AABBCC"])
      expect(isHexColor(s)).toBe(true);
  });
  it("rejects malformed input", () => {
    for (const s of ["#ff", "#fffff", "#ggg", "red", "#12ab3g"])
      expect(isHexColor(s)).toBe(false);
  });
});
