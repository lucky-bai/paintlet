import type { Point } from "../engine/types";
import { constrainTo45, oddStrokeOffset, roundPoint } from "./shapes";
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

  // Close the outline back to the first vertex and commit hard-edged.
  private finish(ctx: ToolContext): void {
    ctx.clearPreview();
    const o = ctx.overlay;
    this.applyStroke(o, ctx.size);
    this.tracePath(o);
    o.closePath();
    o.stroke();
    o.restore();
    this.reset();
    ctx.commit("polygon", true);
  }

  // Redraw the committed polyline plus the rubber-band segment to the cursor.
  private preview(p: PointerInfo, ctx: ToolContext): void {
    if (!this.points.length) return;
    const end = roundPoint(this.constrained(p));
    ctx.clearPreview();
    const o = ctx.overlay;
    this.applyStroke(o, ctx.size);
    this.tracePath(o);
    o.lineTo(end.x, end.y);
    o.stroke();
    o.restore();
  }

  private tracePath(o: CanvasRenderingContext2D): void {
    const pts = this.points.map(roundPoint);
    o.beginPath();
    o.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) o.lineTo(pts[i].x, pts[i].y);
  }

  // Pairs with o.restore() at each call site (pixel-grid translate for odd widths).
  private applyStroke(o: CanvasRenderingContext2D, size: number): void {
    o.save();
    const off = oddStrokeOffset(size);
    o.translate(off, off);
    o.strokeStyle = this.color;
    o.lineWidth = size;
    o.lineCap = "round";
    o.lineJoin = "round";
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
