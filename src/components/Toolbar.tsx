import { engine, usePaintStore } from "../state/store";
import { isImplemented } from "../tools/registry";
import type { ToolId } from "../engine/types";
import { Icon, type IconName } from "./Icon";
import { ToolButton } from "./ToolButton";
import { ColorControls } from "./ColorControls";

type ToolDef = { id: ToolId; icon: IconName; label: string; key: string };

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
  { id: "ellipse", icon: "ellipse", label: "Ellipse", key: "O" },
];

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

export function Toolbar() {
  const canUndo = usePaintStore((s) => s.canUndo);
  const canRedo = usePaintStore((s) => s.canRedo);
  const brushSize = usePaintStore((s) => s.brushSize);
  const setBrushSize = usePaintStore((s) => s.setBrushSize);

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
      <ToolGroup tools={DRAW_TOOLS} />
      <Divider />
      <ToolGroup tools={SHAPE_TOOLS} />
      <Divider />

      {/* Size slider. */}
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

      <Divider />

      {/* Colors, pushed to the right. */}
      <div className="ml-auto">
        <ColorControls />
      </div>
    </div>
  );
}
