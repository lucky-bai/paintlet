import type { Point, ToolId } from "../engine/types";
import {
  type HandleId,
  handleEdges,
  selectionHandles,
} from "../engine/selectionHandles";
import type { PointerInfo, Tool, ToolContext } from "./Tool";
import { constrainSquare, normalizeRect } from "./shapes";

type Box = { x: number; y: number; w: number; h: number };

// Rectangular marquee selection. Three gestures share one tool:
//   • drag on empty canvas → draw a new marquee (Shift = square).
//   • drag on a resize grip → lift the pixels and scale them (Shift = keep
//     aspect ratio), leaving a background-colored hole.
//   • drag starting inside the current marquee → lift the pixels into a float
//     and move them, leaving a background-colored hole.
// Copy/cut/paste/delete/crop act on whatever this tool has selected; those live
// on the engine and are driven from the menu and keyboard, not from here.
export class SelectTool implements Tool {
  id: ToolId = "select";
  cursor = "crosshair";

  private mode: "idle" | "new" | "move" | "resize" = "idle";
  private start: Point = { x: 0, y: 0 };
  private originX = 0; // float top-left at drag start (move mode)
  private originY = 0;
  private resizeHandle: HandleId = "se";
  private startRect: Box = { x: 0, y: 0, w: 0, h: 0 };

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    this.start = p.point;
    const grip = this.hitHandle(p.point, ctx);
    if (grip && ctx.engine.hasSelectionOrFloat()) {
      // Grab a resize grip: lift the pixels (if not already floating) and scale.
      this.mode = "resize";
      this.resizeHandle = grip;
      ctx.engine.beginFloat(ctx.color2);
      const r = ctx.engine.selection!;
      this.startRect = { x: r.x, y: r.y, w: r.w, h: r.h };
    } else if (ctx.engine.isInsideSelection(p.point)) {
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
    } else if (this.mode === "resize") {
      const box = this.resizedBox(p);
      ctx.engine.scaleFloatTo(box.x, box.y, box.w, box.h);
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

  // The grip under a point, or null. Tolerance is in screen px (÷ zoom → image).
  private hitHandle(p: Point, ctx: ToolContext): HandleId | null {
    const r = ctx.engine.selection;
    if (!r) return null;
    const tol = 6 / ctx.zoom;
    for (const h of selectionHandles(r)) {
      if (Math.abs(p.x - h.x) <= tol && Math.abs(p.y - h.y) <= tol) return h.id;
    }
    return null;
  }

  // New selection box from the current pointer, pinning the edges the grabbed
  // grip doesn't move to the opposite anchor. Shift keeps the start aspect ratio
  // (corner grips only). Dimensions clamp to at least 1px, no flipping.
  private resizedBox(p: PointerInfo): Box {
    const sr = this.startRect;
    const e = handleEdges(this.resizeHandle);
    const ax = e.left ? sr.x + sr.w : sr.x; // fixed x anchor
    const ay = e.top ? sr.y + sr.h : sr.y; // fixed y anchor
    let w = e.left || e.right ? Math.abs(p.point.x - ax) : sr.w;
    let h = e.top || e.bottom ? Math.abs(p.point.y - ay) : sr.h;

    if (p.shiftKey && (e.left || e.right) && (e.top || e.bottom) && sr.h > 0) {
      const ar = sr.w / sr.h;
      if (w / sr.w > h / sr.h) h = w / ar;
      else w = h * ar;
    }
    w = Math.max(1, w);
    h = Math.max(1, h);

    const x = e.left ? ax - w : sr.x;
    const y = e.top ? ay - h : sr.y;
    return { x, y, w, h };
  }
}
