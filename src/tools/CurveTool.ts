import type { Point } from "../engine/types";
import { constrainTo45, oddStrokeOffset, roundPoint } from "./shapes";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Curve — Paint's three-gesture curve. The first drag lays down a straight line
// (Shift = 45° constrain). The next two drags each pull one of a cubic Bézier's
// two control points: the first bends the half nearest the start, the second the
// half nearest the end. Between gestures the pending control point previews
// under the cursor.
//
// The dragged point IS the control point — the curve leans toward it. An earlier
// version instead solved for control points that forced the curve to pass
// *through* the two drag points at t=1/3 and t=2/3; that solve amplifies the
// drag (~3×) and lets the control points cross over, so ordinary drags folded
// the curve into a closed oval loop. Direct control points can't do that: the
// curve stays a clean arc for any reasonable drag. Esc cancels at any phase.
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
  private cp1: Point = { x: 0, y: 0 }; // first control point (near the start)
  private cp2: Point = { x: 0, y: 0 }; // second control point (near the end)
  private color = "#000000";

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "idle") {
      this.phase = "line";
      this.a = p.point;
      this.b = p.point;
      this.color = p.button === "secondary" ? ctx.color2 : ctx.color1;
      this.parkControls();
      this.renderLine(ctx);
    } else if (this.phase === "await1") {
      this.phase = "bend1";
      this.cp1 = p.point;
      this.renderCurve(ctx);
    } else if (this.phase === "await2") {
      this.phase = "bend2";
      this.cp2 = p.point;
      this.renderCurve(ctx);
    }
  }

  onPointerMove(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "line") {
      this.b = p.shiftKey ? constrainTo45(this.a, p.point) : p.point;
      this.parkControls();
      this.renderLine(ctx);
    } else if (this.phase === "bend1") {
      this.cp1 = p.point;
      this.renderCurve(ctx);
    } else if (this.phase === "bend2") {
      this.cp2 = p.point;
      this.renderCurve(ctx);
    }
  }

  onPointerUp(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "line") {
      this.b = p.shiftKey ? constrainTo45(this.a, p.point) : p.point;
      this.parkControls();
      this.renderLine(ctx);
      this.phase = "await1";
    } else if (this.phase === "bend1") {
      this.cp1 = p.point;
      this.renderCurve(ctx);
      this.phase = "await2";
    } else if (this.phase === "bend2") {
      this.cp2 = p.point;
      this.renderCurve(ctx);
      this.reset();
      ctx.commit("curve", true);
    }
  }

  // Preview the pending control point under the cursor between gestures.
  onPointerHover(p: PointerInfo, ctx: ToolContext): void {
    if (this.phase === "await1") {
      this.cp1 = p.point;
      this.renderCurve(ctx);
    } else if (this.phase === "await2") {
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
