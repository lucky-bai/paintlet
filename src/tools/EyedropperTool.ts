import { rgbToHex } from "../engine/color";
import { dropperCursor } from "../lib/cursors";
import type { PointerInfo, Tool, ToolContext } from "./Tool";

// Color picker — reads the base pixel under the click and sets it as the active
// color. Primary sets Color 1, secondary sets Color 2. After the pick the app
// returns to the previously active tool (classic Paint), handled in CanvasStage.
export class EyedropperTool implements Tool {
  id = "eyedropper" as const;
  cursor = dropperCursor;

  onPointerDown(p: PointerInfo, ctx: ToolContext): void {
    const [r, g, b] = ctx.engine.getPixel(p.point);
    const hex = rgbToHex(r, g, b);
    if (p.button === "secondary") ctx.setColor2(hex);
    else ctx.setColor1(hex);
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}
