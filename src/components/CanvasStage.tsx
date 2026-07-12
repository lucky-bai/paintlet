import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { engine, usePaintStore } from "../state/store";
import { stageHooks } from "../state/stageHooks";
import { viewport } from "../state/viewport";
import { screenToCanvas } from "../engine/coords";
import { getTool, isShapeTool } from "../tools/registry";
import { clampZoom } from "../lib/zoom";
import { HANDLE_CURSOR, selectionHandles } from "../engine/selectionHandles";
import type { MouseButton, Point, Rect, TextStyle, ToolId } from "../engine/types";
import type { PointerInfo, ToolContext } from "../tools/Tool";

// The resize-grip cursor under a point on a selection, or null. Mirrors
// SelectTool.hitHandle so the pointer telegraphs a grab before the drag.
function handleCursorAt(p: Point, r: Rect, zoom: number): string | null {
  const tol = 6 / zoom;
  for (const h of selectionHandles(r)) {
    if (Math.abs(p.x - h.x) <= tol && Math.abs(p.y - h.y) <= tol)
      return HANDLE_CURSOR[h.id];
  }
  return null;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);

  // — panning (space-drag or middle-drag) —
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false); // handler-readable mirror of spaceHeld
  const [panning, setPanning] = useState(false);
  const pan = useRef<{
    id: number;
    x: number;
    y: number;
    sl: number;
    st: number;
  } | null>(null);

  // Zoom-at-cursor: the image point that must stay under this client position
  // across the re-render that applies a new zoom.
  const zoomAnchor = useRef<{
    clientX: number;
    clientY: number;
    ix: number;
    iy: number;
  } | null>(null);

  // — canvas drag-resize handles (right / bottom / corner of the paper) —
  // Dragging shows a dashed preview of the target size; the canvas is cropped
  // or extended (white fill, anchored top-left) on release — as in Win11 Paint.
  const [resizePreview, setResizePreview] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const resizeDrag = useRef<{
    axis: "x" | "y" | "xy";
    startW: number;
    startH: number;
    sx: number;
    sy: number;
  } | null>(null);
  // Cursor to force on the whole work area while a canvas-resize handle is being
  // dragged (pointer capture otherwise reverts it to the tool cursor once the
  // pointer leaves the little grip).
  const [canvasResizeCursor, setCanvasResizeCursor] = useState<string | null>(
    null,
  );
  // Cursor when hovering a selection resize grip (before the drag begins).
  const [handleCursor, setHandleCursor] = useState<string | null>(null);

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
      zoom: s.view.zoom,
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

  // Expose the stage's private state to the action layer: committing a pending
  // text edit (before Save/New/Open/close) and cancelling an in-progress tool
  // session (before Undo/Redo). Selection tools are excluded from the latter —
  // their onDeactivate would bake the float and push a history step of its own.
  useEffect(() => {
    stageHooks.flushTextEdit = () => {
      if (textEditRef.current) {
        commitText(textEditRef.current);
        setTextEdit(null);
      }
    };
    stageHooks.cancelToolSession = () => {
      const id = usePaintStore.getState().activeToolId;
      if (id === "select" || id === "freeSelect" || id === "text") return;
      drawing.current = false;
      getTool(id)?.onDeactivate?.(makeCtx());
    };
    return () => {
      stageHooks.flushTextEdit = null;
      stageHooks.cancelToolSession = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commit the previous tool's pending state when the active tool changes:
  // freehand/shape cleanup, selection bake-down, and pending-text rasterization.
  // Exception (matches Win11 Paint): hopping between the marquee and the lasso
  // keeps the current selection — either tool can move what the other selected,
  // so skip the deactivate that would bake it down.
  const prevToolRef = useRef(activeToolId);
  useEffect(() => {
    const prev = prevToolRef.current;
    if (prev !== activeToolId) {
      const isSelect = (id: ToolId) => id === "select" || id === "freeSelect";
      if (prev === "text") {
        if (textEditRef.current) commitText(textEditRef.current);
        setTextEdit(null);
      } else if (!(isSelect(prev) && isSelect(activeToolId))) {
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
      const s = usePaintStore.getState();
      // Resize grips only for the rectangular select tool (the lasso just
      // moves; switch to Select to resize a free-form selection).
      const showHandles = s.activeToolId === "select";
      engine.renderSelection(offset, s.view.zoom, showHandles);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [hasSelection]);

  // Zoom gestures on the work area: ⌘/Ctrl-wheel (and Chromium's synthesized
  // ctrl-wheel for pinches) plus WebKit's native gesture events, which is what
  // the Tauri webview emits for a trackpad pinch. Both funnel through zoomAt so
  // the pixel under the pointer stays put. Registered manually because React
  // wheel listeners are passive (preventDefault would be ignored) and gesture
  // events have no React equivalent.
  useEffect(() => {
    const el = containerRef.current!;
    viewport.el = el;

    const zoomAt = (clientX: number, clientY: number, next: number) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const cur = usePaintStore.getState().view.zoom;
      const z = clampZoom(next);
      if (z === cur) return;
      const rect = overlay.getBoundingClientRect();
      zoomAnchor.current = {
        clientX,
        clientY,
        ix: (clientX - rect.left) / cur,
        iy: (clientY - rect.top) / cur,
      };
      usePaintStore.getState().setZoom(z);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scroll keeps scrolling
      e.preventDefault();
      // Normalize the delta: mouse wheels report deltaMode 1 (lines) or big
      // pixel steps (~100/notch); a trackpad pinch reports small pixel deltas.
      // Convert lines/pages to px, then clamp so one hard notch can't leap the
      // whole zoom range, and use a gentle factor so each step is modest.
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; // lines → px
      else if (e.deltaMode === 2) dy *= el.clientHeight; // pages → px
      dy = Math.max(-48, Math.min(48, dy));
      const cur = usePaintStore.getState().view.zoom;
      zoomAt(e.clientX, e.clientY, cur * Math.exp(-dy * 0.0055));
    };

    // GestureEvent is WebKit-only and untyped; e.scale is relative to the
    // gesture's start, so anchor the factor to the zoom captured at start.
    let gestureStartZoom = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartZoom = usePaintStore.getState().view.zoom;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      zoomAt(g.clientX, g.clientY, gestureStartZoom * g.scale);
    };
    const onGestureEnd = (e: Event) => e.preventDefault();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", onGestureEnd);
    return () => {
      viewport.el = null;
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
  }, []);

  // After a zoom-at-cursor renders, scroll so the anchored image point is back
  // under the pointer. Layout effect: must run before the frame paints.
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    if (!a) return;
    zoomAnchor.current = null;
    const el = containerRef.current;
    const overlay = overlayRef.current;
    if (!el || !overlay) return;
    const rect = overlay.getBoundingClientRect();
    el.scrollLeft += rect.left + a.ix * zoom - a.clientX;
    el.scrollTop += rect.top + a.iy * zoom - a.clientY;
  }, [zoom]);

  // Track the spacebar for space-drag panning (ignored while typing in a
  // field). Window blur releases it so a ⌘Tab away can't wedge pan mode on.
  useEffect(() => {
    const setHeld = (held: boolean) => {
      spaceHeldRef.current = held;
      setSpaceHeld(held);
    };
    const onDown = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const editable =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (e.code !== "Space" || editable) return;
      e.preventDefault(); // space would otherwise scroll the work area
      setHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setHeld(false);
    };
    const onBlur = () => setHeld(false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Pan gestures, in the capture phase so they win over the canvas tools:
  // space-drag or middle-button drag scrolls the work area directly.
  const onPanPointerDown = (e: React.PointerEvent) => {
    if (!spaceHeldRef.current && e.button !== 1) return;
    const el = containerRef.current!;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    pan.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sl: el.scrollLeft,
      st: el.scrollTop,
    };
    setPanning(true);
  };
  const onPanPointerMove = (e: React.PointerEvent) => {
    const p = pan.current;
    if (!p || e.pointerId !== p.id) return;
    e.stopPropagation();
    const el = containerRef.current!;
    el.scrollLeft = p.sl - (e.clientX - p.x);
    el.scrollTop = p.st - (e.clientY - p.y);
  };
  const onPanPointerEnd = (e: React.PointerEvent) => {
    if (!pan.current || e.pointerId !== pan.current.id) return;
    e.stopPropagation();
    pan.current = null;
    setPanning(false);
    try {
      containerRef.current!.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  // Canvas-resize handle drag. Pointer capture keeps the gesture alive when
  // the cursor leaves the little handle; sizes are computed from the total
  // client-pixel delta divided by zoom, clamped to at least 1×1.
  const resizeTarget = (e: React.PointerEvent) => {
    const d = resizeDrag.current!;
    const z = usePaintStore.getState().view.zoom;
    return {
      w:
        d.axis === "y"
          ? d.startW
          : Math.max(1, Math.round(d.startW + (e.clientX - d.sx) / z)),
      h:
        d.axis === "x"
          ? d.startH
          : Math.max(1, Math.round(d.startH + (e.clientY - d.sy) / z)),
    };
  };
  const axisCursor = { x: "ew-resize", y: "ns-resize", xy: "nwse-resize" } as const;
  const onHandleDown = (axis: "x" | "y" | "xy") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizeDrag.current = { axis, startW: w, startH: h, sx: e.clientX, sy: e.clientY };
    setResizePreview({ w, h });
    setCanvasResizeCursor(axisCursor[axis]);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!resizeDrag.current) return;
    e.stopPropagation();
    setResizePreview(resizeTarget(e));
  };
  const onHandleUp = (e: React.PointerEvent) => {
    const d = resizeDrag.current;
    if (!d) return;
    e.stopPropagation();
    const t = resizeTarget(e);
    resizeDrag.current = null;
    setResizePreview(null);
    setCanvasResizeCursor(null);
    if (t.w !== d.startW || t.h !== d.startH) engine.setCanvasSize(t.w, t.h);
  };

  // Esc cancels an in-progress stroke/shape (including a multi-click polygon
  // or curve between gestures, via the tool's own onKeyDown), or deselects a
  // finished selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const activeId = usePaintStore.getState().activeToolId;
      if (drawing.current) {
        drawing.current = false;
        getTool(activeId)?.onDeactivate?.(makeCtx());
        engine.clearOverlay();
        return;
      }
      getTool(activeId)?.onKeyDown?.(e, makeCtx());
      if (
        (activeId === "select" || activeId === "freeSelect") &&
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
    // Middle button and space-drag belong to panning, never to tools.
    if (e.button === 1 || spaceHeldRef.current) return;
    // Text tool: place/reposition the floating editor instead of stroking.
    if (activeToolId === "text") {
      // Cancel the browser's post-mousedown focus default, which would blur
      // the freshly mounted textarea back to <body> — where the next
      // keystrokes would hit the single-key tool shortcuts instead.
      e.preventDefault();
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
    const tool = getTool(activeToolId);
    if (!drawing.current) {
      // Telegraph a selection resize grip under the pointer (Select tool only).
      if (activeToolId === "select" && engine.selection) {
        const pt = screenToCanvas(e.clientX, e.clientY, overlayRef.current!);
        setHandleCursor(
          handleCursorAt(pt, engine.selection, usePaintStore.getState().view.zoom),
        );
      } else if (handleCursor !== null) {
        setHandleCursor(null);
      }
      // Multi-click tools (polygon) rubber-band between clicks.
      tool?.onPointerHover?.(infoOf(e), makeCtx());
      return;
    }
    tool?.onPointerMove(infoOf(e), makeCtx());
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
    // Classic Paint: after the eyedropper picks, return to the previous tool.
    if (activeToolId === "eyedropper") {
      const s = usePaintStore.getState();
      s.setTool(s.previousToolId === "eyedropper" ? "pencil" : s.previousToolId);
    }
  };

  const toolCursor =
    getTool(activeToolId)?.cursor ??
    (activeToolId === "text" ? "text" : "default");
  const cursor = panning
    ? "grabbing"
    : canvasResizeCursor
      ? canvasResizeCursor
      : spaceHeld
        ? "grab"
        : (handleCursor ?? toolCursor);
  const cssSize = { width: w * zoom, height: h * zoom };
  const box = textEdit ? measureBox(textEdit.value, textStyle) : null;
  const lineHeightPx = Math.round(textStyle.fontSize * LINE_HEIGHT) * zoom;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-auto bg-work"
      style={{
        cursor:
          canvasResizeCursor ??
          (panning ? "grabbing" : spaceHeld ? "grab" : undefined),
      }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDownCapture={onPanPointerDown}
      onPointerMoveCapture={onPanPointerMove}
      onPointerUpCapture={onPanPointerEnd}
      onPointerCancelCapture={onPanPointerEnd}
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

          {/* Canvas resize handles (right / bottom / corner), as in Win11
              Paint: drag to crop or extend the canvas. */}
          {(
            [
              ["x", { right: -6, top: "50%", marginTop: -5 }, "ew-resize"],
              ["y", { bottom: -6, left: "50%", marginLeft: -5 }, "ns-resize"],
              ["xy", { right: -6, bottom: -6 }, "nwse-resize"],
            ] as const
          ).map(([axis, pos, cur]) => (
            <div
              key={axis}
              title="Drag to resize the canvas"
              className="absolute z-10 h-2.5 w-2.5 rounded-[2px] border border-neutral-400 bg-white shadow-sm"
              style={{ ...pos, cursor: cur }}
              onPointerDown={onHandleDown(axis)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
            />
          ))}

          {/* Dashed preview + size badge while a resize handle drags. */}
          {resizePreview && (
            <>
              <div
                className="pointer-events-none absolute left-0 top-0 z-10 border border-dashed border-neutral-500"
                style={{
                  width: resizePreview.w * zoom,
                  height: resizePreview.h * zoom,
                }}
              />
              <div
                className="pointer-events-none absolute z-10 whitespace-nowrap rounded bg-surface px-1.5 py-0.5 text-xs text-ink shadow"
                style={{
                  left: resizePreview.w * zoom + 8,
                  top: resizePreview.h * zoom + 8,
                }}
              >
                {resizePreview.w} × {resizePreview.h}px
              </div>
            </>
          )}

          {/* Floating multi-line text editor — rasterized onto the canvas when
              a new action starts or the tool changes. */}
          {textEdit && box && (
            <textarea
              key={`${textEdit.cx},${textEdit.cy}`}
              autoFocus
              ref={(el) => el?.focus()}
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
