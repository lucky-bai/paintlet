import { ask } from "@tauri-apps/plugin-dialog";
import { engine, usePaintStore } from "./state/store";
import { openImage, saveImage } from "./io/fileIO";
import { copySelection, cutSelection, pasteClipboard } from "./io/clipboard";

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

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// — File —
export async function newDocument(): Promise<void> {
  if (usePaintStore.getState().isDirty) {
    const ok = await ask("Discard the current drawing?", {
      title: "New Image",
      kind: "warning",
    });
    if (!ok) return;
  }
  engine.newDocument(800, 600);
  usePaintStore.getState().setFilePath(null);
}

export function openFile(): void {
  void openImage();
}
export function saveFile(): void {
  void saveImage(false);
}
export function saveFileAs(): void {
  void saveImage(true);
}

// — Edit —
export function undo(): void {
  if (editableFocused()) document.execCommand("undo");
  else engine.undo();
}
export function redo(): void {
  if (editableFocused()) document.execCommand("redo");
  else engine.redo();
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
