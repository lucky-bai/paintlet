import { FreehandTool } from "./FreehandTool";
import type { PointerInfo, ToolContext } from "./Tool";

// Eraser — paints Color 2 (the background color), the classic Paint behavior.
// Square cap so it erases in blocky strokes rather than rounded dabs.
export class EraserTool extends FreehandTool {
  id = "eraser" as const;
  cursor = "crosshair";
  protected lineCap: CanvasLineCap = "round";

  protected colorFor(_p: PointerInfo, ctx: ToolContext): string {
    return ctx.color2;
  }
}
