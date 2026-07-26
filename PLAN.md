# Paintlet — macOS Native App (Tauri) — Build Plan

**Paintlet** — a MS Paint-style raster editor for macOS. The name is *paint* plus the diminutive *-let* — a small, light paint app. Modern **Windows 11 Paint layout and interactions, rendered in macOS clothing** — familiar skeleton, native skin. HTML `<canvas>` drawing engine, Tauri native shell. Frontend in the stack you know: Vite + React + TypeScript + Tailwind.

Target user: someone who knows current Windows Paint and is now on a Mac. They should recognize it in five seconds (tools where they expect, behaviors they expect) and feel it belongs on macOS (native window, SF Pro, system controls, dark mode) — never that a Windows app is pretending on their Mac.

The guiding principle: **build the small feature set now, but design every subsystem so undo/redo, selection, text, and zoom drop in without rewrites.** Everything below is arranged around that.

---

## Status — current build

Where the app stands today, grouped by state.

### Working

- **Freehand:** pencil (hard-edged), brush (anti-aliased), eraser (hard-edged, square-capped, so erased edges flood-fill cleanly). Left button paints Color 1, right button Color 2; the eraser always paints Color 2 (classic Paint). Continuous width slider (1–64 px).
- **Shapes:** line, curve, rectangle, rounded rectangle, ellipse / circle, polygon — hard-edged (aliased) outlines, so a flood fill of the interior reaches the border with no halo. Fixed stroke widths — **1 / 3 / 5 / 8 px** buttons (the freehand tools keep their continuous slider). Live overlay preview; **Shift** constrains to 45° / square / circle; **Esc** cancels mid-shape. The curve is click-based — click the two ends to lay the line, then click twice, each click pulling one of the cubic's two control points — with the curve tracking the cursor and previewing between clicks; the polygon is multi-click (drag or click each side; double-click or a click on the first vertex closes it). Shape and freehand previews are coalesced to animation frames, so a fast-moving curve/polygon preview stays smooth.
- **Flood fill** (bucket) — exact-match scanline fill in a single pass. Hard-edged commits seal the whole stroke footprint (not a 50% cutoff) so a thin curved outline stays connected and a fill can't escape through a one-pixel gap — the classic "fill a circle, everything turns one color" leak.
- **Eyedropper** — samples the pixel into Color 1 (right-click → Color 2), then switches to the bucket so the sampled color is ready to fill with. The eyedropper shows the color under the pointer in a small square beside the cursor. Fill and eyedropper carry tool-shaped cursors — a tilted pouring paint bucket and a pipette — whose hotspot is the exact pixel at the tool's tip (not a crosshair).
- **Text** — multi-line editor with an editable font combobox that previews each choice in its own typeface (any installed font can be typed; a broad macOS list is suggested, and the full installed set is offered where the Local Font Access API is available), a size field with large ± steppers (native spinners hidden), and bold / italic / underline / strikethrough; typed in Color 1. The floating box has a grab bar to reposition it before committing, and placing it never scrolls (shifts) the canvas. Rasterized on commit and not re-editable afterward.
- **Selection** — rectangular marquee (**Shift** = square) and free-form lasso, with marching ants along the exact outline; drag inside to move; eight resize grips scale it (**Shift** keeps the aspect ratio); **Delete** clears it; **Select All** (⌘A). Selections are **transparent**: the background color (Color 2) inside a moved or pasted selection drops out, so it never stamps a solid block over what's underneath. Copy/cut/delete on a lasso clip to the outline, not its bounding box. The selection survives switching between the marquee and the lasso.
- **Copy / Cut / Paste** — ⌘C / ⌘X / ⌘V through the system clipboard as an image, with an in-app fallback; paste drops in a floating selection ready to drag.
- **Save / Open** — Opens PNG, JPEG, GIF, WebP, BMP, and HEIC. Save is one step: an already-saved file re-writes in place, and a new document opens the native save panel directly — no extra in-app dialog. The panel carries a **format popup** — PNG / JPEG / Windows BMP, like Paint's "Save as type" — which picks the encoder by rewriting the filename's extension; typing an extension works too. Defaults to PNG, and JPEG encodes at 0.92. WebP and HEIC open but can't be written, so ⌘S on one goes to the save panel instead of overwriting it. Window title + dirty-dot track the current file; the close button / ⌘W confirm before discarding unsaved changes.
- **Image ops** — Resize (by pixels or percentage, aspect-locked by default, unlock to stretch; always resamples smoothly, as Paint does), Crop to selection, Flip Horizontal / Vertical, Rotate 90° right / left / 180°, and edge/corner drag handles on the canvas that crop or extend it (white fill, dashed preview). All undoable across the size change.
- **Native macOS menu bar** — File / Edit / View with real ⌘-shortcuts: New (⌘N), Open (⌘O), Save (⌘S), Save As (⇧⌘S), Undo/Redo, Cut/Copy/Paste, Select All. The image operations live under Edit (no separate Image menu). The system's auto-inserted Edit items are gone: Dictation / Emoji & Symbols via their NSUserDefaults switches at startup, Writing Tools / AutoFill stripped from the installed menu (they have no switch). The app menu is About Paintlet + Quit (Hide / Hide Others / Show All removed); About shows the version, a link to the GitHub repo, and the MIT license line.
- **Undo / redo** — ⌘Z / ⇧⌘Z and toolbar buttons; snapshot history (30 steps) that tracks dimensions so it spans resize/crop; buttons grey out when unavailable.
- **Colors** — MS Paint palette grid, Color 1 / Color 2 swatches, swap, and a full **color chooser** that opens in a popup: a saturation/value rainbow area, a hue slider, the basic palette, and both hex and RGB (0–255) fields. Left-click a palette chip = Color 1, right-click = Color 2.
- **Zoom & pan** — shortcuts for in / out / reset / fit (⌘+ / ⌘− / ⌘0 / ⌘9), a status-bar slider + %, pinch or ⌘-wheel zoom centered on the cursor, and space-drag / middle-drag panning. The wheel step is small and smooth (delta normalized and clamped, not a single huge jump). 0.25×–8×, crisp `pixelated` scaling.
- **Tool shortcuts** — `S W P B F T E I L C R U O G` select the tools; `Esc` cancels the current action / deselects.
- **Status bar** — live cursor coordinates, image dimensions, and the selection's size while one exists.
- **Guardrails** — File → New/Open confirm before discarding unsaved changes; a pending text edit is committed (never dropped) by Save / New / Open / closing the window; undo cancels an in-progress multi-gesture shape. Per-tool cursors: precise crosshairs for fill/eyedropper, a circle for the brush, a square for the eraser, and the resize cursor while dragging a canvas or selection grip.
- **Theme** — light / dark following the macOS appearance, switching live.
- **Window & canvas** — opens maximized; native transparent title bar (traffic lights) with a draggable strip carrying the Paintlet mark and a dirty-dot in the title; pointer capture; right-click context menu suppressed on the canvas.
- **Brand** — the original pixel-art painter's palette with a brush on a light-blue tile, centered and scaled (nearest-neighbour, so the pixelation stays crisp). One artwork everywhere: `public/logo.png` is the favicon and the title-bar mark, and the same art generated the bundle icons via `pnpm tauri icon`.
- **Toolchain** — pnpm; `pnpm dev` launches the full app.

### Not yet matching target scope

- Nothing — the committed feature scope (§6) is fully built.

### Out of scope (won't build)

- Layers · transparency / alpha · AI features (Cocreator, generative fill) · stickers · advanced brushes (airbrush, calligraphy, watercolor, …) · shapes beyond the listed set.

---

## 1. Stack & tooling

- **Shell:** Tauri v2 (Rust). Native menus, file dialogs, clipboard, app bundle.
- **Build:** Vite + React 19 + TypeScript. Two entries — `index.html` (the editor) and `about.html` (the About window's own webview).
- **Styling:** Tailwind. macOS-native surfaces (SF Pro / `system-ui`, system control metrics, hairline separators, ~8–10px corners), with full light + dark mode.
- **State:** Zustand for UI/config state only. **Pixel data never lives in React** — it lives in the imperative engine. This is the single most important rule for performance.
- **Tauri plugins:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-clipboard-manager`, `@tauri-apps/plugin-opener`.
- **Tests:** Vitest for the pure logic; a Playwright-driven headless-browser e2e smoke (`pnpm test:e2e`) that runs the web build and asserts on real pixels; GitHub Actions runs build → unit → e2e on every PR.

### Key decisions (defaults chosen; easy to revisit)

- **Look:** Windows 11 Paint's *layout and interactions* (top toolbar, size slider, color palette, bottom zoom bar) in macOS clothing (native window, SF Pro, system controls, dark mode). Not a pixel-faithful Windows clone, not retro Win9x.
- **Menus:** Native macOS menu bar (via Tauri) for real ⌘-shortcuts and Mac feel — File/Edit/View/Image live in the system menu bar at the top of the screen, not in-window.
- **Canvas resolution:** 1 canvas pixel = 1 image pixel (logical resolution, *not* multiplied by devicePixelRatio). Crispness and zoom come from CSS scaling with `image-rendering: pixelated`. This keeps the pixel model clean — essential for a Paint clone.
- **New document:** 800 × 600, fixed. Not a preference — Paint has none, and File → New followed by Resize covers the rare case.

---

## 2. Architecture overview

### The layer model (drives everything)

Three stacked `<canvas>` elements, same size, absolutely positioned:

1. **Base layer** — the committed image. The source of truth for pixels. Saved to disk.
2. **Overlay layer** — transparent. Live previews (the line you're dragging, the marquee, brush cursor) render here and are cleared constantly. Nothing here is "real" until committed.
3. **Selection layer** — floating selection contents + marching ants (rect or lasso outline).

**Commit flow** — the heartbeat of the whole app:

1. Tool draws a preview on the **overlay** during pointer drag.
2. On pointer up, the tool calls `ctx.commit(label)`.
3. Engine composites overlay → base, clears the overlay, and pushes a history snapshot.

Because *every* action ends as pixels on the base layer, undo, selection, and text all reduce to the same commit + snapshot mechanism. No special cases.

### What owns what

- **`CanvasEngine`** (imperative, plain TS) owns the canvas contexts, compositing, and current image. React talks to it via refs, not state.
- **Zustand store** owns UI and config state only — active tool, the two colors, brush and shape widths, text style, view transform, cursor position, file path, theme, dialog visibility — plus a few values mirrored *out* of the engine (dimensions, dirty, can-undo/redo, selection size) so menus and the status bar can react. Never pixels.
- **React components** are thin: they render chrome (toolbar, palette, status bar) and forward pointer events to the active tool.

```
React (chrome + config)  ──►  Zustand (UI state)
        │                          │
        │ pointer events           │ reads config
        ▼                          ▼
   Active Tool  ──── draws on ──►  CanvasEngine (base + overlay + history)
```

---

## 3. Project structure

```
paintlet/
├─ src-tauri/
│  ├─ src/lib.rs                  # menu setup, image + About-window commands
│  ├─ src/save_panel.rs           # NSSavePanel with a native format popup
│  ├─ src/main.rs                 # thin binary entry → lib::run()
│  ├─ capabilities/default.json   # main-window permissions (dialog, fs, …)
│  ├─ capabilities/about.json     # About window: close + open-URL only
│  ├─ tauri.conf.json
│  └─ Cargo.toml
├─ src/
│  ├─ main.tsx                    # editor entry (index.html)
│  ├─ about.tsx                   # About entry (about.html)
│  ├─ App.tsx                     # layout shell, tool-key shortcuts, close guard
│  ├─ actions.ts                  # shared commands for menu + keyboard
│  ├─ components/
│  │  ├─ Toolbar.tsx              # grouped ribbon: History · Select · Tools ·
│  │  │                           #   Shapes · Size · Colors, each labeled
│  │  ├─ ToolButton.tsx
│  │  ├─ TextOptions.tsx          # font/size/style controls for the text tool
│  │  ├─ ColorControls.tsx        # Color 1/2 swatches, swap, palette grid
│  │  ├─ ColorPicker.tsx          # color chooser: spectrum/palette/hex/RGB
│  │  ├─ Logo.tsx                 # the paintbrush app mark (inline SVG)
│  │  ├─ CanvasStage.tsx          # 3 canvases, pointer plumbing, text editor,
│  │  │                           #   zoom/pan gestures, canvas + selection grips
│  │  ├─ StatusBar.tsx            # coords, image + selection size, zoom slider
│  │  ├─ TitleBar.tsx             # draggable strip under the traffic lights
│  │  ├─ Icon.tsx                 # inline SVG icon set
│  │  ├─ SegmentedControl.tsx     # shared radio-group segments
│  │  ├─ AboutWindow.tsx          # contents of the About window (its own webview)
│  │  └─ dialogs/                 # DialogFrame (draggable chrome) + Resize,
│  │                              #   Settings (Save uses the native panel)
│  ├─ engine/
│  │  ├─ CanvasEngine.ts          # contexts, commit flow, selection, image ops
│  │  ├─ History.ts               # undo/redo manager (snapshot-based)
│  │  ├─ selectionHandles.ts      # resize-grip geometry + cursors
│  │  ├─ coords.ts                # screen↔canvas mapping
│  │  ├─ floodFill.ts             # scanline exact-match fill
│  │  ├─ color.ts                 # hex ↔ rgba, hsv ↔ rgb
│  │  └─ types.ts
│  ├─ tools/
│  │  ├─ Tool.ts                  # the Tool interface (extensibility spine)
│  │  ├─ FreehandTool.ts          # shared pencil/brush/eraser stroke logic
│  │  ├─ PencilTool.ts · BrushTool.ts · EraserTool.ts
│  │  ├─ LineTool.ts · CurveTool.ts
│  │  ├─ RectangleTool.ts · RoundedRectangleTool.ts · EllipseTool.ts
│  │  ├─ PolygonTool.ts
│  │  ├─ FillTool.ts · EyedropperTool.ts
│  │  ├─ SelectTool.ts · LassoTool.ts
│  │  ├─ shapes.ts                # constrain/normalize/pixel-grid helpers
│  │  └─ registry.ts              # id → tool instance
│  ├─ state/
│  │  ├─ store.ts                 # zustand (UI/config state only)
│  │  ├─ settings.ts              # persisted theme (engine-free, shared w/ About)
│  │  ├─ stageHooks.ts            # text-flush + session-cancel escape hatches
│  │  └─ viewport.ts              # work-area element ref for fit/scroll
│  ├─ io/
│  │  ├─ formats.ts               # readable/writable formats + encoder table
│  │  ├─ fileIO.ts                # open/save via Tauri
│  │  └─ clipboard.ts             # system clipboard with in-app fallback
│  ├─ lib/                        # cx, zoom bounds, SVG cursors, palette, theme
│  └─ styles/index.css            # tailwind + theme tokens (light/dark)
├─ tests/e2e.mjs                  # headless-browser smoke test
├─ .github/workflows/ci.yml       # build → unit tests → e2e on every PR
├─ .github/workflows/rust.yml     # fmt + clippy on macOS, when src-tauri/ changes
├─ vitest.config.ts               # unit tests colocated as src/**/*.test.ts
├─ index.html · about.html
└─ vite.config.ts                 # two rollup inputs: main + about
```

---

## 4. Core types & interfaces

```ts
// engine/types.ts
export type Point = { x: number; y: number };   // canvas logical pixels
export type MouseButton = 'primary' | 'secondary';
export type ViewTransform = { zoom: number; panX: number; panY: number };

export type ToolId =
  | 'pencil' | 'brush' | 'eraser'
  | 'line' | 'curve' | 'rectangle' | 'roundedRectangle' | 'ellipse' | 'polygon'
  | 'fill' | 'eyedropper' | 'select' | 'freeSelect' | 'text';
```

The **Tool interface** is the extensibility spine. Every current and future tool implements exactly this — adding a tool means writing one file and registering it.

```ts
// tools/Tool.ts
export interface ToolContext {
  base: CanvasRenderingContext2D;      // committed pixels
  overlay: CanvasRenderingContext2D;   // live preview, cleared per stroke
  engine: CanvasEngine;
  color1: string;                      // foreground (primary button)
  color2: string;                      // background (secondary button)
  size: number;
  zoom: number;                        // for screen-relative hit thresholds
  clearPreview(): void;                // wipe the overlay
  commit(label: string, crisp?: boolean): void; // overlay → base + history;
                                       //   crisp hardens AA edges (pencil/shapes)
  setColor1(c: string): void;          // write-back (eyedropper)
  setColor2(c: string): void;
}

export interface PointerInfo {
  point: Point;         // already mapped to canvas coords
  button: MouseButton;  // which color to paint with
  shiftKey: boolean;    // constrain (straight line / square / circle)
}

export interface Tool {
  id: ToolId;
  cursor: string;                                        // CSS cursor
  onPointerDown(p: PointerInfo, ctx: ToolContext): void;
  onPointerMove(p: PointerInfo, ctx: ToolContext): void;
  onPointerUp(p: PointerInfo, ctx: ToolContext): void;
  onPointerHover?(p: PointerInfo, ctx: ToolContext): void; // moves w/ no button
                                       //   (polygon rubber-band between clicks)
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;                 // cleanup on tool switch
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): void;  // e.g. Esc to cancel
}
```

Why this scales:
- **Pencil/brush/eraser** — draw incrementally on base (or overlay) between last and current point.
- **Line/rect/ellipse** — redraw preview on overlay each move; commit on up.
- **Selection** — same interface, just richer internal state (drag marquee → extract region → drag to move). No engine changes needed.
- **Text** — pointer-down spawns a floating input, commit rasterizes it. Still the same lifecycle.

### History (undo/redo)

Snapshot-based, robust because everything is pixels:

```ts
// engine/History.ts
export class History {
  private stack: ImageData[] = [];
  private index = -1;
  private max = 30;

  push(snapshot: ImageData): void { /* truncate redo tail, push, cap length */ }
  canUndo(): boolean { return this.index > 0; }
  canRedo(): boolean { return this.index < this.stack.length - 1; }
  undo(): ImageData | null { /* move index back, return snapshot */ }
  redo(): ImageData | null { /* move index forward, return snapshot */ }
}
```

- `commit()` pushes a full-canvas `ImageData` after each action; the blank canvas is snapshot #0.
- Undo/redo = `putImageData` of the neighboring snapshot.
- Memory: an 800×600 canvas ≈ 1.9 MB/snapshot; 30 steps ≈ 57 MB. Fine.
- **Evolution path:** for very large canvases, swap the snapshot store for dirty-rectangle diffs or a command/patch log — the `History` interface stays identical, so tools and the commit flow never change.

### Coordinate mapping

```ts
// engine/coords.ts
// DOM pointer event → canvas logical pixel, accounting for
// element rect, zoom, and pan.
export function screenToCanvas(
  e: PointerEvent, canvasEl: HTMLCanvasElement, view: ViewTransform
): Point;
```

All tools receive already-mapped canvas coordinates, so no tool contains zoom or pan arithmetic — this one function is the only place it lives.

---

## 5. How it looks

Windows 11 Paint's layout, wearing macOS. Just window chrome + top toolbar + canvas + status bar — the menus live in the system menu bar, which is the natural Mac arrangement.

```
┌─ ● ● ●   Paintlet — untitled.png ──────────────────────────────┐  ← native title bar (traffic lights)
├──────────────────────────────────────────────────────────────────┤
│ ↩ ↪ │ ✏ 🖌 🪣 A ⌫ 💧 │ ╱ ▭ ○ ⋯ │ Size ▂▃▄▅ │ ■1 ■2  ▪▪▪▪▪▪ ⋯ ＋ │  ← top toolbar (grouped)
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│                     ┌────────────────────┐                         │
│                     │                    │                         │
│                     │   canvas (white)   │○  ← resize handles       │
│                     │                    │                         │
│                     └────────────────────┘                         │
│               (centered on a neutral gray work area)               │
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│  x:128, y:64  ·  800 × 600px              −  ▬▬▬●▬▬  ＋  100%  ⌗   │  ← status bar + zoom slider
└──────────────────────────────────────────────────────────────────┘
```

Toolbar groups, left to right: **undo/redo** · **drawing tools** (pencil, brush, fill, text, eraser, eyedropper) · **shapes** (line, rectangle, ellipse, …) · **size slider** · **colors** (Color 1 / Color 2 + palette grid + `＋` custom).

### Visual details

- **Window:** native macOS title bar with traffic lights. Use a unified/transparent toolbar (hidden-title-bar style) so the toolbar sits directly under the traffic lights — the clean modern Mac look. No fake Windows window controls.
- **Top toolbar:** a grouped ribbon in the Win11 Paint arrangement — **History · Select · Tools · Shapes · Size · Colors** — each a small cluster with a caption underneath, split by hairline dividers. Tools and shapes sit in compact two-row grids rather than one long row. Rounded-rect icon buttons; hover = subtle fill; active tool = accent-tint fill. Undo/redo sit at the far left with proper disabled (greyed) states.
- **Colors:** Color 1 / Color 2 swatches + a two-row palette grid. Clicking a swatch opens the **color chooser** in a popup — a saturation/value spectrum, a hue slider, the palette, and hex + RGB (0–255) fields — entirely inside the app (no separate system color panel). Left-click a palette chip sets **Color 1**; right-click sets **Color 2** (kept from Paint).
- **Canvas:** centered on a neutral gray work surface with a soft drop shadow and edge/corner resize handles (as in Win11 Paint). `image-rendering: pixelated` for crisp pixels.
- **Status bar:** cursor coordinates, image dimensions, selection size, and a **zoom slider + percentage** at the right — the persistent zoom control is a signature modern-Paint element.
- **Typography & materials:** `system-ui` / SF Pro. Light mode = white/neutral surfaces, hairline separators, rounded corners. **Full dark mode** mirroring the macOS appearance.
- **Cursors:** per-tool — a precise crosshair whose hotspot is the exact target pixel for fill and eyedropper, a small circle (brush), a small square (eraser), and the appropriate resize cursor while dragging a canvas or selection grip. Glyph cursors are inline-SVG data URIs (pixel size = viewBox so the hotspot is exact) with a white underlay so they read on any pixels.
- **Avoid (the "unnaturally Windows" traps):** Segoe UI, fake Windows min/max/close buttons, Fluent acrylic, Windows-style tooltips and context menus.

---

## 6. Feature scope

The committed feature set. The rendering rule comes first because it shapes several tools.

### Rendering rule — aliased vs anti-aliased

The bucket fills by exact color match, so any anti-aliased edge leaves a one-pixel unfilled halo when filled. Therefore:

- **The pencil and every shape render hard-edged (aliased)** — a shape outline meets a flood fill with no gap. This is classic-Paint rendering, chosen deliberately for fill fidelity.
- **The brush is the anti-aliased counterpart** to the pencil — the same stroke with smooth edges, for freehand work not meant to be flood-filled.

### Tools & features

- **Selection** — rectangular marquee and free-form (lasso).
- **Colors** — MS Paint palette, plus an in-app color chooser popup (saturation/value spectrum, hue slider, palette, hex, and RGB 0–255). Left-click = Color 1, right-click = Color 2.
- **Shapes** — line, rectangle, circle, rounded rectangle, polygon, curve, stroked through the canvas at four fixed widths (1 / 3 / 5 / 8 px).
- **Pencil** — hard-edged freehand with a continuous width slider.
- **Brush** — anti-aliased freehand (the pencil's smooth counterpart).
- **Eraser · Eyedropper · Fill (bucket)** — standard Paint behavior; left / right paints Color 1 / Color 2.
- **Text** — choose font, size, and bold / italic / underline / strikethrough; text rasterizes on commit and is not re-editable after placing.
- **Open** — PNG, JPEG, GIF, WebP, BMP, HEIC. **Save** — PNG (default), JPEG, or BMP.
- **Image operations** — flip horizontal / vertical, rotate 90°, resize by percentage or pixels (aspect locked by default, unlock to stretch), crop to selection.
- **Zoom** — keyboard shortcuts for in / out / reset.
- **Keyboard shortcuts** — save, new, copy, paste (plus undo / redo, select-all, and single-key tool switching).

### Explicitly out of scope

Layers · transparency / alpha · AI features (Cocreator, generative fill) · stickers · advanced brushes (airbrush, calligraphy, watercolor, …) · shapes beyond the set above.

---

## 7. File I/O (Tauri v2)

The **native dialog** picks the path (`plugin-dialog`), but the **bytes move through our own Rust commands** — `read_image_file` and `write_image_file` in `src-tauri/src/lib.rs`. That indirection is the point: `plugin-fs` is scope-restricted, so reading and writing arbitrary user-chosen paths through it would mean either a permissive scope or a failure on every folder we didn't anticipate. A custom command is already trusted, so the user's choice in the file panel is the only authorization needed.

- **Open** — `read_image_file` → `createImageBitmap` → `engine.loadBitmap()`, which resizes the canvas, draws, and seeds history in one step.
- **Save** — `canvas.toBlob()` → `write_image_file`. One step: an already-saved file re-writes in place; a new document goes straight to the save panel, whose **format popup** (PNG / JPEG / Windows BMP) chooses the encoder.

### Why the save panel is hand-built

The format popup is the reason `src-tauri/src/save_panel.rs` exists rather than a call to `tauri-plugin-dialog`'s `save()`. That plugin goes through `rfd`, whose macOS backend flattens every filter into a single `setAllowedFileTypes` array and **discards the filter names**, so no format control ever appears — the user's only way to reach JPEG or BMP was to type the extension, which macOS then hid.

NSSavePanel can show the control itself via `showsContentTypes` (macOS 14+) fed by `allowedContentTypes`, so there's no accessory view and no custom target/action class. AppKit owns the popup, derives each menu item's label and extension from the UTI, rewrites the filename's extension as the selection changes, and runs its own overwrite confirmation against the final name.

That last part is what keeps the design simple: because the popup works *by writing the extension*, the extension stays the single source of truth for which encoder runs, and `encodingFor(path)` needs no notion of a separately-selected format. `SAVE_FORMATS` in `io/formats.ts` pairs each UTI with the `ENCODERS` entry it resolves to, and a test asserts the pairing, so a format can't be offered in the popup without something able to write it.

Two fallbacks, because a missing popup shouldn't block a save:

- On macOS 13 and earlier the selector doesn't exist. The panel probes with `respondsToSelector:` and reports `supported: false` rather than crashing — distinct from a cancel, so the frontend can tell them apart.
- Any error from the command drops through to the plugin dialog (no popup, extension-typing only).

The command is deliberately **synchronous**: AppKit panels are main-thread-only and `runModal` spins its own event loop, so the work hops to the main thread and the command blocks on a channel. Tauri runs sync commands on a worker thread, so blocking there holds up nothing the panel needs.

### Which formats, and why they differ by direction

Rust moves raw bytes, so the codec set is entirely WebKit's — and it is **asymmetric**, which is the whole reason `io/formats.ts` exists as its own module. Verified by round-tripping a canvas in WKWebView on macOS 26:

| | PNG | JPEG | GIF | BMP | TIFF | WebP | HEIC | AVIF |
|---|---|---|---|---|---|---|---|---|
| Decode (`createImageBitmap`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Encode (`canvas.toBlob`) | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |

Two consequences worth knowing before touching this code:

- **Decoding is wider than the web-standard set** because WebKit sits on ImageIO — BMP and HEIC come free, needing nothing but an entry in the Open filter. (TIFF also decodes; it's left out as clutter.)
- **`toBlob` fails silently.** Asked for a type it can't produce — WebP above all — it returns **PNG bytes with no error**. So an extension may only appear in the `ENCODERS` table if WebKit genuinely writes that format; otherwise Paintlet would write one format's bytes under another's name, which corrupts a file rather than saving it. `formats.test.ts` pins this invariant: every extension must map to its own mime type, and the unwritable formats must stay out of the table.

Because WebP and HEIC open but can't be written, ⌘S on one can't re-write in place — it falls through to the save panel, defaulting to the same basename as PNG. GIF *is* writable and stays out of the panel's popup only because it quantizes to 256 colors; a file that was already a GIF re-saves as one.

**v2 gotcha:** plugin and core commands are opt-in per window via `src-tauri/capabilities/*.json` and fail silently if ungranted. Custom `#[tauri::command]` functions are *not* gated this way — they're reachable from any webview in the app, which is why the About window gets its own narrowly-scoped capability rather than sharing the main one.

---

## 8. Tricky bits & how we handle them

- **Gaps in fast strokes** — pointer events are sparse; always draw a *line* from the last point to the current one, never isolated dots.
- **Flood fill** — scanline fill over one `getImageData`/`putImageData` pass; never read pixels per-iteration. The match is exact (zero tolerance), which is precisely why the pencil and shapes must render hard-edged: an anti-aliased border would leave a one-pixel unfilled halo. The brush is anti-aliased and isn't meant to be filled against.
- **Preview without commit** — all in-progress shapes live on the overlay and are cleared each `onPointerMove`; the base is only touched on commit. This is what makes shape tools and undo trivial.
- **Right-click** — disable the context menu on the canvas; map secondary button to Color 2.
- **Pointer capture** — use `setPointerCapture` so a drag that leaves the canvas still finishes correctly.
- **Crisp pixels** — `image-rendering: pixelated` on the canvas elements; logical-resolution backing store.

---

## 9. Keyboard shortcuts (via native menu)

- ⌘, settings · ⌘N new · ⌘O open · ⌘S save · ⇧⌘S save as
- ⌘Z undo · ⇧⌘Z redo · ⌘X/⌘C/⌘V cut/copy/paste · ⌘A select all
- ⌘+ / ⌘− / ⌘0 zoom in / out / actual size · ⌘9 fit to window
- `S` select · `W` free-form select · `P` pencil · `B` brush · `E` eraser · `L` line · `C` curve · `R` rect · `U` rounded rect · `O` ellipse · `G` polygon · `F` fill · `T` text · `I` eyedropper · `Esc` cancel current action

---

## 10. Known deviations & accepted trade-offs

Places where Paintlet knowingly departs from a Windows or macOS convention, or where a rough edge is understood and left alone. Each carries two 0–10 ratings: **Severity** — how much it hurts a user (0 = cosmetic, 10 = blocking) — and **Confidence** — how sure this is a real issue worth changing (0 = a hunch, 10 = certain). Recording the reason keeps each one an explicit decision rather than an oversight.

| Area | Finding | Sev | Conf | Why it's left alone |
|---|---|---|---|---|
| View menu | Zoom In/Out/Actual/Fit show no shortcut, so ⌘+/−/0/9 are invisible in the one place users look for them. | 5 | 8 | The clean fix — native menu accelerators — risks double-firing with the in-app ⌘-zoom keydown handler and can't be verified headlessly. Wants a real-app pass before changing. |
| Edit menu | Fourteen flat items (clipboard + selection + all image ops) is a lot to scan. | 3 | 5 | The user explicitly asked for the image operations to live *in* Edit; nesting them under an "Image" submenu risks re-introducing exactly what was removed. |
| Selection | Transparent selection is always on; classic Paint defaults to *opaque* and makes transparency a toggle. | 3 | 5 | Matches the explicit request ("treat the background as transparent when moving"). A toggle is more faithful but adds a control; revisit if opaque moves are wanted. |
| Selection | A free-form (lasso) selection can't be resized — grips appear only on the rectangular Select tool. | 3 | 5 | Deliberate: the lasso moves, and you switch to Select to scale. Documented rather than adding lasso-bbox grips. |
| Zoom | ⌘0 = actual size and ⌘9 = fit; most image editors map ⌘0 to fit. | 2 | 4 | Defensible (Preview-like), non-conflicting, and changing it would surprise users who've learned it. |
| Color picker | The hex field silently ignores invalid input with no feedback. | 2 | 5 | Low impact; a validation cue is a nice-to-have, not a correctness issue. |
| Canvas | The edge/corner resize handles are 10 px — a small hit target. | 3 | 5 | Enlarging the grab area without making the dots visually heavier needs a little care; low frequency of use. |
| Eyedropper | What tool to land on after a pick. | 2 | 6 | Switches to the bucket, so the sampled color is ready to fill with in one step. |

### Not observable headlessly

The native-shell items — maximized window, the Edit-menu merge, the Dictation/Emoji suppression, on-disk save, trackpad-pinch zoom, the About window (its own OS window, with the minimize/zoom buttons hidden via AppKit), and the save panel's format popup — depend on the Tauri shell and can't be exercised in the headless web build, so they aren't asserted by the e2e suite. They're implemented and wired; confirm with one pass in `pnpm dev`.

The Rust shell is checked by a **second workflow** (`.github/workflows/rust.yml`) rather than by `ci.yml`, for two reasons: it must run on macOS, since nearly everything in `src-tauri/` that can break sits behind `#[cfg(target_os = "macos")]` and a Linux runner would compile straight past it; and it only needs to run when the shell changes, so it carries a `paths` filter. It runs `cargo fmt --check` and `cargo clippy -- -D warnings` (clippy type-checks as it lints, so a separate `cargo check` would be redundant), and needs no frontend build — `tauri-build` tolerates a missing `../dist` outside a real bundle.

Because of that filter it doesn't run on frontend-only PRs, so it shouldn't be made a *required* check without switching to a always-runs job that skips internally.

---

## 11. Release readiness

### In place

- **Bundle metadata** (`src-tauri/tauri.conf.json`): product name `Paintlet`, identifier `io.efficientnlp.paintlet`, version, category (Graphics & Design), publisher, homepage, MIT license + `LICENSE` file, copyright, short/long descriptions, minimum macOS 10.15, targets `app` + `dmg`.
- **Icons**: full set regenerated from the pixel-art palette mark (`pnpm tauri icon`); the same artwork is the favicon (`public/logo.png`) and the in-window mark (`Logo.tsx`).
- **About**: Paintlet → About Paintlet shows version, GitHub link, and license.
- **Menu hygiene**: Dictation / Emoji & Symbols suppressed via NSUserDefaults at startup (the documented AppKit switches; note these are *not* Info.plist keys — an Info.plist approach does nothing). Writing Tools / AutoFill have no such switch and are stripped from the Edit menu after install (`strip_edit_menu_system_items`).
- **Build**: `pnpm tauri build` produces `src-tauri/target/release/bundle/macos/Paintlet.app` and a `.dmg` beside it in `bundle/dmg/`.

### Signing & distribution

Unsigned builds trigger Gatekeeper's "unidentified developer" block on other Macs (right-click → Open works, but it's hostile for users). The full runbook — one-time signing setup, the per-release steps, verification, and troubleshooting — is in [`docs/RELEASING.md`](./docs/RELEASING.md), and the build → sign → notarize → staple → publish pipeline is automated by [`scripts/release.sh`](./scripts/release.sh) (`scripts/release.sh`, or `PUBLISH=1 scripts/release.sh` to cut a GitHub release).

The setup it assumes: an Apple Developer Program membership, a **Developer ID Application** certificate imported into the login keychain, a `paintlet-notary` credentials profile stored via `notarytool`, and the two universal Rust targets. The script auto-detects the signing identity, builds universal (Intel + Apple Silicon), and notarizes the DMG.

### Deferred hardening

- **CSP** is `null`. The app loads only local content, so exposure is limited, but a strict production CSP (`default-src 'self'` + blob/data allowances for canvas image I/O) is worth adding once it can be verified in the real shell — the e2e suite runs in a plain browser and wouldn't catch a CSP that breaks open/save.
- **Auto-updates** (`tauri-plugin-updater`) need an updater keypair and a hosted latest.json; skip until there's a reason to ship updates outside GitHub Releases.
