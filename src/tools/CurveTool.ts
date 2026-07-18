import type { Point } from "../engine/types";
import { constrainTo45, oddStrokeOffset, roundPoint } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Curve — Paint's curve as a four-click gesture. Click the start, then click the
// end: that lays down a straight line (Shift = 45° constrain). Then click twice
// more, each click pulling one of a cubic Bézier's two control points — the first
// bends the half nearest the start, the second the half nearest the end. Between
// clicks the pending point previews under the cursor, so you always see the line
// or curve you're about to commit. Esc cancels at any phase.
//
// Two design notes, both fixes for real bugs:
//   • Click-based, not drag-based. Every point is placed on pointer-UP, and phases
//     never advance on pointer-DOWN. An earlier drag-based version treated a quick
//     click as a zero-length line and jumped straight to the bend phase, so the
//     next hover drew a Bézier from a point back to itself — a closed loop. Placing
//     on release means one click = one point, and the line phase only ever draws a
//     straight line.
//   • The dragged point IS the control point — the curve leans toward it. An even
//     earlier version solved for control points that forced the curve *through* two
//     points at t=1/3 and t=2/3; that solve amplifies the input ~3× and lets the
//     control points cross, folding ordinary input into an oval loop. Direct
//     control points can't do that: the curve stays a clean arc.
export class CurveTool implements Tool {
  id = "curve" as const;
  cursor = "crosshair";

  // What the NEXT click will place:
  //   idle  → the start point (a)
  //   line  → the end point (b), finishing the straight line
  //   bend1 → the first control point (cp1)
  //   bend2 → the second control point (cp2), then commit
  private phase: "idle" | "line" | "bend1" | "bend2" = "idle";
  private a: Point = { x: 0, y: 0 }; // start
  private b: Point = { x: 0, y: 0 }; // end
  private cp1: Point = { x: 0, y: 0 }; // first control point (near the start)
  private cp2: Point = { x: 0, y: 0 }; // second control point (near the end)
  private color = "#000000";

  // Capture the paint colour on press (which button decides fg vs bg); points are
  // placed on release, so the down itself never advances a phase.
  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "idle") {
      this.color = p.button === "secondary" ? ctx.color2 : ctx.color1;
    }
  }

  // A click = down then up, so every point lands here — one click, one point.
  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "idle") {
      this.a = p.point;
      this.b = p.point;
      this.parkControls();
      this.phase = "line";
      ctx.clearPreview();
    } else if (this.phase === "line") {
      const end = p.shiftKey ? constrainTo45(this.a, p.point) : p.point;
      // Ignore a second click on the start point — a zero-length line has no
      // curve to shape; keep waiting for a real end point.
      if (dist(end, this.a) < 1) return;
      this.b = end;
      this.parkControls();
      this.phase = "bend1";
      this.renderLine(ctx);
    } else if (this.phase === "bend1") {
      this.cp1 = p.point;
      this.phase = "bend2";
      this.renderCurve(ctx);
    } else if (this.phase === "bend2") {
      this.cp2 = p.point;
      this.renderCurve(ctx);
      this.reset();
      ctx.commit("curve", true);
    }
  }

  // Between clicks the button is up: preview the point the next click will place.
  onPointerHover(p: PointerInfo, ctx: ToolContext): void {
    this.preview(p, ctx);
  }

  // Same preview during a press-drag, so dragging works too (it just previews the
  // same point the release will place).
  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    this.preview(p, ctx);
  }

  private preview(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "line") {
      this.b = p.shiftKey ? constrainTo45(this.a, p.point) : p.point;
      this.renderLine(ctx);
    } else if (this.phase === "bend1") {
      this.cp1 = p.point;
      this.renderCurve(ctx);
    } else if (this.phase === "bend2") {
      this.cp2 = p.point;
      this.renderCurve(ctx);
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

  // Park the control points on the straight line at its thirds, so before a bend
  // the cubic renders as the plain line and each drag starts from neutral.
  private parkControls(): void {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    this.cp1 = { x: this.a.x + dx / 3, y: this.a.y + dy / 3 };
    this.cp2 = { x: this.a.x + (2 * dx) / 3, y: this.a.y + (2 * dy) / 3 };
  }

  private renderLine(ctx: ToolContext): void {
    this.stroke(ctx, (o, _a, b) => o.lineTo(b.x, b.y));
  }

  private renderCurve(ctx: ToolContext): void {
    this.stroke(ctx, (o, _a, b) =>
      o.bezierCurveTo(this.cp1.x, this.cp1.y, this.cp2.x, this.cp2.y, b.x, b.y),
    );
  }

  // Shared overlay draw: half-pixel offset for odd widths, rounded endpoints,
  // then whatever segment `path` appends.
  private stroke(
    ctx: ToolContext,
    path: (o: CanvasRenderingContext2D, a: Point, b: Point) => void,
  ): void {
    ctx.clearPreview();
    const a = roundPoint(this.a);
    const b = roundPoint(this.b);
    const off = oddStrokeOffset(ctx.size);
    const o = ctx.overlay;
    o.save();
    o.translate(off, off);
    o.strokeStyle = this.color;
    o.lineWidth = ctx.size;
    o.lineCap = "round";
    o.lineJoin = "round";
    o.beginPath();
    o.moveTo(a.x, a.y);
    path(o, a, b);
    o.stroke();
    o.restore();
  }

  private reset(): void {
    this.phase = "idle";
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
