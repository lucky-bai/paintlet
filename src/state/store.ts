import { create } from "zustand";
import { CanvasEngine } from "../engine/CanvasEngine";
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

// — persisted settings (Settings window) —
// Theme and the default new-image size survive across launches via localStorage.
// Access is guarded so non-browser contexts (unit tests) never throw.
const SETTINGS_KEY = "paintlet.settings";
interface PersistedSettings {
  theme: Theme;
  defaultCanvasSize: { w: number; h: number };
}
const clampDim = (n: unknown, fallback: number): number => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 1 && v <= 10000 ? v : fallback;
};
function loadSettings(): PersistedSettings {
  const fallback: PersistedSettings = {
    theme: "system",
    defaultCanvasSize: { w: 800, h: 600 },
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<PersistedSettings>;
    const theme =
      p.theme === "light" || p.theme === "dark" || p.theme === "system"
        ? p.theme
        : "system";
    return {
      theme,
      defaultCanvasSize: {
        w: clampDim(p.defaultCanvasSize?.w, 800),
        h: clampDim(p.defaultCanvasSize?.h, 600),
      },
    };
  } catch {
    return fallback;
  }
}
function saveSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings just won't persist this session */
  }
}
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
  defaultCanvasSize: { w: number; h: number }; // size a new image opens at
  view: ViewTransform; // zoom/pan
  cursorPos: Point | null; // for the status bar
  filePath: string | null;
  theme: Theme;
  resizeDialogOpen: boolean;
  aboutDialogOpen: boolean;
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
  setDefaultCanvasSize: (size: { w: number; h: number }) => void;
  setFilePath: (p: string | null) => void;
  setResizeDialogOpen: (open: boolean) => void;
  setAboutDialogOpen: (open: boolean) => void;
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

export const usePaintStore = create<PaintState>((set, get) => ({
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
  imageSize: { ...initialSettings.defaultCanvasSize },
  defaultCanvasSize: { ...initialSettings.defaultCanvasSize },
  view: { zoom: 1, panX: 0, panY: 0 },
  cursorPos: null,
  filePath: null,
  theme: initialSettings.theme,
  resizeDialogOpen: false,
  aboutDialogOpen: false,
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
    saveSettings({ theme: t, defaultCanvasSize: get().defaultCanvasSize });
    set({ theme: t });
  },
  setDefaultCanvasSize: (size) => {
    saveSettings({ theme: get().theme, defaultCanvasSize: size });
    set({ defaultCanvasSize: size });
  },
  setFilePath: (p) => set({ filePath: p }),
  setResizeDialogOpen: (open) => set({ resizeDialogOpen: open }),
  setAboutDialogOpen: (open) => set({ aboutDialogOpen: open }),
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
