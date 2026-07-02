import { create } from "zustand";
import { CanvasEngine } from "../engine/CanvasEngine";
import type { Point, Theme, ToolId, ViewTransform } from "../engine/types";

// One engine instance for the app's lifetime. Deliberately OUTSIDE the reactive
// store: pixel data must never live in React state or it would re-render on
// every stroke. Components import `engine` directly for imperative calls.
export const engine = new CanvasEngine();

interface PaintState {
  // — config / UI state (reactive) —
  activeToolId: ToolId;
  color1: string; // foreground (primary button)
  color2: string; // background (secondary button)
  brushSize: number;
  imageSize: { w: number; h: number };
  view: ViewTransform; // zoom/pan
  cursorPos: Point | null; // for the status bar
  filePath: string | null;
  theme: Theme;

  // — mirrored from the engine (for menu/button enablement + title dot) —
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // — actions —
  setTool: (id: ToolId) => void;
  setColor1: (c: string) => void;
  setColor2: (c: string) => void;
  swapColors: () => void;
  setBrushSize: (n: number) => void;
  setImageSize: (w: number, h: number) => void;
  setZoom: (z: number) => void;
  setCursorPos: (p: Point | null) => void;
  setTheme: (t: Theme) => void;
  setFilePath: (p: string | null) => void;
  setEngineState: (s: {
    canUndo: boolean;
    canRedo: boolean;
    isDirty: boolean;
  }) => void;
}

export const usePaintStore = create<PaintState>((set) => ({
  activeToolId: "pencil",
  color1: "#000000",
  color2: "#ffffff",
  brushSize: 4,
  imageSize: { w: 800, h: 600 },
  view: { zoom: 1, panX: 0, panY: 0 },
  cursorPos: null,
  filePath: null,
  theme: "system",

  isDirty: false,
  canUndo: false,
  canRedo: false,

  setTool: (id) => set({ activeToolId: id }),
  setColor1: (c) => set({ color1: c }),
  setColor2: (c) => set({ color2: c }),
  swapColors: () => set((s) => ({ color1: s.color2, color2: s.color1 })),
  setBrushSize: (n) => set({ brushSize: n }),
  setImageSize: (w, h) => set({ imageSize: { w, h } }),
  setZoom: (z) => set((s) => ({ view: { ...s.view, zoom: z } })),
  setCursorPos: (p) => set({ cursorPos: p }),
  setTheme: (t) => set({ theme: t }),
  setFilePath: (p) => set({ filePath: p }),
  setEngineState: (s) =>
    set({ canUndo: s.canUndo, canRedo: s.canRedo, isDirty: s.isDirty }),
}));

// Bridge engine → store so undo/redo/dirty stay mirrored into the UI. The engine
// pushes an EngineChange on every commit/undo/redo; we fan it into React here.
engine.setOnChange((c) => usePaintStore.getState().setEngineState(c));
