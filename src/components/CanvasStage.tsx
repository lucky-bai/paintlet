import { useEffect, useRef, useState } from "react";
import { engine, usePaintStore } from "../state/store";
import { screenToCanvas } from "../engine/coords";
import { getTool } from "../tools/registry";
import type { MouseButton } from "../engine/types";
import type { PointerInfo, ToolContext } from "../tools/Tool";

// Map the size slider to a text point size (px). Text has no dedicated size
// control yet, so it rides the shared brush size.
const fontPxFor = (brushSize: number) => Math.max(12, brushSize * 3);

type TextEdit = { cx: number; cy: number; value: string };

// Hosts the stacked base + overlay canvases and owns all pointer plumbing:
// map screen → logical coords, build a ToolContext from current store state,
// and dispatch to the active tool's lifecycle hooks. The text tool is special-
// cased here because it needs a floating DOM input rather than pointer strokes.
export function CanvasStage() {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const { w, h } = usePaintStore((s) => s.imageSize);
  const zoom = usePaintStore((s) => s.view.zoom);
  const activeToolId = usePaintStore((s) => s.activeToolId);
  const color1 = usePaintStore((s) => s.color1);
  const brushSize = usePaintStore((s) => s.brushSize);

  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);

  // (Re)bind the engine when the document size changes (mount / New / Open /
  // Resize). Zoom is CSS-only and must NOT re-attach — that would wipe pixels.
  useEffect(() => {
    if (baseRef.current && overlayRef.current) {
      engine.attach(baseRef.current, overlayRef.current, w, h);
    }
  }, [w, h]);

  // Snapshot the current config into a ToolContext for the active action.
  const makeCtx = (): ToolContext => {
    const s = usePaintStore.getState();
    return {
      base: engine.base,
      overlay: engine.overlay,
      engine,
      color1: s.color1,
      color2: s.color2,
      size: s.brushSize,
      clearPreview: () => engine.clearOverlay(),
      commit: (label) => engine.commit(label),
      setColor1: (c) => s.setColor1(c),
      setColor2: (c) => s.setColor2(c),
    };
  };

  // Rasterize an in-progress text edit onto the base and record a history step.
  const commitText = (t: TextEdit) => {
    if (!t.value.trim()) return;
    const s = usePaintStore.getState();
    const o = engine.overlay;
    o.fillStyle = s.color1;
    o.textBaseline = "top";
    o.font = `${fontPxFor(s.brushSize)}px sans-serif`;
    o.fillText(t.value, t.cx, t.cy);
    engine.commit("text");
  };

  const finishText = () => {
    if (textEdit) commitText(textEdit);
    setTextEdit(null);
  };

  // Cancel an in-progress shape/stroke on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawing.current) {
        drawing.current = false;
        getTool(usePaintStore.getState().activeToolId)?.onDeactivate?.(makeCtx());
        engine.clearOverlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // makeCtx reads live store state, so an empty dep list is correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buttonOf = (e: React.PointerEvent): MouseButton =>
    e.button === 2 || (e.buttons & 2) === 2 ? "secondary" : "primary";

  const infoOf = (e: React.PointerEvent): PointerInfo => ({
    point: screenToCanvas(e.clientX, e.clientY, overlayRef.current!),
    button: buttonOf(e),
    shiftKey: e.shiftKey,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    // Text tool: place/reposition the floating input instead of stroking.
    if (activeToolId === "text") {
      const pt = screenToCanvas(e.clientX, e.clientY, overlayRef.current!);
      if (textEdit) commitText(textEdit); // commit any existing edit first
      setTextEdit({ cx: pt.x, cy: pt.y, value: "" });
      return;
    }
    const tool = getTool(activeToolId);
    if (!tool) return;
    overlayRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    tool.onPointerDown(infoOf(e), makeCtx());
  };

  const onPointerMove = (e: React.PointerEvent) => {
    usePaintStore
      .getState()
      .setCursorPos(screenToCanvas(e.clientX, e.clientY, overlayRef.current!));
    if (!drawing.current) return;
    getTool(activeToolId)?.onPointerMove(infoOf(e), makeCtx());
  };

  const endStroke = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current = false;
    getTool(activeToolId)?.onPointerUp(infoOf(e), makeCtx());
    try {
      overlayRef.current!.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  const cursor =
    getTool(activeToolId)?.cursor ??
    (activeToolId === "text" ? "text" : "default");
  const cssSize = { width: w * zoom, height: h * zoom };

  return (
    <div
      className="relative flex-1 overflow-auto bg-work"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex min-h-full min-w-full items-center justify-center p-10">
        {/* The "paper": drop shadow + hairline ring around the document. */}
        <div className="relative shadow-lg ring-1 ring-black/10" style={cssSize}>
          <canvas
            ref={baseRef}
            className="absolute left-0 top-0 bg-white"
            style={{ ...cssSize, imageRendering: "pixelated" }}
          />
          <canvas
            ref={overlayRef}
            className="absolute left-0 top-0 touch-none"
            style={{ ...cssSize, imageRendering: "pixelated", cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={() =>
              !drawing.current && usePaintStore.getState().setCursorPos(null)
            }
          />

          {/* Floating text editor — rasterized onto the canvas on Enter/blur. */}
          {textEdit && (
            <input
              key={`${textEdit.cx},${textEdit.cy}`}
              autoFocus
              value={textEdit.value}
              spellCheck={false}
              onChange={(e) =>
                setTextEdit({ ...textEdit, value: e.target.value })
              }
              onBlur={finishText}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  finishText();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextEdit(null);
                }
              }}
              className="absolute m-0 min-w-[2ch] border border-dashed border-black/40 bg-transparent p-0 leading-none outline-none"
              style={{
                left: textEdit.cx * zoom,
                top: textEdit.cy * zoom,
                color: color1,
                font: `${fontPxFor(brushSize) * zoom}px sans-serif`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
