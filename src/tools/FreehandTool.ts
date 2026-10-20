import type { Point, ToolId } from "../engine/types";
import { oddStrokeOffset, roundPoint } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Shared base for the freehand strokes (pencil, brush, eraser). The whole stroke
// accumulates on the OVERLAY and commits once on pointer-up, so one drag == one
// undo step and the base is untouched mid-stroke. Because pointer events are
// sparse, we always draw a LINE from the last point to the current one — never
// isolated dots — or fast strokes would gap.
//
// Subclasses pick the stroke color (which button maps to which color) and the
// line cap; everything else is shared.
export abstract class FreehandTool implements Tool {
  abstract id: ToolId;
  abstract cursor: string;
  protected lineCap: CanvasLineCap = "round";
  // Harden anti-aliased edges on commit (pencil = true; brush/eraser = false).
  protected crisp = false;

  // Which color this stroke paints, given the button that started it.
  protected abstract colorFor(p: PointerInfo, ctx: ToolContext): string;

  private drawing = false;
  private last: Point | null = null;
  private color = "#000000";

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    this.drawing = true;
    this.last = p.point;
    this.color = this.colorFor(p, ctx);
    if (this.id === "pencil" && Math.round(ctx.size) <= 1) {
      const o = ctx.overlay;
      o.fillStyle = this.color;
      o.fillRect(Math.floor(p.point.x), Math.floor(p.point.y), 1, 1);
    } else {
      // A plain click leaves a dot: a zero-length round-capped segment.
      this.segment(p.point, p.point, ctx);
    }
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    if (!this.drawing || !this.last) return;
    this.segment(this.last, p.point, ctx);
    this.last = p.point;
  }

  onPointerUp(_p: PointerInfo, ctx: ToolContext): void {
    if (!this.drawing) return;
    this.drawing = false;
    this.last = null;
    ctx.commit(this.id, this.crisp);
  }

  // Discard an in-progress stroke without committing (tool switch / Esc).
  onDeactivate(ctx: ToolContext): void {
    if (this.drawing) {
      this.drawing = false;
      this.last = null;
      ctx.clearPreview();
    }
  }

  private segment(from: Point, to: Point, ctx: ToolContext): void {
    const o = ctx.overlay;
    o.save();
    if (this.id === "pencil" && Math.round(ctx.size) <= 1) {
      o.fillStyle = this.color;
      let x0 = Math.floor(from.x);
      let y0 = Math.floor(from.y);
      const x1 = Math.floor(to.x);
      const y1 = Math.floor(to.y);
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        o.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
      o.restore();
      return;
    }

    // Hard-edged strokes snap to the pixel grid (with the odd-width half-pixel
    // shift) so their committed width is exact; smooth strokes stay free.
    let a = from;
    let b = to;
    if (this.crisp) {
      const off = oddStrokeOffset(ctx.size);
      o.translate(off, off);
      a = roundPoint(from);
      b = roundPoint(to);
    }
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.lineCap = this.lineCap;
    o.lineJoin = "round";
    o.beginPath();
    o.moveTo(a.x, a.y);
    o.lineTo(b.x, b.y);
    o.stroke();
    o.restore();
  }
}
