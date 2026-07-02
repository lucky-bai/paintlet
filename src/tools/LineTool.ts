import type { Point } from "../engine/types";
import { constrainTo45 } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Straight line — preview on the overlay each move, commit on release. Hold
// Shift to constrain to 45° increments.
export class LineTool implements Tool {
  id = "line" as const;
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
    this.draw(p, ctx); // draw at the final position in case moves lagged
    this.start = null;
    ctx.commit("line");
  }

  onDeactivate(ctx: ToolContext): void {
    if (this.start) {
      this.start = null;
      ctx.clearPreview();
    }
  }

  private draw(p: PointerInfo, ctx: ToolContext): void {
    if (!this.start) return;
    const end = p.shiftKey ? constrainTo45(this.start, p.point) : p.point;
    ctx.clearPreview();
    const o = ctx.overlay;
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.lineCap = "round";
    o.beginPath();
    o.moveTo(this.start.x, this.start.y);
    o.lineTo(end.x, end.y);
    o.stroke();
  }
}
