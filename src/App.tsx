import { useEffect } from "react";
import { usePaintStore } from "./state/store";
import { stageHooks } from "./state/stageHooks";
import type { ToolId } from "./engine/types";
import { installAppMenu } from "./menu/appMenu";
import * as A from "./actions";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { TitleBar } from "./components/TitleBar";
import { Toolbar } from "./components/Toolbar";
import { CanvasStage } from "./components/CanvasStage";
import { StatusBar } from "./components/StatusBar";
import { ResizeDialog } from "./components/dialogs/ResizeDialog";
import { AboutDialog } from "./components/dialogs/AboutDialog";

// Single-key tool shortcuts (no modifier). These live in a keydown handler
// rather than the menu because single-key menu accelerators would hijack every
// keystroke in the text editor.
const TOOL_KEYS: Record<string, ToolId> = {
  s: "select",
  w: "freeSelect",
  p: "pencil",
  b: "brush",
  f: "fill",
  t: "text",
  e: "eraser",
  i: "eyedropper",
  l: "line",
  c: "curve",
  r: "rectangle",
  u: "roundedRectangle",
  o: "ellipse",
  g: "polygon",
};

function App() {
  const theme = usePaintStore((s) => s.theme);
  const setTool = usePaintStore((s) => s.setTool);

  // Build the native macOS menu bar once. Its items call straight into the
  // action layer (File/Edit/Image/View + ⌘-accelerators).
  useEffect(() => {
    installAppMenu().catch((err) =>
      console.error("Failed to install app menu:", err),
    );
  }, []);

  // Guard the window close button: if the document has unsaved changes, ask
  // before letting it close. Tauri's onCloseRequested runs our handler and then
  // destroys the window unless we preventDefault, so a clean document (or a
  // confirmed discard) closes normally and a cancel keeps the window open.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onCloseRequested(async (event) => {
        // A pending text edit counts as unsaved work: commit it so the dirty
        // check below sees it (and so a canceled close doesn't lose it).
        stageHooks.flushTextEdit?.();
        if (!usePaintStore.getState().isDirty) return; // clean → just close
        const discard = await ask("You have unsaved changes. Close without saving?", {
          title: "Paintlet",
          kind: "warning",
        });
        if (!discard) event.preventDefault();
      })
      .then((u) => (unlisten = u))
      .catch((err) => console.error("Failed to install close guard:", err));
    return () => unlisten?.();
  }, []);

  // Resolve theme → data-theme on <html>. "system" follows the OS and updates
  // live when the user flips appearance.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.setAttribute("data-theme", dark ? "dark" : "light");
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // Keyboard: zoom (⌘+/-/0), delete selection, and single-key tool switching.
  // ⌘-combos owned by the native menu (undo, save, clipboard, …) fall through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const editable =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);

      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          A.zoomIn();
        } else if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          A.zoomOut();
        } else if (e.key === "0") {
          e.preventDefault();
          A.actualSize();
        } else if (e.key === "9") {
          e.preventDefault();
          A.fitToWindow();
        }
        return; // other ⌘-combos belong to the menu
      }

      if (editable) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        A.deleteSelection();
        return;
      }

      if (!e.altKey) {
        const id = TOOL_KEYS[e.key.toLowerCase()];
        if (id) setTool(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool]);

  return (
    <div className="relative flex h-full flex-col bg-surface text-ink">
      <TitleBar />
      <Toolbar />
      <CanvasStage />
      <StatusBar />
      <ResizeDialog />
      <AboutDialog />
    </div>
  );
}

export default App;
