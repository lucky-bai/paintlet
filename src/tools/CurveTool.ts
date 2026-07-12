import type { Point } from "../engine/types";
import { constrainTo45, oddStrokeOffset, roundPoint } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Curve — Paint's three-gesture curve. First drag lays down a straight line
// (Shift = 45° constrain); the next drag pulls the first bend; the final drag
// pulls the second bend and commits. Between gestures the pending bend previews
// under the cursor. Unlike raw Bézier handles, the bends are "pull-through": the
// curve passes THROUGH the point you drag, so it tracks the cursor like Paint.
// Esc cancels at any phase.
export class CurveTool implements Tool {
  id = "curve" as const;
  cursor = "crosshair";

  // idle → line(drag) → await1(hover) → bend1(drag) → await2(hover) →
  // bend2(drag) → commit.
  private phase:
    | "idle"
    | "line"
    | "await1"
    | "bend1"
    | "await2"
    | "bend2" = "idle";
  private a: Point = { x: 0, y: 0 }; // start
  private b: Point = { x: 0, y: 0 }; // end
  private p1: Point = { x: 0, y: 0 }; // first bend point
  private color = "#000000";

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "idle") {
      this.phase = "line";
      this.a = p.point;
      this.b = p.point;
      this.color = p.button === "secondary" ? ctx.color2 : ctx.color1;
      this.renderLine(ctx);
    } else if (this.phase === "await1") {
      this.phase = "bend1";
      this.renderQuad(ctx, p.point);
    } else if (this.phase === "await2") {
      this.phase = "bend2";
      this.renderCubic(ctx, this.p1, p.point);
    }
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "line") {
      this.b = p.shiftKey ? constrainTo45(this.a, p.point) : p.point;
      this.renderLine(ctx);
    } else if (this.phase === "bend1") {
      this.renderQuad(ctx, p.point);
    } else if (this.phase === "bend2") {
      this.renderCubic(ctx, this.p1, p.point);
    }
  }

  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "line") {
      this.b = p.shiftKey ? constrainTo45(this.a, p.point) : p.point;
      this.renderLine(ctx);
      this.phase = "await1";
    } else if (this.phase === "bend1") {
      this.p1 = p.point;
      this.renderQuad(ctx, this.p1);
      this.phase = "await2";
    } else if (this.phase === "bend2") {
      this.renderCubic(ctx, this.p1, p.point);
      this.reset();
      ctx.commit("curve", true);
    }
  }

  // Preview the pending bend under the cursor between gestures.
  onPointerHover(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "await1") this.renderQuad(ctx, p.point);
    else if (this.phase === "await2") this.renderCubic(ctx, this.p1, p.point);
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

  private renderLine(ctx: ToolContext): void {
    this.stroke(ctx, (o, _a, b) => o.lineTo(b.x, b.y));
  }

  // Quadratic passing through `mid` at its midpoint: control = 2·mid − (a+b)/2.
  private renderQuad(ctx: ToolContext, mid: Point): void {
    const cp = {
      x: 2 * mid.x - (this.a.x + this.b.x) / 2,
      y: 2 * mid.y - (this.a.y + this.b.y) / 2,
    };
    this.stroke(ctx, (o, _a, b) => o.quadraticCurveTo(cp.x, cp.y, b.x, b.y));
  }

  // Cubic passing through p1 at t=1/3 and p2 at t=2/3 (solve for the two
  // control points so the curve tracks both drag points, not just leans toward
  // them).
  private renderCubic(ctx: ToolContext, p1: Point, p2: Point): void {
    const A = this.a;
    const B = this.b;
    const u = {
      x: p1.x - (8 / 27) * A.x - (1 / 27) * B.x,
      y: p1.y - (8 / 27) * A.y - (1 / 27) * B.y,
    };
    const v = {
      x: p2.x - (1 / 27) * A.x - (8 / 27) * B.x,
      y: p2.y - (1 / 27) * A.y - (8 / 27) * B.y,
    };
    const a = 4 / 9;
    const b = 2 / 9;
    const det = a * a - b * b;
    const cp1 = { x: (a * u.x - b * v.x) / det, y: (a * u.y - b * v.y) / det };
    const cp2 = { x: (a * v.x - b * u.x) / det, y: (a * v.y - b * u.y) / det };
    this.stroke(ctx, (o, _a, bb) =>
      o.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, bb.x, bb.y),
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
