import type { Point } from "../engine/types";

// Hard-edged strokes must land on the pixel grid or the alpha-hardening step
// mis-sizes them: an odd-width stroke centered on an integer coordinate covers
// its two edge pixels at exactly 50%, and hardening rounds BOTH up — a "1px"
// line commits 2px wide. Odd widths need their geometry on half-pixel centers.
export function oddStrokeOffset(size: number): number {
  return size % 2 ? 0.5 : 0;
}

export function roundPoint(p: Point): Point {
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

// Snap the end point so the segment lies on a multiple of 45° from the start
// (Shift-constrain for the line tool).
export function constrainTo45(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 4;
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: start.x + Math.cos(snapped) * len,
    y: start.y + Math.sin(snapped) * len,
  };
}

// Force a square/circle bounding box (Shift-constrain for rect/ellipse): equal
// extent in both axes, preserving each axis's direction.
export function constrainSquare(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx || 1) * side,
    y: start.y + Math.sign(dy || 1) * side,
  };
}

// Normalize two corners to a positive-size rect.
export function normalizeRect(
  a: Point,
  b: Point,
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}
