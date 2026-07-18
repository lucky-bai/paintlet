import { ask } from "@tauri-apps/plugin-dialog";
import { engine, usePaintStore } from "./state/store";
import { stageHooks } from "./state/stageHooks";
import { STAGE_PADDING, viewport } from "./state/viewport";
import { openImage, saveImage } from "./io/fileIO";
import { copySelection, cutSelection, pasteClipboard } from "./io/clipboard";
import { clampZoom } from "./lib/zoom";

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
  const { w, h } = usePaintStore.getState().defaultCanvasSize;
  engine.newDocument(w, h);
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

// — App —
export function openAboutDialog(): void {
  usePaintStore.getState().setAboutDialogOpen(true);
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
