import { describe, expect, it } from "vitest";
import {
  constrainSquare,
  constrainTo45,
  normalizeRect,
  oddStrokeOffset,
  roundPoint,
} from "./shapes";

describe("constrainTo45", () => {
  it("snaps a nearly-horizontal drag to exactly horizontal", () => {
    const end = constrainTo45({ x: 0, y: 0 }, { x: 10, y: 1 });
    expect(end.y).toBeCloseTo(0, 6);
    expect(end.x).toBeCloseTo(Math.hypot(10, 1), 6);
  });

  it("snaps to the diagonal and preserves the drag length", () => {
    const end = constrainTo45({ x: 0, y: 0 }, { x: 9, y: 11 });
    expect(end.x).toBeCloseTo(end.y, 6); // 45°
    expect(Math.hypot(end.x, end.y)).toBeCloseTo(Math.hypot(9, 11), 6);
  });

  it("works in all quadrants", () => {
    const end = constrainTo45({ x: 5, y: 5 }, { x: -6, y: 4 });
    expect(end.y).toBeCloseTo(5, 6); // snapped back to horizontal, leftward
    expect(end.x).toBeLessThan(5);
  });
});

describe("constrainSquare", () => {
  it("forces equal extents, preserving each axis's direction", () => {
    expect(constrainSquare({ x: 0, y: 0 }, { x: 10, y: -4 })).toEqual({
      x: 10,
      y: -10,
    });
  });

  it("keeps a perfect square unchanged", () => {
    expect(constrainSquare({ x: 5, y: 5 }, { x: 1, y: 9 })).toEqual({
      x: 1,
      y: 9,
    });
  });
});

describe("normalizeRect", () => {
  it("normalizes corners dragged up-left into a positive rect", () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 4, y: 8 })).toEqual({
      x: 4,
      y: 8,
      w: 6,
      h: 12,
    });
  });

  it("returns a zero-size rect for a click without drag", () => {
    expect(normalizeRect({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual({
      x: 3,
      y: 3,
      w: 0,
      h: 0,
    });
  });
});

describe("oddStrokeOffset", () => {
  // Odd widths need the half-pixel shift or alpha-hardening commits them one
  // pixel too thick (see the comment at the definition).
  it("offsets odd widths by half a pixel and even widths not at all", () => {
    expect(oddStrokeOffset(1)).toBe(0.5);
    expect(oddStrokeOffset(3)).toBe(0.5);
    expect(oddStrokeOffset(5)).toBe(0.5);
    expect(oddStrokeOffset(2)).toBe(0);
    expect(oddStrokeOffset(8)).toBe(0);
  });
});

describe("roundPoint", () => {
  it("rounds both coordinates to the pixel grid", () => {
    expect(roundPoint({ x: 1.4, y: 2.5 })).toEqual({ x: 1, y: 3 });
  });
});
