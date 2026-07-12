import { eraserCursor } from "../lib/cursors";
import { FreehandTool } from "./FreehandTool";
import type { PointerInfo, ToolContext } from "./Tool";

// Eraser — paints Color 2 (the background color), the classic Paint behavior.
// Square cap so it erases in blocky strokes rather than rounded dabs, and
// hard-edged (crisp) like the pencil: an erased area must flood-fill cleanly
// against what's left, with no anti-aliased fringe.
export class EraserTool extends FreehandTool {
  id = "eraser" as const;
  cursor = eraserCursor;
  protected lineCap: CanvasLineCap = "square";
  protected crisp = true;

  protected colorFor(_p: PointerInfo, ctx: ToolContext): string {
    return ctx.color2;
  }
}
