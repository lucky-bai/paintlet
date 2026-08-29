import { describe, expect, it } from "vitest";
import {
  BRUSH_LADDER,
  BRUSH_MAX,
  BRUSH_MIN,
  SHAPE_SIZES,
  nextBrushSize,
  nextShapeSize,
} from "./sizes";

describe("nextBrushSize", () => {
  it("steps by a pixel while the stroke is thin", () => {
    expect(nextBrushSize(4, 1)).toBe(5);
    expect(nextBrushSize(4, -1)).toBe(3);
  });

  it("steps coarser as the stroke grows", () => {
    expect(nextBrushSize(10, 1)).toBe(12);
    expect(nextBrushSize(24, 1)).toBe(28);
  });

  it("clamps to the ends of the ladder", () => {
    expect(nextBrushSize(BRUSH_MIN, -1)).toBe(BRUSH_MIN);
    expect(nextBrushSize(BRUSH_MAX, 1)).toBe(BRUSH_MAX);
  });

  it("moves to the neighbouring rung from an off-ladder slider width", () => {
    expect(nextBrushSize(11, 1)).toBe(12);
    expect(nextBrushSize(11, -1)).toBe(10);
  });

  it("is symmetric: growing then shrinking returns to the start", () => {
    for (const n of BRUSH_LADDER.slice(0, -1)) {
      expect(nextBrushSize(nextBrushSize(n, 1), -1)).toBe(n);
    }
  });

  it("reaches the full range in a couple of dozen presses", () => {
    let n = BRUSH_MIN;
    let presses = 0;
    while (n < BRUSH_MAX && presses < 100) {
      n = nextBrushSize(n, 1);
      presses++;
    }
    expect(n).toBe(BRUSH_MAX);
    expect(presses).toBeLessThanOrEqual(30);
  });
});

describe("nextShapeSize", () => {
  it("walks the discrete ladder", () => {
    expect(nextShapeSize(1, 1)).toBe(3);
    expect(nextShapeSize(5, -1)).toBe(3);
  });

  it("clamps at both ends", () => {
    expect(nextShapeSize(SHAPE_SIZES[0], -1)).toBe(SHAPE_SIZES[0]);
    expect(nextShapeSize(SHAPE_SIZES[SHAPE_SIZES.length - 1], 1)).toBe(
      SHAPE_SIZES[SHAPE_SIZES.length - 1],
    );
  });
});
