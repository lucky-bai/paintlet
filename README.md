# VibePaint

A MS Paint-style raster editor for macOS. It borrows **Windows 11 Paint's layout and interactions** and renders them in **macOS clothing** — native transparent title bar, SF Pro, system controls, and full dark mode. A Windows Paint user should recognize it in five seconds and still feel it belongs on their Mac.

Built with an HTML `<canvas>` drawing engine inside a Tauri native shell. The name nods to its vibecoded origins.

## Features

- Freehand tools: **pencil** (hard-edged), **brush** (anti-aliased), **eraser** (hard, square) — left button paints Color 1, right button Color 2, continuous width slider.
- Shapes: **line, curve, rectangle, rounded rectangle, ellipse, polygon** at any width via a slider. Straight strokes (line, polygon) use an aliased round-brush rasterizer, so the weight is uniform at every angle — horizontal, vertical, and diagonal all read the same thickness, with no fill leak. **Shift** constrains to 45°/square/circle, **Esc** cancels. The curve takes Paint's three gestures — drag the line, then pull two bends — with the curve tracking the cursor and previewing between gestures; the polygon is multi-click with a rubber-band preview. Previews are animation-frame-coalesced, so they stay smooth.
- **Flood fill** (bucket) and **eyedropper** — the pencil and shapes render hard-edged and seal their whole footprint, so a fill reaches the border and can't leak through a one-pixel gap in a thin curve. Fill and eyedropper carry tool-shaped cursors — a tilted pouring bucket and a pipette — with the hotspot at the tool's tip; the eyedropper also shows the color under the pointer in a square beside it, and returns to the previous tool after picking.
- **Text** — multi-line editor with an editable font combobox (any installed font, with a broad macOS list suggested), a size field with large ± steppers, and bold/italic/underline/strikethrough. The floating box has a grab bar to reposition it before committing, and placing it never shifts the canvas. Rasterized on commit; pending text is committed (never dropped) by Save/New/Open/close.
- **Selection** — rectangular marquee and **free-form lasso** with marching ants along the exact outline; drag to move, **eight grips to resize** (Shift keeps the aspect ratio), **Delete** clears, ⌘A selects all, and the selection survives switching between the two select tools. Selections are **transparent** — the background color drops out when moving or pasting, so a selection never stamps a solid block over what's underneath.
- **Copy / Cut / Paste** (⌘C/⌘X/⌘V) through the system clipboard; paste drops in a floating selection and grows the canvas if needed.
- **Save / Open** — Save is one step: the native save panel's file-type popup picks **PNG or JPEG** (the format follows the chosen extension), and an already-saved file re-writes in place; the title bar tracks the file and unsaved changes, and New/Open/close confirm before discarding them.
- **Image ops** — resize by pixels or percent (aspect-lock, smooth/nearest resampling), crop to selection, flip H/V, rotate 90° right/left/180°, plus **drag handles on the canvas edge** to crop or extend it — all undoable.
- **Zoom & pan** — 0.25×–8× with crisp `pixelated` scaling: ⌘+/⌘−/⌘0, **⌘9 fit to window**, pinch or ⌘-wheel zoom (smooth, normalized steps) centered on the cursor, space-drag or middle-drag panning, and a status-bar slider.
- **Undo / redo** (⌘Z/⇧⌘Z) backed by a dimension-aware snapshot history that spans resizes and crops.
- **Native macOS menu bar** (File/Edit/View, with the image operations under Edit; the app menu trimmed to Quit) with ⌘-shortcuts and single-key tool shortcuts, a Win11-style grouped ribbon with a compact shapes grid, a width slider, an in-app color chooser popup (spectrum, palette, hex, RGB 0–255), the MS Paint palette, and a status bar with live coordinates, image and selection size, and per-tool hints.
- **Light / dark** theme following the macOS appearance; the window opens maximized; a paintbrush logo in the title bar and app icons.

Out of scope by design: layers, transparency/alpha, AI features, stickers, and advanced brushes. See [`PLAN.md`](./PLAN.md) for the full design, architecture, and roadmap.

## Tech stack

- **Shell:** Tauri v2 (Rust) — native window, menus, file dialogs, app bundle.
- **Frontend:** Vite + React 19 + TypeScript.
- **Styling:** Tailwind v4 (CSS-first) with light/dark theme tokens.
- **State:** Zustand for UI/config; pixel data lives in an imperative canvas engine, never in React.

## Getting started

**Prerequisites:** Node 18+, pnpm, the Rust toolchain, and Xcode Command Line Tools.

```bash
pnpm install
pnpm dev            # run the desktop app in development
pnpm tauri build    # produce a macOS app bundle
pnpm dev:web        # frontend only, in a browser (native menus/dialogs disabled)
```

## Tests

```bash
pnpm test           # Vitest unit tests (pure logic: fill, history, geometry)
pnpm test:e2e       # headless-browser smoke test: boots the web build and
                    # drives it with real pointer/keyboard input, asserting
                    # by reading pixels back off the canvases
```

CI (GitHub Actions) runs build → unit tests → e2e on every pull request.

## Architecture in brief

Three stacked canvases drive everything:

1. **Base** — the committed image, the source of truth, saved to disk.
2. **Overlay** — transparent; live previews render here and clear constantly.
3. **Selection** — the marching-ants marquee (rect or lasso outline) and any floating (moved/pasted) pixels, composited into the base on commit.

Every action previews on the overlay, then on pointer-up composites into the base and pushes a history snapshot. Because everything ends as pixels, undo, selection, and text all reduce to the same commit mechanism. Tools implement one shared `Tool` interface, so adding a tool is a single file.

```
src/
├─ engine/      # CanvasEngine, History, coords, floodFill, color
├─ tools/       # Tool interface + one file per tool + registry
├─ components/  # Toolbar, CanvasStage, ColorControls, StatusBar, dialogs, …
├─ io/          # file open/save + system clipboard
├─ menu/        # native macOS menu bar
├─ state/       # Zustand store + stage hooks + viewport ref
├─ lib/         # zoom bounds, SVG cursors, cx
├─ actions.ts   # shared commands for the menu + keyboard
└─ styles/      # Tailwind entry + theme tokens
tests/          # headless-browser e2e smoke (unit tests live in src/**/*.test.ts)
src-tauri/      # Rust shell (file I/O commands), capabilities, config
```

## License

[MIT](./LICENSE) © 2026 Bai Li
