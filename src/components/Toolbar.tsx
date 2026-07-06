import { engine, usePaintStore } from "../state/store";
import { isImplemented, isShapeTool } from "../tools/registry";
import type { ToolId } from "../engine/types";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";
import { ToolButton } from "./ToolButton";
import { ColorControls } from "./ColorControls";
import { TextOptions } from "./TextOptions";

type ToolDef = { id: ToolId; icon: IconName; label: string; key: string };

const SELECT_TOOLS: ToolDef[] = [
  { id: "select", icon: "select", label: "Select", key: "S" },
];

const DRAW_TOOLS: ToolDef[] = [
  { id: "pencil", icon: "pencil", label: "Pencil", key: "P" },
  { id: "brush", icon: "brush", label: "Brush", key: "B" },
  { id: "fill", icon: "fill", label: "Fill with color", key: "F" },
  { id: "text", icon: "text", label: "Text", key: "T" },
  { id: "eraser", icon: "eraser", label: "Eraser", key: "E" },
  { id: "eyedropper", icon: "eyedropper", label: "Color picker", key: "I" },
];

const SHAPE_TOOLS: ToolDef[] = [
  { id: "line", icon: "line", label: "Line", key: "L" },
  { id: "rectangle", icon: "rectangle", label: "Rectangle", key: "R" },
  {
    id: "roundedRectangle",
    icon: "roundedRectangle",
    label: "Rounded rectangle",
    key: "U",
  },
  { id: "ellipse", icon: "ellipse", label: "Ellipse", key: "O" },
];

// Shapes draw at one of a few fixed widths (not the continuous pencil slider).
const SHAPE_SIZES = [1, 3, 5, 8];

function Divider() {
  return <div className="mx-1 h-7 w-px bg-hairline" />;
}

function ToolGroup({ tools }: { tools: ToolDef[] }) {
  const activeToolId = usePaintStore((s) => s.activeToolId);
  const setTool = usePaintStore((s) => s.setTool);
  return (
    <div className="flex items-center gap-0.5">
      {tools.map((t) => {
        const enabled = isImplemented(t.id);
        return (
          <ToolButton
            key={t.id}
            title={enabled ? `${t.label} (${t.key})` : `${t.label} — coming soon`}
            active={activeToolId === t.id}
            disabled={!enabled}
            onClick={() => setTool(t.id)}
          >
            <Icon name={t.icon} />
          </ToolButton>
        );
      })}
    </div>
  );
}

function SizeSlider() {
  const brushSize = usePaintStore((s) => s.brushSize);
  const setBrushSize = usePaintStore((s) => s.setBrushSize);
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-xs text-ink-muted">Size</span>
      <input
        type="range"
        min={1}
        max={64}
        step={1}
        value={brushSize}
        onChange={(e) => setBrushSize(Number(e.target.value))}
        className="w-24 accent-[var(--vp-accent)]"
        title={`${brushSize}px`}
      />
      <span className="w-8 text-right text-xs tabular-nums text-ink-muted">
        {brushSize}px
      </span>
    </div>
  );
}

// Discrete stroke-width picker shown while a shape tool is active.
function ShapeSizePicker() {
  const shapeSize = usePaintStore((s) => s.shapeSize);
  const setShapeSize = usePaintStore((s) => s.setShapeSize);
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-xs text-ink-muted">Size</span>
      <div className="flex items-center gap-0.5">
        {SHAPE_SIZES.map((n) => (
          <button
            key={n}
            type="button"
            title={`${n}px`}
            onClick={() => setShapeSize(n)}
            className={cx(
              "h-7 w-8 rounded-md text-xs tabular-nums",
              shapeSize === n
                ? "bg-[var(--vp-accent)] text-white"
                : "text-ink-muted hover:bg-hover",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toolbar() {
  const canUndo = usePaintStore((s) => s.canUndo);
  const canRedo = usePaintStore((s) => s.canRedo);
  const activeToolId = usePaintStore((s) => s.activeToolId);

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-hairline bg-surface px-3 py-2">
      {/* Undo / redo — far left, with disabled states (a modern-Paint cue). */}
      <div className="flex items-center gap-0.5">
        <ToolButton title="Undo (⌘Z)" disabled={!canUndo} onClick={() => engine.undo()}>
          <Icon name="undo" />
        </ToolButton>
        <ToolButton title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={() => engine.redo()}>
          <Icon name="redo" />
        </ToolButton>
      </div>

      <Divider />
      <ToolGroup tools={SELECT_TOOLS} />
      <Divider />
      <ToolGroup tools={DRAW_TOOLS} />
      <Divider />
      <ToolGroup tools={SHAPE_TOOLS} />
      <Divider />

      {/* Contextual options: text styling for the Text tool, the discrete size
          picker for shapes, else the continuous pencil/brush slider. */}
      {activeToolId === "text" ? (
        <TextOptions />
      ) : isShapeTool(activeToolId) ? (
        <ShapeSizePicker />
      ) : (
        <SizeSlider />
      )}

      <Divider />

      {/* Colors, pushed to the right. */}
      <div className="ml-auto">
        <ColorControls />
      </div>
    </div>
  );
}
