import { hexToRgba } from "../engine/color";
import { floodFill } from "../engine/floodFill";
import { bucketCursor } from "../lib/cursors";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Flood fill (bucket). Fills the contiguous region under the click on the BASE
// layer directly (no overlay preview), then records a history step. Primary →
// Color 1, secondary → Color 2.
export class FillTool implements Tool {
  id = "fill" as const;
  cursor = bucketCursor;

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    const color = p.button === "secondary" ? ctx.color2 : ctx.color1;
    floodFill(
      ctx.base,
      ctx.engine.width,
      ctx.engine.height,
      p.point.x,
      p.point.y,
      hexToRgba(color),
    );
    ctx.engine.snapshot("fill");
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
