# VibePaint

A MS Paint-style raster editor for macOS. It borrows **Windows 11 Paint's layout and interactions** and renders them in **macOS clothing** — native transparent title bar, SF Pro, system controls, and full dark mode. A Windows Paint user should recognize it in five seconds and still feel it belongs on their Mac.

Built with an HTML `<canvas>` drawing engine inside a Tauri native shell. The name nods to its vibecoded origins.

## Features

**Working**

- Freehand tools: **pencil**, **brush**, **eraser** (left button = Color 1, right = Color 2).
- Shapes: **line**, **rectangle**, **ellipse** with live preview; **Shift** constrains to 45° / square / circle, **Esc** cancels mid-drag.
- **Flood fill** (bucket) and **eyedropper** (color picker).
- **Text** — multi-line editor with font family, size, and bold / italic.
- **Selection** — rectangular marquee with marching ants; drag to move, **Delete** to clear, **Select All** (⌘A).
- **Copy / Cut / Paste** (⌘C / ⌘X / ⌘V) through the system clipboard; paste drops in a floating selection.
- **Save / Open** as **PNG or JPEG** via native dialogs; the title bar tracks the file and unsaved changes.
- **Image**: Resize (aspect-lock + resampling), Crop to selection, Flip H/V, Rotate 90° — all undoable.
- **Native macOS menu bar** (File / Edit / Image / View) with ⌘-shortcuts, plus single-key tool shortcuts.
- **Undo / redo** (⌘Z / ⇧⌘Z) backed by a dimension-aware snapshot history.
- Color palette with Color 1 / Color 2 swatches and the native macOS color panel; size slider.
- **Zoom** (0.25×–8×, ⌘+ / ⌘− / ⌘0) with crisp `pixelated` scaling, and a status bar with live cursor coordinates and image dimensions.
- **Light / dark** theme following the macOS appearance.

**Partial**

- **Text** — one style per box, committed on the next action; no reposition-by-drag or alignment.
- **Zoom / navigation** — slider + shortcuts; no fit-to-window, wheel/pinch zoom, or dedicated pan.
- Shapes are outline-only; the eraser paints an opaque background color.

**Planned**

- Free-form (lasso) selection and on-canvas resize handles.
- Fit-to-window, wheel/pinch zoom, and pan.
- Layers, more shapes / brush shapes / airbrush / invert, and BMP / GIF formats.

See [`PLAN.md`](./PLAN.md) for the full design, architecture, and roadmap.

## Tech stack

- **Shell:** Tauri v2 (Rust) — native window, menus, file dialogs, app bundle.
- **Frontend:** Vite + React 19 + TypeScript.
- **Styling:** Tailwind v4 (CSS-first) with light/dark theme tokens.
- **State:** Zustand for UI/config; pixel data lives in an imperative canvas engine, never in React.

## Getting started

**Prerequisites:** Node 18+, the Rust toolchain, and Xcode Command Line Tools.

```bash
npm install
npm run tauri dev      # run the desktop app in development
npm run tauri build    # produce a macOS app bundle
```

## Architecture in brief

Three stacked canvases drive everything:

1. **Base** — the committed image, the source of truth, saved to disk.
2. **Overlay** — transparent; live previews render here and clear constantly.
3. **Selection** — the marching-ants marquee and any floating (moved/pasted) pixels, composited into the base on commit.

Every action previews on the overlay, then on pointer-up composites into the base and pushes a history snapshot. Because everything ends as pixels, undo, selection, and text all reduce to the same commit mechanism. Tools implement one shared `Tool` interface, so adding a tool is a single file.

```
src/
├─ engine/      # CanvasEngine, History, coords, floodFill, color
├─ tools/       # Tool interface + one file per tool + registry
├─ components/  # Toolbar, CanvasStage, ColorControls, StatusBar, dialogs, …
├─ io/          # file open/save + system clipboard
├─ menu/        # native macOS menu bar
├─ state/       # Zustand store
├─ actions.ts   # shared commands for the menu + keyboard
└─ styles/      # Tailwind entry + theme tokens
src-tauri/      # Rust shell (file I/O commands), capabilities, config
```

## License

[MIT](./LICENSE) © 2026 Bai Li
