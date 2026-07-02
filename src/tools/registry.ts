import type { ToolId } from "../engine/types";
import type { Tool } from "./Tool";
import { PencilTool } from "./PencilTool";
import { BrushTool } from "./BrushTool";
import { EraserTool } from "./EraserTool";
import { LineTool } from "./LineTool";
import { RectangleTool } from "./RectangleTool";
import { EllipseTool } from "./EllipseTool";
import { FillTool } from "./FillTool";
import { EyedropperTool } from "./EyedropperTool";

// id → tool instance. Tools are stateful (they track an in-progress stroke), so
// we hold one shared instance each. Adding a pointer tool is a one-line add here
// plus its file.
const registry: Partial<Record<ToolId, Tool>> = {
  pencil: new PencilTool(),
  brush: new BrushTool(),
  eraser: new EraserTool(),
  line: new LineTool(),
  rectangle: new RectangleTool(),
  ellipse: new EllipseTool(),
  fill: new FillTool(),
  eyedropper: new EyedropperTool(),
};

// The text tool needs a floating DOM input, so it isn't a pointer-driven Tool;
// CanvasStage handles it directly. It's still user-selectable, hence listed as
// enabled even though getTool("text") is undefined.
const ENABLED: ReadonlySet<ToolId> = new Set<ToolId>([
  ...(Object.keys(registry) as ToolId[]),
  "text",
]);

export function getTool(id: ToolId): Tool | undefined {
  return registry[id];
}

// Tools the toolbar should render as enabled (implemented).
export function isImplemented(id: ToolId): boolean {
  return ENABLED.has(id);
}
