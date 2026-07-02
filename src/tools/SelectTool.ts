import type { Point, ToolId } from "../engine/types";
import type { PointerInfo, Tool, ToolContext } from "./Tool";
import { constrainSquare, normalizeRect } from "./shapes";

// Rectangular marquee selection. Two gestures share one tool:
//   • drag on empty canvas → draw a new marquee (Shift = square).
//   • drag starting inside the current marquee → lift the pixels into a float
//     and move them, leaving a background-colored hole.
// Copy/cut/paste/delete/crop act on whatever this tool has selected; those live
// on the engine and are driven from the menu and keyboard, not from here.
export class SelectTool implements Tool {
  id: ToolId = "select";
  cursor = "crosshair";

  private mode: "idle" | "new" | "move" = "idle";
  private start: Point = { x: 0, y: 0 };
  private originX = 0; // float top-left at drag start (move mode)
  private originY = 0;

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    this.start = p.point;
    if (ctx.engine.isInsideSelection(p.point)) {
      // Grab the existing selection and start moving it.
      this.mode = "move";
      ctx.engine.beginFloat(ctx.color2);
      const r = ctx.engine.selection!;
      this.originX = r.x;
      this.originY = r.y;
    } else {
      // Commit anything floating, then begin a fresh marquee.
      this.mode = "new";
      ctx.engine.deselect();
      ctx.engine.setMarquee({ x: p.point.x, y: p.point.y, w: 0, h: 0 });
    }
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    if (this.mode === "new") {
      const end = p.shiftKey ? constrainSquare(this.start, p.point) : p.point;
      ctx.engine.setMarquee(normalizeRect(this.start, end));
    } else if (this.mode === "move") {
      ctx.engine.moveFloatTo(
        this.originX + (p.point.x - this.start.x),
        this.originY + (p.point.y - this.start.y),
      );
    }
  }

  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    if (this.mode === "new") {
      const end = p.shiftKey ? constrainSquare(this.start, p.point) : p.point;
      ctx.engine.finalizeMarquee(normalizeRect(this.start, end));
    }
    this.mode = "idle";
  }

  // Leaving the tool (or the app switching tools) bakes the selection down.
  onDeactivate(ctx: ToolContext): void {
    this.mode = "idle";
    ctx.engine.deselect();
  }
}
