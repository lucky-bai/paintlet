import { useEffect, useRef, useState } from "react";
import { engine, usePaintStore } from "../state/store";
import { screenToCanvas } from "../engine/coords";
import { getTool, isShapeTool } from "../tools/registry";
import type { MouseButton, TextStyle } from "../engine/types";
import type { PointerInfo, ToolContext } from "../tools/Tool";

// Multi-line spacing factor for the text tool (matches the editor and raster).
const LINE_HEIGHT = 1.2;

const fontString = (ts: TextStyle, scale = 1) =>
  `${ts.italic ? "italic " : ""}${ts.bold ? "bold " : ""}${ts.fontSize * scale}px ${ts.fontFamily}`;

type TextEdit = { cx: number; cy: number; value: string };

// Hosts the stacked base + overlay + selection canvases and owns all pointer
// plumbing: map screen → logical coords, build a ToolContext from current store
// state, and dispatch to the active tool. Text is special-cased (a floating DOM
// editor), and the selection layer draws marching ants on an animation loop.
export function CanvasStage() {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const selectionRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const { w, h } = usePaintStore((s) => s.imageSize);
  const zoom = usePaintStore((s) => s.view.zoom);
  const activeToolId = usePaintStore((s) => s.activeToolId);
  const color1 = usePaintStore((s) => s.color1);
  const textStyle = usePaintStore((s) => s.textStyle);
  const hasSelection = usePaintStore((s) => s.hasSelection);

  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  // Mirror into a ref so the tool-switch effect can read the latest edit
  // without re-subscribing.
  const textEditRef = useRef<TextEdit | null>(null);
  textEditRef.current = textEdit;

  // Bind the engine to the three canvases once, on mount. Programmatic resizes
  // (Open / Resize / Crop / undo) are handled inside the engine, which resizes
  // the backing stores directly — so this must NOT re-run on size changes or it
  // would wipe the pixels.
  useEffect(() => {
    if (baseRef.current && overlayRef.current && selectionRef.current) {
      const s = usePaintStore.getState().imageSize;
      engine.attach(
        baseRef.current,
        overlayRef.current,
        selectionRef.current,
        s.w,
        s.h,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot the current config into a ToolContext for the active action.
  const makeCtx = (): ToolContext => {
    const s = usePaintStore.getState();
    // Shapes use the discrete size selector; pencil/brush/eraser use the slider.
    const size = isShapeTool(s.activeToolId) ? s.shapeSize : s.brushSize;
    return {
      base: engine.base,
      overlay: engine.overlay,
      engine,
      color1: s.color1,
      color2: s.color2,
      size,
      clearPreview: () => engine.clearOverlay(),
      commit: (label, crisp) => engine.commit(label, crisp),
      setColor1: (c) => s.setColor1(c),
      setColor2: (c) => s.setColor2(c),
    };
  };

  // Measure the editor box (logical px) so the floating textarea matches what
  // the rasterized text will occupy.
  const measureBox = (value: string, ts: TextStyle) => {
    const o = engine.overlay;
    o.save();
    o.font = fontString(ts);
    const lines = value.length ? value.split("\n") : [""];
    const width = Math.max(1, ...lines.map((l) => o.measureText(l).width));
    o.restore();
    const lh = Math.round(ts.fontSize * LINE_HEIGHT);
    return { w: Math.ceil(width) + 2, h: lines.length * lh };
  };

  // Rasterize an in-progress text edit onto the base and record a history step.
  const commitText = (t: TextEdit) => {
    if (!t.value.trim()) return;
    const s = usePaintStore.getState();
    const ts = s.textStyle;
    const o = engine.overlay;
    const lh = Math.round(ts.fontSize * LINE_HEIGHT);
    const pad = (lh - ts.fontSize) / 2; // center each line in its line box
    const ruleW = Math.max(1, Math.round(ts.fontSize / 14)); // decoration thickness
    o.save();
    o.fillStyle = s.color1;
    o.textBaseline = "top";
    o.font = fontString(ts);
    t.value.split("\n").forEach((line, i) => {
      const top = t.cy + i * lh + pad;
      o.fillText(line, t.cx, top);
      // Canvas text has no underline/strike; draw them as crisp rules spanning
      // the measured line width, under and through the glyphs.
      if ((ts.underline || ts.strike) && line.length) {
        const w = o.measureText(line).width;
        if (ts.underline)
          o.fillRect(t.cx, Math.round(top + ts.fontSize * 0.92), w, ruleW);
        if (ts.strike)
          o.fillRect(t.cx, Math.round(top + ts.fontSize * 0.52), w, ruleW);
      }
    });
    o.restore();
    engine.commit("text");
  };

  // Commit the previous tool's pending state when the active tool changes:
  // freehand/shape cleanup, selection bake-down, and pending-text rasterization.
  const prevToolRef = useRef(activeToolId);
  useEffect(() => {
    const prev = prevToolRef.current;
    if (prev !== activeToolId) {
      if (prev === "text") {
        if (textEditRef.current) commitText(textEditRef.current);
        setTextEdit(null);
      } else {
        getTool(prev)?.onDeactivate?.(makeCtx());
      }
      prevToolRef.current = activeToolId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToolId]);

  // Animate the selection marquee (marching ants). Runs only while something is
  // selected/floating; also repaints the float on each frame so a drag-move
  // follows the pointer smoothly.
  useEffect(() => {
    if (!hasSelection) {
      engine.renderSelection(0);
      return;
    }
    let raf = 0;
    let offset = 0;
    const loop = () => {
      offset = (offset + 0.5) % 8;
      engine.renderSelection(offset);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hasSelection]);

  // Esc cancels an in-progress stroke/shape, or deselects a finished selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawing.current) {
        drawing.current = false;
        getTool(usePaintStore.getState().activeToolId)?.onDeactivate?.(makeCtx());
        engine.clearOverlay();
      } else if (
        usePaintStore.getState().activeToolId === "select" &&
        engine.hasSelectionOrFloat()
      ) {
        engine.deselect();
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
    // Text tool: place/reposition the floating editor instead of stroking.
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
  const box = textEdit ? measureBox(textEdit.value, textStyle) : null;
  const lineHeightPx = Math.round(textStyle.fontSize * LINE_HEIGHT) * zoom;

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
          {/* Selection layer: marquee + floating content. Pointer-transparent so
              the overlay below keeps receiving pointer events. */}
          <canvas
            ref={selectionRef}
            className="pointer-events-none absolute left-0 top-0"
            style={{ ...cssSize, imageRendering: "pixelated" }}
          />

          {/* Floating multi-line text editor — rasterized onto the canvas when
              a new action starts or the tool changes. */}
          {textEdit && box && (
            <textarea
              key={`${textEdit.cx},${textEdit.cy}`}
              autoFocus
              value={textEdit.value}
              spellCheck={false}
              wrap="off"
              onChange={(e) =>
                setTextEdit({ ...textEdit, value: e.target.value })
              }
              onKeyDown={(e) => {
                // Enter inserts a newline (multi-line); Esc cancels the edit.
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setTextEdit(null);
                }
              }}
              className="absolute m-0 resize-none overflow-hidden whitespace-pre border border-dashed border-[var(--vp-accent)] bg-transparent p-0 outline-none"
              style={{
                left: textEdit.cx * zoom,
                top: textEdit.cy * zoom,
                width: box.w * zoom + 6,
                height: box.h * zoom,
                color: color1,
                font: fontString(textStyle, zoom),
                lineHeight: `${lineHeightPx}px`,
                textDecorationLine:
                  `${textStyle.underline ? "underline " : ""}${
                    textStyle.strike ? "line-through" : ""
                  }`.trim() || "none",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
