import type { ReactNode } from "react";
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
  { id: "freeSelect", icon: "lasso", label: "Free-form select", key: "W" },
];

// Drawing tools laid out to fill two rows (Win11 Paint's compact Tools group).
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
  { id: "curve", icon: "curve", label: "Curve", key: "C" },
  { id: "rectangle", icon: "rectangle", label: "Rectangle", key: "R" },
  {
    id: "roundedRectangle",
    icon: "roundedRectangle",
    label: "Rounded rectangle",
    key: "U",
  },
  { id: "ellipse", icon: "ellipse", label: "Ellipse", key: "O" },
  { id: "polygon", icon: "polygon", label: "Polygon", key: "G" },
];

// Shapes draw at one of a few fixed widths (not the continuous pencil slider).
const SHAPE_SIZES = [1, 3, 5, 8];

// A labeled ribbon group: content on top, a small caption underneath — the
// Win11 Paint layout the user asked to get closer to.
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-1.5">
      <div className="flex flex-1 items-center">{children}</div>
      <span className="text-[10px] leading-none text-ink-muted">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-1 w-px self-stretch bg-hairline" />;
}

// A compact tool block that fills two rows before starting a new column, so a
// set of tool buttons stays tight instead of sprawling across one long row.
function ToolGrid({ tools }: { tools: ToolDef[] }) {
  const activeToolId = usePaintStore((s) => s.activeToolId);
  const setTool = usePaintStore((s) => s.setTool);
  return (
    <div className="grid grid-flow-col grid-rows-2 gap-0.5">
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

// A continuous stroke-width slider for the freehand tools (pencil / brush /
// eraser). Shapes use the discrete picker below instead.
function SizeSlider() {
  const brushSize = usePaintStore((s) => s.brushSize);
  const setBrushSize = usePaintStore((s) => s.setBrushSize);
  return (
    <div className="flex items-center gap-2 px-1">
      <input
        type="range"
        min={1}
        max={64}
        step={1}
        value={brushSize}
        onChange={(e) => setBrushSize(Number(e.target.value))}
        className="w-28 accent-[var(--vp-accent)]"
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
  );
}

// The contextual group between Shapes and Colors: text styling for the Text
// tool, the fixed-width picker for shapes, the continuous slider for freehand
// strokes, and nothing for tools with no size (select/lasso/fill/eyedropper).
function ContextGroup() {
  const activeToolId = usePaintStore((s) => s.activeToolId);
  if (activeToolId === "text")
    return (
      <>
        <Divider />
        <Group label="Text">
          <TextOptions />
        </Group>
      </>
    );
  if (isShapeTool(activeToolId))
    return (
      <>
        <Divider />
        <Group label="Size">
          <ShapeSizePicker />
        </Group>
      </>
    );
  if (
    activeToolId === "pencil" ||
    activeToolId === "brush" ||
    activeToolId === "eraser"
  )
    return (
      <>
        <Divider />
        <Group label="Size">
          <SizeSlider />
        </Group>
      </>
    );
  return null;
}

export function Toolbar() {
  const canUndo = usePaintStore((s) => s.canUndo);
  const canRedo = usePaintStore((s) => s.canRedo);

  return (
    <div className="flex shrink-0 items-stretch gap-1 border-b border-hairline bg-surface px-2 py-1.5">
      <Group label="History">
        <ToolButton title="Undo (⌘Z)" disabled={!canUndo} onClick={() => engine.undo()}>
          <Icon name="undo" />
        </ToolButton>
        <ToolButton title="Redo (⇧⌘Z)" disabled={!canRedo} onClick={() => engine.redo()}>
          <Icon name="redo" />
        </ToolButton>
      </Group>

      <Divider />
      <Group label="Select">
        <ToolGrid tools={SELECT_TOOLS} />
      </Group>

      <Divider />
      <Group label="Tools">
        <ToolGrid tools={DRAW_TOOLS} />
      </Group>

      <Divider />
      <Group label="Shapes">
        <ToolGrid tools={SHAPE_TOOLS} />
      </Group>

      <ContextGroup />

      {/* Colors, pushed to the right. */}
      <div className="ml-auto flex items-stretch">
        <Divider />
        <Group label="Colors">
          <ColorControls />
        </Group>
      </div>
    </div>
  );
}
