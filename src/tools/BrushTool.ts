import { brushCursor } from "../lib/cursors";
import { FreehandTool } from "./FreehandTool";
import type { PointerInfo, ToolContext } from "./Tool";

// Brush — round variable-width freehand. Same mechanics as the pencil; the size
// slider gives it heft. Primary → Color 1, secondary → Color 2.
export class BrushTool extends FreehandTool {
  id = "brush" as const;
  cursor = brushCursor;
  protected lineCap: CanvasLineCap = "round";

  protected colorFor(p: PointerInfo, ctx: ToolContext): string {
    return p.button === "secondary" ? ctx.color2 : ctx.color1;
  }
}
