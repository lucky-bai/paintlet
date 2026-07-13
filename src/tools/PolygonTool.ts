import type { Point } from "../engine/types";
import { strokeAliasedPath } from "../engine/raster";
import { constrainTo45, roundPoint } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Polygon — the classic Paint multi-click shape. Drag (or click) to place the
// first side, then each click adds a vertex; a rubber-band segment follows the
// cursor between clicks. Double-click, or a click back on the first vertex,
// closes the outline back to the start and commits. Shift constrains the
// pending segment to 45°; Esc cancels the whole shape.
export class PolygonTool implements Tool {
  id = "polygon" as const;
  cursor = "crosshair";

  private points: Point[] = []; // committed vertices (session active if nonempty)
  private color = "#000000";
  private lastUpAt = 0; // for double-click detection
  private lastUpPoint: Point | null = null;

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    if (this.points.length === 0) {
      this.points = [p.point];
      this.color = p.button === "secondary" ? ctx.color2 : ctx.color1;
    }
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    this.preview(p, ctx);
  }

  // Between clicks the button is up but the shape is still open — keep the
  // rubber-band segment tracking the cursor.
  onPointerHover(p: PointerInfo, ctx: ToolContext): void {
    if (this.points.length) this.preview(p, ctx);
  }

  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    if (!this.points.length) return;
    const end = this.constrained(p);
    const first = this.points[0];
    // Thresholds are screen-ish distances: divide by zoom so "close" feels the
    // same at 25% and 800%.
    const closePx = 8 / Math.max(ctx.zoom, 0.25);
    const now = performance.now();
    const isDoubleClick =
      this.lastUpPoint !== null &&
      now - this.lastUpAt < 400 &&
      dist(end, this.lastUpPoint) < closePx;
    const onFirstVertex = this.points.length >= 2 && dist(end, first) < closePx;

    if ((isDoubleClick || onFirstVertex) && this.points.length >= 2) {
      this.finish(ctx);
      return;
    }

    // Add the vertex (skip an exact repeat, which would be a useless point).
    const last = this.points[this.points.length - 1];
    if (dist(end, last) >= 1) this.points.push(end);
    this.lastUpAt = now;
    this.lastUpPoint = end;
    this.preview(p, ctx);
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): void {
    if (e.key === "Escape" && this.points.length) {
      this.reset();
      ctx.clearPreview();
    }
  }

  onDeactivate(ctx: ToolContext): void {
    if (this.points.length) {
      this.reset();
      ctx.clearPreview();
    }
  }

  // Close the outline back to the first vertex and commit hard-edged. Aliased
  // rasterization keeps every side the same weight regardless of angle.
  private finish(ctx: ToolContext): void {
    ctx.clearPreview();
    strokeAliasedPath(ctx.overlay, this.points, ctx.size, this.color, true);
    this.reset();
    ctx.commit("polygon"); // already hard-edged
  }

  // Redraw the committed polyline plus the rubber-band segment to the cursor.
  private preview(p: PointerInfo, ctx: ToolContext): void {
    if (!this.points.length) return;
    const end = roundPoint(this.constrained(p));
    ctx.clearPreview();
    strokeAliasedPath(ctx.overlay, [...this.points, end], ctx.size, this.color);
  }

  private constrained(p: PointerInfo): Point {
    const last = this.points[this.points.length - 1];
    return p.shiftKey && last ? constrainTo45(last, p.point) : p.point;
  }

  private reset(): void {
    this.points = [];
    this.lastUpPoint = null;
    this.lastUpAt = 0;
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
