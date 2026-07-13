import type { Point } from "./types";

// Aliased (no anti-aliasing) polyline rasterizer — the classic Paint way to
// draw a straight stroke. It walks a Bresenham line between consecutive
// vertices and stamps a round brush (a filled disc of diameter `size`) at every
// integer step. A disc has the same width in every direction, so the stroke's
// perpendicular thickness is the SAME at every angle: a horizontal, a vertical,
// and a 45° line all read as `size` px — no heavier-diagonal effect.
//
// This replaces stroking with the canvas 2D API + alpha hardening, which left
// anti-aliased diagonals ~25% heavier than crisp axis-aligned runs. Integer
// fillRects are never anti-aliased and the run is gapless, so a flood fill still
// can't leak through the outline.
export function strokeAliasedPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  size: number,
  color: string,
  closed = false,
): void {
  if (points.length === 0) return;
  const s = Math.max(1, Math.round(size));
  // Use the true half-size radius (e.g. 2.5 for size 5), not a floored integer,
  // or small brushes come out diamond-shaped and diagonals go thin.
  const rad = s / 2;
  const ry = Math.floor(rad);
  // Precompute the disc as one horizontal span (half-width) per row, so each
  // stamp is a handful of fillRects rather than a per-pixel loop.
  const spans: Array<[number, number]> = [];
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.floor(Math.sqrt(rad * rad - dy * dy));
    spans.push([dy, hw]);
  }
  ctx.save();
  ctx.fillStyle = color;
  const stamp = (x: number, y: number) => {
    for (const [dy, hw] of spans) ctx.fillRect(x - hw, y + dy, 2 * hw + 1, 1);
  };

  if (points.length === 1) {
    const p = points[0];
    stamp(Math.round(p.x), Math.round(p.y));
    ctx.restore();
    return;
  }

  const segs = closed ? points.length : points.length - 1;
  for (let i = 0; i < segs; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    bresenham(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y), stamp);
  }
  ctx.restore();
}

// Integer Bresenham line; calls `plot` for each cell on the line from (x0,y0)
// to (x1,y1) inclusive.
function bresenham(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plot: (x: number, y: number) => void,
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  // Guard against a pathological run (shouldn't happen with clamped coords).
  for (let guard = 0; guard < 1e7; guard++) {
    plot(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}
