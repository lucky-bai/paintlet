import type { Point } from "../engine/types";
import { constrainTo45, oddStrokeOffset, roundPoint } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Curve — Paint's three-gesture Bézier. First drag lays down a straight line
// (Shift = 45° constrain); the next drag bends it (quadratic preview); the
// final drag sets the second bend and commits a cubic through both control
// points. Esc cancels at any phase.
export class CurveTool implements Tool {
  id = "curve" as const;
  cursor = "crosshair";

  // Which gesture the next drag performs.
  private phase: "idle" | "line" | "bend1" | "bend2" = "idle";
  private start: Point = { x: 0, y: 0 };
  private end: Point = { x: 0, y: 0 };
  private cp1: Point | null = null;
  private color = "#000000";

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "idle") {
      this.phase = "line";
      this.start = p.point;
      this.end = p.point;
      this.color = p.button === "secondary" ? ctx.color2 : ctx.color1;
    }
    this.drag(p, ctx);
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    this.drag(p, ctx);
  }

  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    switch (this.phase) {
      case "line":
        this.end = p.shiftKey ? constrainTo45(this.start, p.point) : p.point;
        this.render(ctx, this.cp1, null);
        this.phase = "bend1";
        break;
      case "bend1":
        this.cp1 = p.point;
        this.render(ctx, this.cp1, null);
        this.phase = "bend2";
        break;
      case "bend2":
        this.render(ctx, this.cp1, p.point);
        this.reset();
        ctx.commit("curve", true);
        break;
    }
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): void {
    if (e.key === "Escape" && this.phase !== "idle") {
      this.reset();
      ctx.clearPreview();
    }
  }

  onDeactivate(ctx: ToolContext): void {
    if (this.phase !== "idle") {
      this.reset();
      ctx.clearPreview();
    }
  }

  // Live preview while a button is held, per phase.
  private drag(p: PointerInfo, ctx: ToolContext): void {
    switch (this.phase) {
      case "line":
        this.end = p.shiftKey ? constrainTo45(this.start, p.point) : p.point;
        this.render(ctx, null, null);
        break;
      case "bend1":
        this.render(ctx, p.point, null);
        break;
      case "bend2":
        this.render(ctx, this.cp1, p.point);
        break;
    }
  }

  // Draw the curve at its current bend state: straight line → quadratic with
  // one control point → cubic with two.
  private render(ctx: ToolContext, cp1: Point | null, cp2: Point | null): void {
    ctx.clearPreview();
    const a = roundPoint(this.start);
    const b = roundPoint(this.end);
    const off = oddStrokeOffset(ctx.size);
    const o = ctx.overlay;
    o.save();
    o.translate(off, off);
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.lineCap = "round";
    o.beginPath();
    o.moveTo(a.x, a.y);
    if (cp1 && cp2) {
      o.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y);
    } else if (cp1) {
      o.quadraticCurveTo(cp1.x, cp1.y, b.x, b.y);
    } else {
      o.lineTo(b.x, b.y);
    }
    o.stroke();
    o.restore();
  }

  private reset(): void {
    this.phase = "idle";
    this.cp1 = null;
  }
}
