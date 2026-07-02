import type { Point } from "../engine/types";
import { constrainSquare, normalizeRect } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Ellipse — outline inscribed in the drag bounding box, previewed on the
// overlay. Hold Shift for a circle.
export class EllipseTool implements Tool {
  id = "ellipse" as const;
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
    ctx.commit("ellipse");
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
    const { x, y, w, h } = normalizeRect(this.start, end);
    ctx.clearPreview();
    const o = ctx.overlay;
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.beginPath();
    o.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    o.stroke();
  }
}
