import type { Point, ToolId } from "../engine/types";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Free-form (lasso) selection. Mirrors the rectangular SelectTool's gestures:
//   • drag on empty canvas → trace a freehand outline; releasing closes it back
//     to the start and selects the enclosed region.
//   • drag starting inside the current selection → lift the enclosed pixels
//     into a float and move them, leaving a background-colored hole shaped
//     like the outline.
// Copy/cut/paste/delete act on the engine's selection as usual — the engine
// clips them to the outline when one exists.
export class LassoTool implements Tool {
  id: ToolId = "freeSelect";
  cursor = "crosshair";

  private mode: "idle" | "new" | "move" = "idle";
  private start: Point = { x: 0, y: 0 };
  private points: Point[] = []; // the outline being traced (new mode)
  private originX = 0; // float top-left at drag start (move mode)
  private originY = 0;

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    this.start = p.point;
    if (ctx.engine.isInsideSelection(p.point)) {
      this.mode = "move";
      ctx.engine.beginFloat(ctx.color2);
      const r = ctx.engine.selection!;
      this.originX = r.x;
      this.originY = r.y;
    } else {
      this.mode = "new";
      ctx.engine.deselect();
      this.points = [p.point];
      ctx.engine.setLassoPreview(this.points);
    }
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    if (this.mode === "new") {
      // Skip sub-pixel jitter so the stored outline stays compact.
      const last = this.points[this.points.length - 1];
      if (Math.hypot(p.point.x - last.x, p.point.y - last.y) >= 1) {
        this.points.push(p.point);
        ctx.engine.setLassoPreview(this.points);
      }
    } else if (this.mode === "move") {
      ctx.engine.moveFloatTo(
        this.originX + (p.point.x - this.start.x),
        this.originY + (p.point.y - this.start.y),
      );
    }
  }

  onPointerUp(_p: PointerInfo, ctx: ToolContext): void {
    if (this.mode === "new") {
      ctx.engine.finalizeLasso(this.points);
      this.points = [];
    }
    this.mode = "idle";
  }

  // Leaving the tool (or the app switching tools) bakes the selection down.
  onDeactivate(ctx: ToolContext): void {
    this.mode = "idle";
    this.points = [];
    ctx.engine.deselect();
  }
}
