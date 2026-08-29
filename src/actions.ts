import { ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_CANVAS_SIZE, engine, usePaintStore } from "./state/store";
import { stageHooks } from "./state/stageHooks";
import { STAGE_PADDING, viewport } from "./state/viewport";
import { openImage, saveImage } from "./io/fileIO";
import { copySelection, cutSelection, pasteClipboard } from "./io/clipboard";
import { clampZoom } from "./lib/zoom";
import { nextBrushSize, nextShapeSize } from "./lib/sizes";
import { isFreehandTool, isShapeTool } from "./tools/registry";

// App-level commands, shared by the native menu and the keyboard handlers so a
// shortcut and its menu item always do the exact same thing. Clipboard/edit
// commands fall back to the browser's native behavior when a text field is
// focused (e.g. while editing text or a dialog input), so ⌘C in a field copies
// text rather than the canvas selection.

function editableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

// — File —
// Every entry point that exports or replaces the document commits a pending
// text edit first — typed-but-unplaced text must never be silently dropped.
export async function newDocument(): Promise<void> {
  stageHooks.flushTextEdit?.();
  if (usePaintStore.getState().isDirty) {
    const ok = await ask("Discard the current drawing?", {
      title: "New Image",
      kind: "warning",
    });
    if (!ok) return;
  }
  engine.newDocument(DEFAULT_CANVAS_SIZE.w, DEFAULT_CANVAS_SIZE.h);
  usePaintStore.getState().setFilePath(null);
}

export async function openFile(): Promise<void> {
  stageHooks.flushTextEdit?.();
  if (usePaintStore.getState().isDirty) {
    const ok = await ask("Discard the current drawing?", {
      title: "Open Image",
      kind: "warning",
    });
    if (!ok) return;
  }
  void openImage();
}
export function saveFile(): void {
  stageHooks.flushTextEdit?.();
  void saveImage(false);
}
export function saveFileAs(): void {
  stageHooks.flushTextEdit?.();
  void saveImage(true);
}

// — Edit —
// Undo/redo first cancel any in-progress tool gesture (a half-built polygon or
// curve) so its rubber-band preview can't linger over the restored pixels.
export function undo(): void {
  if (editableFocused()) {
    document.execCommand("undo");
    return;
  }
  stageHooks.cancelToolSession?.();
  engine.undo();
}
export function redo(): void {
  if (editableFocused()) {
    document.execCommand("redo");
    return;
  }
  stageHooks.cancelToolSession?.();
  engine.redo();
}
export function copy(): void {
  if (editableFocused()) document.execCommand("copy");
  else void copySelection();
}
export function cut(): void {
  if (editableFocused()) document.execCommand("cut");
  else void cutSelection();
}
export function paste(): void {
  if (editableFocused()) document.execCommand("paste");
  else void pasteClipboard();
}
export function selectAll(): void {
  if (editableFocused()) {
    document.execCommand("selectAll");
    return;
  }
  engine.selectAll();
  usePaintStore.getState().setTool("select");
}
export function deleteSelection(): void {
  if (editableFocused()) return;
  engine.deleteSelection(usePaintStore.getState().color2);
}
export function deselect(): void {
  if (editableFocused()) return;
  engine.deselect();
}

// Move the selection by whole pixels from the keyboard. Mirrors what a drag
// does: lift the pixels into a float on the first press (leaving a
// background-colored hole), then reposition it. The history step is recorded
// once, when the float is committed on deselect — so a run of arrow presses
// undoes as a single move, exactly like one drag. The marquee redraws on the
// selection layer's animation frame, so no explicit repaint is needed.
//
// Returns whether the keystroke did something, so the caller only swallows an
// arrow key that moved a selection and leaves the rest scrolling the canvas.
export function nudgeSelection(dx: number, dy: number): boolean {
  if (editableFocused()) return false;
  const s = usePaintStore.getState();
  // Only the selection tools own the arrow keys. Nothing else can be holding a
  // selection anyway — switching tools bakes one down, and paste drops into
  // Select — but checking the tool keeps that an explicit rule rather than a
  // consequence of the lifecycle.
  if (s.activeToolId !== "select" && s.activeToolId !== "freeSelect") return false;
  if (!engine.hasSelectionOrFloat()) return false;
  engine.beginFloat(s.color2);
  const r = engine.selection;
  if (!r) return false;
  engine.moveFloatTo(r.x + dx, r.y + dy);
  return true;
}

// — Tools —
export function swapColors(): void {
  if (editableFocused()) return;
  usePaintStore.getState().swapColors();
}

// `[` / `]`: step the active tool's stroke width — the discrete ladder for the
// shape tools, the continuous one for pencil/brush/eraser. Tools with no width
// (select, lasso, fill, text, eyedropper) ignore it.
export function stepStrokeSize(dir: 1 | -1): void {
  if (editableFocused()) return;
  const s = usePaintStore.getState();
  if (isShapeTool(s.activeToolId)) s.setShapeSize(nextShapeSize(s.shapeSize, dir));
  else if (isFreehandTool(s.activeToolId))
    s.setBrushSize(nextBrushSize(s.brushSize, dir));
}

// — App —
// About is a real OS window, not an in-app panel, so opening it is a Rust call
// rather than a store flag. Fire-and-forget: the window either appears or comes
// forward, and there's nothing for the caller to wait on.
export function openAboutWindow(): void {
  invoke("open_about_window").catch((err) =>
    console.error("Failed to open the About window:", err),
  );
}
export function openSettingsDialog(): void {
  usePaintStore.getState().setSettingsDialogOpen(true);
}

// — Image —
export function openResizeDialog(): void {
  usePaintStore.getState().setResizeDialogOpen(true);
}
export function crop(): void {
  engine.cropToSelection();
}
export function flipHorizontal(): void {
  engine.flipHorizontal();
}
export function flipVertical(): void {
  engine.flipVertical();
}
export function rotateRight(): void {
  engine.rotate90();
}
export function rotateLeft(): void {
  engine.rotate270();
}
export function rotate180(): void {
  engine.rotate180();
}

// — View —
export function zoomIn(): void {
  const s = usePaintStore.getState();
  s.setZoom(clampZoom(s.view.zoom + 0.25));
}
export function zoomOut(): void {
  const s = usePaintStore.getState();
  s.setZoom(clampZoom(s.view.zoom - 0.25));
}
export function actualSize(): void {
  usePaintStore.getState().setZoom(1);
}

// Pick the zoom that shows the whole image inside the work area (keeping its
// padding), like Preview's Zoom to Fit. No-op before the stage mounts.
export function fitToWindow(): void {
  const el = viewport.el;
  const s = usePaintStore.getState();
  if (!el) return;
  const availW = el.clientWidth - STAGE_PADDING * 2;
  const availH = el.clientHeight - STAGE_PADDING * 2;
  if (availW <= 0 || availH <= 0) return;
  const fit = Math.min(availW / s.imageSize.w, availH / s.imageSize.h);
  // Round down to a hundredth so the fitted image never overshoots into
  // scrollbars from a fractional pixel.
  s.setZoom(clampZoom(Math.floor(fit * 100) / 100));
}
