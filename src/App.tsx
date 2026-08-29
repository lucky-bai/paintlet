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
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { applyTheme } from "./lib/theme";

// Single-key tool shortcuts (no modifier), exactly the set Windows Paint binds
// and nothing more: no brush key, no shape keys, and `B` is the fill bucket
// rather than the brush. Paint's `Z` picks its magnifier, a tool Paintlet has
// no equivalent for, so `Z` stays unbound.
//
// These live in a keydown handler rather than the menu because single-key menu
// accelerators would hijack every keystroke in the text editor.
const TOOL_KEYS: Record<string, ToolId> = {
  p: "pencil",
  b: "fill",
  t: "text",
  e: "eraser",
  i: "eyedropper",
};

// `S` is the exception: in Paint it cycles the selection modes rather than
// picking one, so pressing it again swaps the marquee for the lasso and back.
// A live selection survives the swap — CanvasStage only bakes one down when
// leaving for a tool outside this pair.
const SELECT_CYCLE: ToolId[] = ["select", "freeSelect"];

// Arrow key → the direction it nudges a selection. One pixel per press, as in
// Paint; no coarse-step modifier, because Paint has none.
const NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
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
  // live when the user flips appearance. Shared with the About window's webview,
  // which starts with no data-theme of its own.
  useEffect(() => applyTheme(theme), [theme]);

  // Keyboard: zoom (⌘+/-/0), ⌘Y redo, delete and nudge the selection, and
  // single-key tool switching. ⌘-combos owned by the native menu (undo, save,
  // clipboard, …) fall through.
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
        } else if (e.key.toLowerCase() === "y") {
          // Paint's redo key, kept alongside the menu's ⇧⌘Z. It lives here
          // rather than on the menu item because an item carries one
          // accelerator, and ⇧⌘Z is the one worth showing on a Mac.
          e.preventDefault();
          A.redo();
        }
        return; // other ⌘-combos belong to the menu
      }

      if (editable) return;

      // An open dialog owns the keyboard: an unmodified key must not reach the
      // canvas behind it and silently switch tools or delete the selection.
      // Matched by role rather than a store flag because the Edit Color popup's
      // open state is local to ColorControls — the same check CanvasStage's Esc
      // handler makes, for the same reason.
      if (document.querySelector('[role="dialog"]')) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        A.deleteSelection();
        return;
      }

      const dir = NUDGE[e.key];
      if (dir) {
        // Swallowed only when a selection actually moved; with nothing
        // selected the arrows keep scrolling the work area.
        if (A.nudgeSelection(dir[0], dir[1])) e.preventDefault();
        return;
      }

      if (e.altKey) return; // Option makes these keys type symbols, not commands

      const key = e.key.toLowerCase();
      if (key === "s") {
        // From anywhere else this lands on the marquee (indexOf → -1 → 0).
        const i = SELECT_CYCLE.indexOf(usePaintStore.getState().activeToolId);
        setTool(SELECT_CYCLE[(i + 1) % SELECT_CYCLE.length]);
        return;
      }
      const id = TOOL_KEYS[key];
      if (id) setTool(id);
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
      <SettingsDialog />
    </div>
  );
}

export default App;
