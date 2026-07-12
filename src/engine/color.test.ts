import { describe, expect, it } from "vitest";
import { hexToRgba, rgbToHex } from "./color";

describe("hexToRgba", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgba("#00a2e8")).toEqual([0, 162, 232, 255]);
  });

  it("expands 3-digit shorthand", () => {
    expect(hexToRgba("#fff")).toEqual([255, 255, 255, 255]);
    expect(hexToRgba("#f0a")).toEqual([255, 0, 170, 255]);
  });

  it("reads an explicit alpha byte from 8-digit hex", () => {
    expect(hexToRgba("#11223344")).toEqual([17, 34, 51, 68]);
  });
});

describe("rgbToHex", () => {
  it("formats with zero padding", () => {
    expect(rgbToHex(0, 162, 232)).toBe("#00a2e8");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
  });

  it("round-trips with hexToRgba", () => {
    const [r, g, b] = hexToRgba("#7f3fc4");
    expect(rgbToHex(r, g, b)).toBe("#7f3fc4");
  });
});
