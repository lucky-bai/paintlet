import type { Point } from "../engine/types";
import {
  constrainSquare,
  normalizeRect,
  oddStrokeOffset,
  roundPoint,
} from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Rectangle — outline in the stroke color, previewed on the overlay. Hold Shift
// for a square. (Fill modes come later; MVP is outline-only.)
export class RectangleTool implements Tool {
  id = "rectangle" as const;
  cursor = "crosshair";

  private start: Point | null = null;
  private color = "#000000";

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    this.start = p.point;
    this.color = p.button === "secondary" ? ctx.color2 : ctx.color1;
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    this.draw(p, ctx);
  }

  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    this.draw(p, ctx);
    this.start = null;
    ctx.commit("rectangle", true);
  }

  onDeactivate(ctx: ToolContext): void {
    if (this.start) {
      this.start = null;
      ctx.clearPreview();
    }
  }

  private draw(p: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    const end = p.shiftKey ? constrainSquare(this.start, p.point) : p.point;
    const { x, y, w, h } = normalizeRect(roundPoint(this.start), roundPoint(end));
    const off = oddStrokeOffset(ctx.size);
    ctx.clearPreview();
    const o = ctx.overlay;
    o.save();
    o.translate(off, off);
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.lineJoin = "miter";
    o.strokeRect(x, y, w, h);
    o.restore();
  }
}
