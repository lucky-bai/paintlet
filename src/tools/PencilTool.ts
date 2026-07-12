import { FreehandTool } from "./FreehandTool";
import type { PointerInfo, ToolContext } from "./Tool";

// Pencil — thin hard-edged freehand. Primary button paints Color 1, secondary
// paints Color 2 (classic Paint).
export class PencilTool extends FreehandTool {
  id = "pencil" as const;
  cursor = "crosshair";
  // Hard-edged so a flood fill reaches it (see PLAN's rendering rule).
  protected crisp = true;

  protected colorFor(p: PointerInfo, ctx: ToolContext): string {
    return p.button === "secondary" ? ctx.color2 : ctx.color1;
  }
}
