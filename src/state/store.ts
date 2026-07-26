import { create } from "zustand";
import { CanvasEngine } from "../engine/CanvasEngine";
import { loadSettings, saveSettings } from "./settings";
import type {
  Point,
  TextStyle,
  Theme,
  ToolId,
  ViewTransform,
} from "../engine/types";

// One engine instance for the app's lifetime. Deliberately OUTSIDE the reactive
// store: pixel data must never live in React state or it would re-render on
// every stroke. Components import `engine` directly for imperative calls.
export const engine = new CanvasEngine();

// Size a new document opens at. Matches CanvasEngine's own width/height
// defaults, which is what attach() falls back to before anything is loaded.
// Not user-configurable — Paint has no such preference, and File → New followed
// by Image → Resize covers the rare case.
export const DEFAULT_CANVAS_SIZE = { w: 800, h: 600 };

// The theme is read once at startup and written back on every change; the
// read/write helpers live in ./settings so the About window's webview can share
// them without importing the engine.
const initialSettings = loadSettings();

interface PaintState {
  // — config / UI state (reactive) —
  activeToolId: ToolId;
  previousToolId: ToolId; // what the eyedropper returns to after a pick
  color1: string; // foreground (primary button)
  color2: string; // background (secondary button)
  brushSize: number; // continuous width for pencil/brush/eraser
  shapeSize: number; // discrete stroke width for shape tools (1/3/5/8)
  textStyle: TextStyle;
  imageSize: { w: number; h: number }; // mirrored from the engine
  view: ViewTransform; // zoom/pan
  cursorPos: Point | null; // for the status bar
  filePath: string | null;
  theme: Theme;
  resizeDialogOpen: boolean;
  settingsDialogOpen: boolean;

  // — mirrored from the engine (menu/button enablement, title dot) —
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  selectionSize: { w: number; h: number } | null; // status-bar readout

  // — actions —
  setTool: (id: ToolId) => void;
  setColor1: (c: string) => void;
  setColor2: (c: string) => void;
  swapColors: () => void;
  setBrushSize: (n: number) => void;
  setShapeSize: (n: number) => void;
  setTextStyle: (patch: Partial<TextStyle>) => void;
  setZoom: (z: number) => void;
  setCursorPos: (p: Point | null) => void;
  setTheme: (t: Theme) => void;
  setFilePath: (p: string | null) => void;
  setResizeDialogOpen: (open: boolean) => void;
  setSettingsDialogOpen: (open: boolean) => void;
  setEngineState: (s: {
    canUndo: boolean;
    canRedo: boolean;
    isDirty: boolean;
    width: number;
    height: number;
    hasSelection: boolean;
    selectionSize: { w: number; h: number } | null;
  }) => void;
}

export const usePaintStore = create<PaintState>((set) => ({
  activeToolId: "pencil",
  previousToolId: "pencil",
  color1: "#000000",
  color2: "#ffffff",
  brushSize: 4,
  shapeSize: 3,
  textStyle: {
    fontFamily: "Helvetica",
    fontSize: 24,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  },
  imageSize: { ...DEFAULT_CANVAS_SIZE },
  view: { zoom: 1, panX: 0, panY: 0 },
  cursorPos: null,
  filePath: null,
  theme: initialSettings.theme,
  resizeDialogOpen: false,
  settingsDialogOpen: false,

  isDirty: false,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  selectionSize: null,

  setTool: (id) =>
    set((s) =>
      id === s.activeToolId
        ? {}
        : { activeToolId: id, previousToolId: s.activeToolId },
    ),
  setColor1: (c) => set({ color1: c }),
  setColor2: (c) => {
    engine.setBgColor(c); // keep the transparent-selection / hole-fill key in sync
    set({ color2: c });
  },
  swapColors: () =>
    set((s) => {
      engine.setBgColor(s.color1);
      return { color1: s.color2, color2: s.color1 };
    }),
  setBrushSize: (n) => set({ brushSize: n }),
  setShapeSize: (n) => set({ shapeSize: n }),
  setTextStyle: (patch) =>
    set((s) => ({ textStyle: { ...s.textStyle, ...patch } })),
  setZoom: (z) => set((s) => ({ view: { ...s.view, zoom: z } })),
  setCursorPos: (p) => set({ cursorPos: p }),
  setTheme: (t) => {
    saveSettings({ theme: t });
    set({ theme: t });
  },
  setFilePath: (p) => set({ filePath: p }),
  setResizeDialogOpen: (open) => set({ resizeDialogOpen: open }),
  setSettingsDialogOpen: (open) => set({ settingsDialogOpen: open }),
  setEngineState: (s) =>
    set({
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      isDirty: s.isDirty,
      hasSelection: s.hasSelection,
      selectionSize: s.selectionSize,
      // The engine owns the document dimensions (they change on Open/Resize/
      // Crop/undo); mirror them here so CSS sizing and the status bar follow.
      imageSize: { w: s.width, h: s.height },
    }),
}));

// Bridge engine → store so undo/redo/dirty/size/selection stay mirrored into the
// UI. The engine pushes an EngineChange on every mutation; we fan it into React.
engine.setOnChange((c) => usePaintStore.getState().setEngineState(c));
