import type { Point } from "../engine/types";
import {
  constrainSquare,
  normalizeRect,
  oddStrokeOffset,
  roundPoint,
} from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Rounded rectangle — outline with rounded corners, previewed on the overlay.
// Hold Shift for a square. Hard-edged like the other shapes (commits crisp), so
// a flood fill of the interior reaches the border with no anti-aliased halo.
export class RoundedRectangleTool implements Tool {
  id = "roundedRectangle" as const;
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
    ctx.commit("rounded rectangle", true);
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
    // Corner radius scales with the smaller side, capped so large rectangles
    // don't turn into a stadium shape.
    const r = Math.min(Math.min(w, h) / 2, 24);
    const off = oddStrokeOffset(ctx.size);
    ctx.clearPreview();
    const o = ctx.overlay;
    o.save();
    o.translate(off, off);
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.lineJoin = "round";
    // arcTo rounds each corner; widely supported in the webview.
    o.beginPath();
    o.moveTo(x + r, y);
    o.arcTo(x + w, y, x + w, y + h, r);
    o.arcTo(x + w, y + h, x, y + h, r);
    o.arcTo(x, y + h, x, y, r);
    o.arcTo(x, y, x + w, y, r);
    o.closePath();
    o.stroke();
    o.restore();
  }
}
