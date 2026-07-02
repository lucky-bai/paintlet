# VibePaint

A MS Paint-style raster editor for macOS. It borrows **Windows 11 Paint's layout and interactions** and renders them in **macOS clothing** — native transparent title bar, SF Pro, system controls, and full dark mode. A Windows Paint user should recognize it in five seconds and still feel it belongs on their Mac.

Built with an HTML `<canvas>` drawing engine inside a Tauri native shell. The name nods to its vibecoded origins.

## Features

**Working**

- Freehand tools: **pencil**, **brush**, **eraser** (left button = Color 1, right = Color 2).
- Shapes: **line**, **rectangle**, **ellipse** with live preview; **Shift** constrains to 45° / square / circle, **Esc** cancels mid-drag.
- **Flood fill** (bucket) and **eyedropper** (color picker).
- **Undo / redo** (⌘Z / ⇧⌘Z) backed by a snapshot history.
- Color palette with Color 1 / Color 2 swatches and the native macOS color panel; size slider.
- **Zoom** (0.25×–8×) with crisp `pixelated` scaling, and a status bar with live cursor coordinates and image dimensions.
- **Light / dark** theme following the macOS appearance.

**Partial**

- **Text** — single-line click-to-place editor; no font/size controls or multi-line yet.
- **Zoom / navigation** — slider only; no fit-to-window, wheel/pinch zoom, or dedicated pan.
- Shapes are outline-only; the eraser paints an opaque background color.

**Planned**

- Save / Open (PNG), a native menu bar with the full shortcut set, and New / Clear.
- Selection (marquee, move, cut/copy/paste), crop, resize / rotate / flip.
- System clipboard, layers, and more shapes / formats.

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
3. **Selection** — reserved for later.

Every action previews on the overlay, then on pointer-up composites into the base and pushes a history snapshot. Because everything ends as pixels, undo, selection, and text all reduce to the same commit mechanism. Tools implement one shared `Tool` interface, so adding a tool is a single file.

```
src/
├─ engine/      # CanvasEngine, History, coords, floodFill, color
├─ tools/       # Tool interface + one file per tool + registry
├─ components/  # Toolbar, CanvasStage, ColorControls, StatusBar, …
├─ state/       # Zustand store
└─ styles/      # Tailwind entry + theme tokens
src-tauri/      # Rust shell, capabilities, config
```

## License

[MIT](./LICENSE) © 2026 Bai Li
