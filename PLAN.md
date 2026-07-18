# Paintlet — macOS Native App (Tauri) — Build Plan

**Paintlet** — a MS Paint-style raster editor for macOS. The name is *paint* plus the diminutive *-let* — a small, light paint app. Modern **Windows 11 Paint layout and interactions, rendered in macOS clothing** — familiar skeleton, native skin. HTML `<canvas>` drawing engine, Tauri native shell. Frontend in the stack you know: Vite + React + TypeScript + Tailwind.

Target user: someone who knows current Windows Paint and is now on a Mac. They should recognize it in five seconds (tools where they expect, behaviors they expect) and feel it belongs on macOS (native window, SF Pro, system controls, dark mode) — never that a Windows app is pretending on their Mac.

The guiding principle: **build the small feature set now, but design every subsystem so undo/redo, selection, text, and zoom drop in without rewrites.** Everything below is arranged around that.

---

## Status — current build

Where the app stands today, grouped by state.

### Working

- **Freehand:** pencil (hard-edged), brush (anti-aliased), eraser (hard-edged, square-capped, so erased edges flood-fill cleanly). Left button paints Color 1, right button Color 2; the eraser always paints Color 2 (classic Paint). Continuous width slider (1–64 px).
- **Shapes:** line, curve, rectangle, rounded rectangle, ellipse / circle, polygon — hard-edged (aliased) outlines, so a flood fill of the interior reaches the border with no halo. Fixed stroke widths — **1 / 3 / 5 / 8 px** buttons (the freehand tools keep their continuous slider). Live overlay preview; **Shift** constrains to 45° / square / circle; **Esc** cancels mid-shape. The curve is Paint's three gestures (drag the line, then pull two bends) with the curve passing *through* the point you drag and previewing under the cursor between gestures; the polygon is multi-click (drag or click each side; double-click or a click on the first vertex closes it). Shape and freehand previews are coalesced to animation frames, so a fast-moving curve/polygon preview stays smooth.
- **Flood fill** (bucket) — exact-match scanline fill in a single pass. Hard-edged commits seal the whole stroke footprint (not a 50% cutoff) so a thin curved outline stays connected and a fill can't escape through a one-pixel gap — the classic "fill a circle, everything turns one color" leak.
- **Eyedropper** — samples the pixel into Color 1 (right-click → Color 2), then returns to the previous tool (classic Paint). The eyedropper shows the color under the pointer in a small square beside the cursor. Fill and eyedropper carry tool-shaped cursors — a tilted pouring paint bucket and a pipette — whose hotspot is the exact pixel at the tool's tip (not a crosshair).
- **Text** — multi-line editor with an editable font combobox (any installed font can be typed; a broad macOS list is suggested, and the full installed set is offered where the Local Font Access API is available), a size field with large ± steppers, and bold / italic / underline / strikethrough; typed in Color 1. The floating box has a grab bar to reposition it before committing, and placing it never scrolls (shifts) the canvas. Rasterized on commit and not re-editable afterward.
- **Selection** — rectangular marquee (**Shift** = square) and free-form lasso, with marching ants along the exact outline; drag inside to move; eight resize grips scale it (**Shift** keeps the aspect ratio); **Delete** clears it; **Select All** (⌘A). Selections are **transparent**: the background color (Color 2) inside a moved or pasted selection drops out, so it never stamps a solid block over what's underneath. Copy/cut/delete on a lasso clip to the outline, not its bounding box. The selection survives switching between the marquee and the lasso.
- **Copy / Cut / Paste** — ⌘C / ⌘X / ⌘V through the system clipboard as an image, with an in-app fallback; paste drops in a floating selection ready to drag.
- **Save / Open** — Save is one step: an already-saved file re-writes in place, and a new document opens the native save panel directly, whose file-type popup (PNG or JPEG) chooses the format — no extra in-app dialog. The format follows the chosen extension (default PNG); JPEG encodes at 0.92. Window title + dirty-dot track the current file; the close button / ⌘W confirm before discarding unsaved changes.
- **Image ops** — Resize (by pixels or percentage, aspect-locked by default, unlock to stretch, smooth vs nearest resampling), Crop to selection, Flip Horizontal / Vertical, Rotate 90° right / left / 180°, and edge/corner drag handles on the canvas that crop or extend it (white fill, dashed preview). All undoable across the size change.
- **Native macOS menu bar** — File / Edit / View with real ⌘-shortcuts: New (⌘N), Open (⌘O), Save (⌘S), Save As (⇧⌘S), Undo/Redo, Cut/Copy/Paste, Select All. The image operations live under Edit (no separate Image menu). The system's auto-inserted Edit items are gone: Dictation / Emoji & Symbols via their NSUserDefaults switches at startup, Writing Tools / AutoFill stripped from the installed menu (they have no switch). The app menu is About Paintlet + Quit (Hide / Hide Others / Show All removed); About shows the version, a link to the GitHub repo, and the MIT license line.
- **Undo / redo** — ⌘Z / ⇧⌘Z and toolbar buttons; snapshot history (30 steps) that tracks dimensions so it spans resize/crop; buttons grey out when unavailable.
- **Colors** — MS Paint palette grid, Color 1 / Color 2 swatches, swap, and a full **color chooser** that opens in a popup: a saturation/value rainbow area, a hue slider, the basic palette, and both hex and RGB (0–255) fields. Left-click a palette chip = Color 1, right-click = Color 2.
- **Zoom & pan** — shortcuts for in / out / reset / fit (⌘+ / ⌘− / ⌘0 / ⌘9), a status-bar slider + %, pinch or ⌘-wheel zoom centered on the cursor, and space-drag / middle-drag panning. The wheel step is small and smooth (delta normalized and clamped, not a single huge jump). 0.25×–8×, crisp `pixelated` scaling.
- **Tool shortcuts** — `S W P B F T E I L C R U O G` select the tools; `Esc` cancels the current action / deselects.
- **Status bar** — live cursor coordinates, image dimensions, and the selection's size while one exists.
- **Guardrails** — File → New/Open confirm before discarding unsaved changes; a pending text edit is committed (never dropped) by Save / New / Open / closing the window; undo cancels an in-progress multi-gesture shape. Per-tool cursors: precise crosshairs for fill/eyedropper, a circle for the brush, a square for the eraser, and the resize cursor while dragging a canvas or selection grip.
- **Theme** — light / dark following the macOS appearance, switching live.
- **Window & canvas** — opens maximized; native transparent title bar (traffic lights) with a draggable strip carrying the Paintlet mark and a dirty-dot in the title; pointer capture; right-click context menu suppressed on the canvas.
- **Brand** — a pixel-art painter's palette with a brush on a light-blue rounded tile. One artwork everywhere: `public/logo.svg` is the favicon and the title-bar mark, and the same composition (rendered at 1024px) generated the bundle icons via `pnpm tauri icon`.
- **Toolchain** — pnpm; `pnpm dev` launches the full app.

### Not yet matching target scope

- Nothing — the committed feature scope (§7) is fully built.

### Out of scope (won't build)

- Layers · transparency / alpha · AI features (Cocreator, generative fill) · stickers · advanced brushes (airbrush, calligraphy, watercolor, …) · shapes beyond the listed set.

---

## 1. Stack & tooling

- **Shell:** Tauri v2 (Rust). Native menus, file dialogs, clipboard, app bundle.
- **Build:** Vite + React 18 + TypeScript.
- **Styling:** Tailwind. macOS-native surfaces (SF Pro / `system-ui`, system control metrics, hairline separators, ~8–10px corners), with full light + dark mode.
- **State:** Zustand for UI/config state only. **Pixel data never lives in React** — it lives in the imperative engine. This is the single most important rule for performance.
- **Tauri plugins:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-clipboard-manager`.
- **Tests:** Vitest for the pure logic; a Playwright-driven headless-browser e2e smoke (`pnpm test:e2e`) that runs the web build and asserts on real pixels; GitHub Actions runs build → unit → e2e on every PR.

### Key decisions (defaults chosen; easy to revisit)

- **Look:** Windows 11 Paint's *layout and interactions* (top toolbar, size slider, color palette, bottom zoom bar) in macOS clothing (native window, SF Pro, system controls, dark mode). Not a pixel-faithful Windows clone, not retro Win9x.
- **Menus:** Native macOS menu bar (via Tauri) for real ⌘-shortcuts and Mac feel — File/Edit/View/Image live in the system menu bar at the top of the screen, not in-window.
- **Canvas resolution:** 1 canvas pixel = 1 image pixel (logical resolution, *not* multiplied by devicePixelRatio). Crispness and zoom come from CSS scaling with `image-rendering: pixelated`. This keeps the pixel model clean — essential for a Paint clone.

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
- **Zustand store** owns only: active tool id, color1/color2, brush size, image dimensions, view transform (zoom/pan), cursor position, dirty flag, file path, theme.
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
│  ├─ src/main.rs                 # window setup, read/write-image commands
│  ├─ capabilities/default.json   # v2 permissions (dialog, fs)
│  ├─ tauri.conf.json
│  └─ Cargo.toml
├─ src/
│  ├─ main.tsx
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
│  │  └─ dialogs/                 # ResizeDialog, AboutDialog (Save uses the native panel)
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
│  │  ├─ stageHooks.ts            # text-flush + session-cancel escape hatches
│  │  └─ viewport.ts              # work-area element ref for fit/scroll
│  ├─ io/
│  │  ├─ fileIO.ts                # open/save via Tauri
│  │  └─ clipboard.ts             # system clipboard with in-app fallback
│  ├─ lib/                        # cx, zoom bounds, SVG cursors, palette
│  └─ styles/index.css            # tailwind + theme tokens (light/dark)
├─ tests/e2e.mjs                  # headless-browser smoke test
├─ .github/workflows/ci.yml       # build → unit tests → e2e on every PR
├─ vitest.config.ts               # unit tests colocated as src/**/*.test.ts
├─ index.html
└─ vite.config.ts
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

### History (undo/redo) — designed in now, cheap to enable

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
- **Evolution path:** for very large canvases, swap the snapshot store for dirty-rectangle diffs or a command/patch log — the `History` interface stays identical, so tools and the commit flow never change. This is why we can ship a simple version and upgrade silently.

### Coordinate mapping — built from day one

```ts
// engine/coords.ts
// DOM pointer event → canvas logical pixel, accounting for
// element rect, zoom, and pan. For MVP zoom=1/pan=0, but the
// function exists so zoom slots in later without touching any tool.
export function screenToCanvas(
  e: PointerEvent, canvasEl: HTMLCanvasElement, view: ViewTransform
): Point;
```

All tools receive already-mapped canvas coordinates. When zoom/pan arrive, only this function changes.

---

## 5. State store shape

```ts
// state/store.ts  (zustand)
interface PaintState {
  activeToolId: ToolId;
  color1: string;                 // foreground
  color2: string;                 // background
  brushSize: number;
  imageSize: { w: number; h: number };
  view: ViewTransform;            // zoom/pan
  cursorPos: Point | null;        // for status bar
  isDirty: boolean;
  filePath: string | null;
  theme: 'system' | 'light' | 'dark';
  canUndo: boolean;               // mirrored from History for menu enablement
  canRedo: boolean;

  setTool(id: ToolId): void;
  setColor1(c: string): void;
  setColor2(c: string): void;
  setBrushSize(n: number): void;
  setImageSize(w: number, h: number): void;
  setZoom(z: number): void;
  setTheme(t: PaintState['theme']): void;
  // ... etc.
}
```

Pixel data is deliberately absent — it stays in `CanvasEngine`.

---

## 6. How it looks

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

## 7. Feature scope

The committed feature set. The rendering rule comes first because it shapes several tools.

### Rendering rule — aliased vs anti-aliased

The bucket fills by exact color match, so any anti-aliased edge leaves a one-pixel unfilled halo when filled. Therefore:

- **The pencil and every shape render hard-edged (aliased)** — a shape outline meets a flood fill with no gap. This is classic-Paint rendering, chosen deliberately for fill fidelity.
- **The brush is the anti-aliased counterpart** to the pencil — the same stroke with smooth edges, for freehand work not meant to be flood-filled.

### Tools & features

- **Selection** — rectangular marquee and free-form (lasso).
- **Colors** — MS Paint palette, plus an in-app color chooser popup (saturation/value spectrum, hue slider, palette, hex, and RGB 0–255). Left-click = Color 1, right-click = Color 2.
- **Shapes** — line, rectangle, circle, rounded rectangle, polygon, curve. Hard-edged; straight strokes use aliased round-brush rasterization for uniform weight at any angle. Continuous width slider.
- **Pencil** — hard-edged freehand with a continuous width slider.
- **Brush** — anti-aliased freehand (the pencil's smooth counterpart).
- **Eraser · Eyedropper · Fill (bucket)** — standard Paint behavior; left / right paints Color 1 / Color 2.
- **Text** — choose font, size, and bold / italic / underline / strikethrough; text rasterizes on commit and is not re-editable after placing.
- **Save** — PNG (default) or JPEG.
- **Image operations** — flip horizontal / vertical, rotate 90°, resize by percentage or pixels (aspect locked by default, unlock to stretch), crop to selection.
- **Zoom** — keyboard shortcuts for in / out / reset.
- **Keyboard shortcuts** — save, new, copy, paste (plus undo / redo, select-all, and single-key tool switching).

### Explicitly out of scope

Layers · transparency / alpha · AI features (Cocreator, generative fill) · stickers · advanced brushes (airbrush, calligraphy, watercolor, …) · shapes beyond the set above.

---

## 8. File I/O (Tauri v2)

**Save:**
```ts
const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'));
const bytes = new Uint8Array(await blob.arrayBuffer());
const path = filePath ?? await save({ filters: [{ name: 'PNG', extensions: ['png'] }] });
await writeFile(path, bytes);            // @tauri-apps/plugin-fs
```

**Open:**
```ts
const path = await open({ filters: [{ name: 'Images', extensions: ['png','jpg','bmp','gif'] }] });
const bytes = await readFile(path);
const img = await createImageBitmap(new Blob([bytes]));
engine.resizeCanvas(img.width, img.height);
engine.base.drawImage(img, 0, 0);
engine.snapshot('open');                 // seed history
```

**v2 gotcha:** permissions are opt-in via `src-tauri/capabilities/default.json` — grant `dialog:default`, `fs:allow-write-file`, `fs:allow-read-file` (scoped appropriately), or the calls silently fail.

---

## 9. Tricky bits & how we handle them

- **Gaps in fast strokes** — pointer events are sparse; always draw a *line* from the last point to the current one, never isolated dots.
- **Flood fill** — scanline fill over one `getImageData`/`putImageData` pass; never read pixels per-iteration. The match is exact (zero tolerance), which is precisely why the pencil and shapes must render hard-edged: an anti-aliased border would leave a one-pixel unfilled halo. The brush is anti-aliased and isn't meant to be filled against.
- **Preview without commit** — all in-progress shapes live on the overlay and are cleared each `onPointerMove`; the base is only touched on commit. This is what makes shape tools and undo trivial.
- **Right-click** — disable the context menu on the canvas; map secondary button to Color 2.
- **Pointer capture** — use `setPointerCapture` so a drag that leaves the canvas still finishes correctly.
- **Crisp pixels** — `image-rendering: pixelated` on the canvas elements; logical-resolution backing store.

---

## 10. Roadmap / milestones

- **M0 — Scaffold** · *Done.* Tauri + React + TS + Vite, Tailwind v4, macOS transparent-titlebar window, light/dark theme tokens, shell.
- **M1 — Engine + first tool + history** · *Done.* `CanvasEngine` (base/overlay), commit flow, snapshot `History`, pointer plumbing, `coords.ts`, pencil, color model, palette, top toolbar. (Undo works from here.)
- **M2 — Menu + shortcuts** · *Done.* Native macOS menu bar (File/Edit/Image/View) with ⌘-accelerators, New; single-key tool shortcuts and Esc-cancel via a keydown handler.
- **M3 — Shape & brush tools** · *Done.* Line, rectangle, ellipse (overlay preview); eraser; brush + size slider.
- **M4 — Pixel tools** · *Done.* Flood fill, eyedropper.
- **M5 — File I/O** · *Done.* Open + save/save-as PNG **and JPEG**, dirty tracking, window title. Bytes move through a Rust command so any user-chosen path works.
- **M6 — Zoom** · *Done.* Zoom slider, ⌘+/−/0, fit-to-window (⌘9), pinch / ⌘-wheel zoom at the cursor, space- or middle-drag pan, coordinate mapping, status bar.
- **M7 — Selection** · *Done.* Rectangular marquee and free-form lasso with marching ants; move, delete, select-all, and copy/cut/paste through the system clipboard (internal fallback).
- **M8 — Polish** · *Done.* Multi-line styled text, crop, resize, flip H/V, rotate 90° right/left/180°, polygon and curve shapes, fit-to-window zoom, canvas drag-resize handles, per-tool cursors, data-loss guards. (Layers stay out of scope.)
- **M9 — Tests & CI** · *Done.* Vitest unit suite over the pure logic; a headless-browser e2e smoke driving real pointer/keyboard input and asserting on pixels; GitHub Actions runs build → unit → e2e on every PR.
- **M10 — Paint-fidelity & UX pass** · *Done.* Flood fill made leak-tight through thin curves; precise crosshair cursors for fill/eyedropper; smooth wheel zoom; canvas + selection resize grips (Shift keeps aspect); transparent selection (background drops out on move/paste); in-app color picker replacing the system panel; Win11-style grouped ribbon with a compact shapes grid; pull-through curve with live preview; Save-format dialog; image operations folded into the Edit menu with the system Dictation/Emoji items suppressed; window opens maximized.
- **M11 — UX audit & discoverability** · *Done.* Full audit of Windows/macOS expectations and implementation clarity (§12). Fixed: per-tool usage hints in the status bar (the multi-gesture curve, multi-click polygon, and selection tools are no longer a guessing game); size-aware brush/eraser cursors that show real coverage; a `move` cursor inside a selection body (and a fix for the hover cursor lingering after the selection or tool changed); clearer active-tool state (filled + ring, consistent with the size picker) and keyboard focus rings; and color-affordance tooltips (which slot a palette click fills, left vs right).
- **M12 — Fidelity & chrome pass** · *Done.* Uniform line/polygon weight at every angle via an aliased round-brush rasterizer (`engine/raster.ts`, Bresenham + disc stamp) — no heavier diagonals, still fill-tight. Tool-shaped fill/eyedropper cursors with tip hotspots, plus a live sampled-color square beside the eyedropper. Text: the floating box drags to reposition before commit, placing it no longer scrolls the canvas (`focus({ preventScroll })`), the font field is an editable combobox over all system fonts, and the size field has large ± steppers. Save is one step (native panel's file-type popup picks the format; the extra in-app dialog is gone). Shape widths are a slider, not 1/3/5/8 buttons. The color chooser is a popup with spectrum + palette + hex + RGB (0–255). Curve/polygon previews are rAF-coalesced (no lag). App menu trimmed to Quit. New paintbrush logo in the title bar and bundle icons.

### Keyboard shortcuts (via native menu)

- ⌘N new · ⌘O open · ⌘S save · ⇧⌘S save as
- ⌘Z undo · ⇧⌘Z redo · ⌘X/⌘C/⌘V cut/copy/paste · ⌘A select all
- ⌘+ / ⌘− / ⌘0 zoom in / out / actual size · ⌘9 fit to window
- `S` select · `W` free-form select · `P` pencil · `B` brush · `E` eraser · `L` line · `C` curve · `R` rect · `U` rounded rect · `O` ellipse · `G` polygon · `F` fill · `T` text · `I` eyedropper · `Esc` cancel current action

---

## 11. First commands

```bash
npm create tauri-app@latest paintlet  # choose: React, TypeScript, Vite
cd paintlet
npm install
npm install zustand
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
# Tailwind v4 — Vite plugin, no init/postcss step
npm install tailwindcss @tailwindcss/vite
#   → add tailwindcss() to plugins in vite.config.ts
#   → add `@import "tailwindcss";` at the top of src/styles/index.css
npm run tauri dev
```

> Scaffold gives React 19 + Tailwind v4 (CSS-first config; no `tailwind.config.js` unless you want one). Default new-canvas size: **800 × 600**. Freehand strokes (pencil/brush) **accumulate on the overlay and commit once on pointer-up** — one stroke = one undo step, base untouched mid-stroke.

---

## 12. UX audit

A pass over the whole app for anything confusing, off-convention for a Windows or macOS user, not best practice, or where the implementation itself reads as unclear. Each finding carries two 0–10 ratings: **Severity** — how much it hurts a user (0 = cosmetic, 10 = blocking) — and **Confidence** — how sure this is a real issue worth changing (0 = a hunch, 10 = certain). Findings above the confidence bar were fixed in this pass; the rest are recorded with the reason they were left, so the decision is explicit rather than forgotten.

### Fixed

| Area | Finding | Sev | Conf | Fix |
|---|---|---|---|---|
| Curve / polygon / select / text | The multi-gesture curve, multi-click polygon, and move/resize selection interactions are genuinely unguessable — even Windows Paint's curve confuses people, and there was no on-screen cue. | 5 | 8 | A concise usage hint per tool in the status bar (e.g. curve → "Drag to draw a line, then drag twice to bend it · Esc cancels"). |
| Brush / eraser cursor | A fixed small dot regardless of the size slider — a 48 px brush showed a tiny cursor, lying about coverage. | 4 | 7 | The brush (round) and eraser (square) cursors now match the painted size on screen (size × zoom), clamped to a grabbable, browser-supported range. |
| Selection | Hovering inside a selection gave no hint that a press would move it (cursor stayed a crosshair). | 4 | 7 | A `move` cursor over the selection body; resize grips still telegraph on the rectangular Select tool. |
| Selection (bug) | The hover cursor (grip / `move`) lingered after the selection was cleared or the tool changed, until the pointer next moved over the canvas. | 3 | 9 | Cleared reactively on tool change and when the selection goes away. |
| Toolbar | The active tool used a faint 15%-tint that read weakly (especially in dark mode) and was inconsistent with the shape-size buttons, which fill with the accent. | 4 | 6 | Clearer active state — accent fill plus an inset ring — consistent across tool and size buttons. |
| Accessibility | No visible keyboard-focus indicator on the icon buttons. | 4 | 8 | `:focus-visible` rings on the tool buttons (invisible to pointer users). |
| Colors | Left-click = Color 1 / right-click = Color 2 on the palette is the older Paint model and undiscoverable on a Mac; nothing said which slot a click fills. | 4 | 7 | Tooltips spell it out on the palette chips and the two swatches (foreground / background, click to edit). |

### Documented — deferred

| Area | Finding | Sev | Conf | Why deferred |
|---|---|---|---|---|
| View menu | Zoom In/Out/Actual/Fit show no shortcut, so ⌘+/−/0/9 are invisible in the one place users look for them. | 5 | 8 | The clean fix — native menu accelerators — risks double-firing with the in-app ⌘-zoom keydown handler and can't be verified headlessly. Wants a real-app pass before changing. |
| Edit menu | Fourteen flat items (clipboard + selection + all image ops) is a lot to scan. | 3 | 5 | The user explicitly asked for the image operations to live *in* Edit; nesting them under an "Image" submenu risks re-introducing exactly what was removed. |
| Selection | Transparent selection is always on; classic Paint defaults to *opaque* and makes transparency a toggle. | 3 | 5 | Matches the explicit request ("treat the background as transparent when moving"). A toggle is more faithful but adds a control; revisit if opaque moves are wanted. |
| Selection | A free-form (lasso) selection can't be resized — grips appear only on the rectangular Select tool. | 3 | 5 | Deliberate: the lasso moves, and you switch to Select to scale. Documented rather than adding lasso-bbox grips. |
| Save | ⌘S on an untitled document opens an in-app format dialog before the native save panel — two steps, and not the macOS norm of going straight to a save sheet. | 2 | 5 | Intentional per the "don't leave the user guessing the file format" request; the format dropdown is the point. |
| Zoom | ⌘0 = actual size and ⌘9 = fit; most image editors map ⌘0 to fit. | 2 | 4 | Defensible (Preview-like), non-conflicting, and changing it would surprise users who've learned it. |
| Color picker | The hex field silently ignores invalid input with no feedback. | 2 | 5 | Low impact; a validation cue is a nice-to-have, not a correctness issue. |
| Canvas | The edge/corner resize handles are 10 px — a small hit target. | 3 | 5 | Enlarging the grab area without making the dots visually heavier needs a little care; low frequency of use. |
| Eyedropper | Auto-reverting to the previous tool after a pick surprises non-Paint users. | 2 | 6 | Classic Paint behavior, kept on purpose. |
| Theme | No in-app light/dark override — it always follows the system. | 2 | 4 | Correct macOS behavior; an override is optional, not expected. |

### Not observable headlessly

The native-shell items — maximized window, the Edit-menu merge, the Dictation/Emoji suppression, on-disk save, and trackpad-pinch zoom — depend on the Tauri shell and can't be exercised in the headless web build, so they aren't asserted by the e2e suite. They're implemented and wired; confirm with one pass in `pnpm dev`.

## 13. Release readiness

### In place

- **Bundle metadata** (`src-tauri/tauri.conf.json`): product name `Paintlet`, identifier `io.efficientnlp.paintlet`, version, category (Graphics & Design), publisher, homepage, MIT license + `LICENSE` file, copyright, short/long descriptions, minimum macOS 10.15, targets `app` + `dmg`.
- **Icons**: full set regenerated from the pixel-art palette mark (`pnpm tauri icon`); the same artwork is the favicon (`public/logo.svg`) and the in-window mark (`Logo.tsx`).
- **About**: Paintlet → About Paintlet shows version, GitHub link, and license.
- **Menu hygiene**: Dictation / Emoji & Symbols suppressed via NSUserDefaults at startup (the documented AppKit switches; note these are *not* Info.plist keys — an Info.plist approach does nothing). Writing Tools / AutoFill have no such switch and are stripped from the Edit menu after install (`strip_edit_menu_system_items`).
- **Build**: `pnpm tauri build` produces `src-tauri/target/release/bundle/macos/Paintlet.app` and a `.dmg` beside it in `bundle/dmg/`.

### Needs Bai — signing & distribution

Unsigned builds trigger Gatekeeper's "unidentified developer" block on other Macs (right-click → Open works, but it's hostile for users). To distribute properly:

1. **Apple Developer Program** ($99/yr) — enroll at developer.apple.com with an Apple ID.
2. **Developer ID Application certificate** — create in Xcode (Settings → Accounts → Manage Certificates) or at developer.apple.com/account/resources/certificates. Install it in the login keychain.
3. **Code signing** — set `APPLE_SIGNING_IDENTITY="Developer ID Application: <name> (<team id>)"` in the environment when running `pnpm tauri build`; Tauri signs the bundle automatically. (CI instead wants `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` — a base64 `.p12` export.)
4. **Notarization** — also set `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password from appleid.apple.com), and `APPLE_TEAM_ID`; Tauri submits the DMG to Apple's notary service after signing. Without notarization, macOS 15+ shows a scarier block than the classic Gatekeeper one.
5. **GitHub release CI (optional)** — `tauri-apps/tauri-action` builds and attaches the DMG on tag push; add the five values above as repo secrets.

### Deferred hardening

- **CSP** is `null`. The app loads only local content, so exposure is limited, but a strict production CSP (`default-src 'self'` + blob/data allowances for canvas image I/O) is worth adding once it can be verified in the real shell — the e2e suite runs in a plain browser and wouldn't catch a CSP that breaks open/save.
- **Auto-updates** (`tauri-plugin-updater`) need an updater keypair and a hosted latest.json; skip until there's a reason to ship updates outside GitHub Releases.
