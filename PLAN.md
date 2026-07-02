# VibePaint — macOS Native App (Tauri) — Build Plan

**VibePaint** — a MS Paint-style raster editor for macOS. The name nods to its vibecoded origins, and it ships under it too. Modern **Windows 11 Paint layout and interactions, rendered in macOS clothing** — familiar skeleton, native skin. HTML `<canvas>` drawing engine, Tauri native shell. Frontend in the stack you know: Vite + React + TypeScript + Tailwind.

Target user: someone who knows current Windows Paint and is now on a Mac. They should recognize it in five seconds (tools where they expect, behaviors they expect) and feel it belongs on macOS (native window, SF Pro, system controls, dark mode) — never that a Windows app is pretending on their Mac.

The guiding principle: **build the small feature set now, but design every subsystem so undo/redo, selection, text, and zoom drop in without rewrites.** Everything below is arranged around that.

---

## Status — current build

Where the app stands today, grouped by state.

### Working

- **Freehand:** pencil, brush, eraser. Left button paints Color 1, right button Color 2; the eraser always paints Color 2 (classic Paint).
- **Shapes:** line, rectangle (outline), ellipse (outline). Live overlay preview; **Shift** constrains to 45° / square / circle; **Esc** cancels mid-drag.
- **Flood fill** (bucket) — scanline fill in a single pass.
- **Eyedropper** — samples the pixel into Color 1 (right-click → Color 2).
- **Undo / redo** — ⌘Z / ⇧⌘Z and toolbar buttons; snapshot history (30 steps); buttons grey out when unavailable.
- **Colors** — MS Paint palette grid, overlapping Color 1 / Color 2 swatches, swap, and the native macOS color panel for custom colors.
- **Size slider** (1–64 px) and **zoom** (status-bar slider + `−`/`+` + %, 0.25×–8×, crisp `pixelated` scaling).
- **Status bar** — live cursor coordinates and image dimensions.
- **Theme** — light / dark following the macOS appearance, switching live.
- **Window & canvas** — native transparent title bar (traffic lights) with a draggable strip and a dirty-dot in the title; pointer capture; right-click context menu suppressed on the canvas.

### Partially working

- **Text** — click to place a single-line input, type, **Enter** commits / **Esc** cancels. Size rides the brush slider. Missing: font/size controls, multi-line, reposition-before-commit, styling.
- **Zoom / navigation** — the slider works, but there's no fit-to-window, no scroll-wheel / pinch zoom, and no dedicated pan (scrollbars only).
- **Shapes** — outline only; no fill mode or stroke-style options yet.
- **Eraser** — erases to Color 2 (opaque); no erase-to-transparent.

### Not built yet

- **Save / Open (PNG)** — dialog + fs permissions are granted on the Rust side, but there's no UI or logic yet, so work can't be persisted.
- **Native menu bar + full shortcuts** — only ⌘Z / ⌘⇧Z are live; the File/Edit/View menus and letter shortcuts (`P B E L R O F I`) aren't wired.
- **New / Clear canvas.**
- **Selection** (marquee, move, cut/copy/paste) and **crop**.
- **Resize / rotate / flip**, and the canvas resize handles shown in the mockup.
- **System clipboard**, **layers**, extra shapes / brush shapes / lasso / airbrush / invert, and JPG/BMP/GIF formats.

---

## 1. Stack & tooling

- **Shell:** Tauri v2 (Rust). Native menus, file dialogs, clipboard, app bundle.
- **Build:** Vite + React 18 + TypeScript.
- **Styling:** Tailwind. macOS-native surfaces (SF Pro / `system-ui`, system control metrics, hairline separators, ~8–10px corners), with full light + dark mode.
- **State:** Zustand for UI/config state only. **Pixel data never lives in React** — it lives in the imperative engine. This is the single most important rule for performance.
- **Tauri plugins:** `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, later `@tauri-apps/plugin-clipboard-manager`.

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
3. **Selection layer** *(reserved for later)* — floating selection contents + marching ants.

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
vibepaint/
├─ src-tauri/
│  ├─ src/main.rs                 # native menu, window, commands
│  ├─ capabilities/default.json   # v2 permissions (dialog, fs)
│  ├─ tauri.conf.json
│  └─ Cargo.toml
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                     # layout shell
│  ├─ components/
│  │  ├─ Toolbar.tsx              # top toolbar: tools · shapes · size · colors
│  │  ├─ ToolButton.tsx
│  │  ├─ ToolOptions.tsx          # size slider, per-tool options
│  │  ├─ ColorPalette.tsx         # palette swatch grid
│  │  ├─ ColorIndicator.tsx       # Color 1 / Color 2 overlapping swatches
│  │  ├─ CanvasStage.tsx          # hosts the 3 canvases + pointer handling
│  │  ├─ StatusBar.tsx            # coords, image size, zoom slider + %
│  │  └─ dialogs/                 # resize, custom color, etc.
│  ├─ engine/
│  │  ├─ CanvasEngine.ts          # base/overlay contexts, compositing
│  │  ├─ History.ts              # undo/redo manager (snapshot-based)
│  │  ├─ coords.ts               # screen↔canvas mapping (zoom/pan/DPR aware)
│  │  ├─ floodFill.ts
│  │  └─ types.ts
│  ├─ tools/
│  │  ├─ Tool.ts                 # the Tool interface (extensibility spine)
│  │  ├─ PencilTool.ts
│  │  ├─ BrushTool.ts
│  │  ├─ EraserTool.ts
│  │  ├─ LineTool.ts
│  │  ├─ RectangleTool.ts
│  │  ├─ EllipseTool.ts
│  │  ├─ FillTool.ts
│  │  ├─ EyedropperTool.ts
│  │  ├─ SelectionTool.ts        # later
│  │  ├─ TextTool.ts             # later
│  │  └─ registry.ts             # id → tool instance
│  ├─ state/store.ts             # zustand
│  ├─ io/
│  │  ├─ fileIO.ts               # open/save via Tauri
│  │  └─ clipboard.ts            # later
│  └─ styles/index.css           # tailwind + theme tokens (light/dark)
├─ index.html
├─ vite.config.ts
└─ tailwind.config.js
```

---

## 4. Core types & interfaces

```ts
// engine/types.ts
export type Point = { x: number; y: number };   // canvas logical pixels
export type MouseButton = 'primary' | 'secondary';
export type ViewTransform = { zoom: number; panX: number; panY: number };

export type ToolId =
  | 'pencil' | 'brush' | 'eraser' | 'line'
  | 'rectangle' | 'ellipse' | 'fill' | 'eyedropper'
  | 'select' | 'text';            // last two: reserved, not built yet
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
  clearPreview(): void;                // wipe the overlay
  commit(label: string): void;         // overlay → base + push history
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
┌─ ● ● ●   VibePaint — untitled.png ──────────────────────────────┐  ← native title bar (traffic lights)
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
- **Top toolbar:** grouped segments split by hairline dividers. Rounded-rect icon buttons (~28–32px), SF Symbols-style glyphs. Hover = subtle fill; active tool = accent-tint fill using the system accent color. Undo/redo sit at the far left with proper disabled (greyed) states — a signature modern-Paint cue.
- **Colors:** Color 1 / Color 2 overlapping swatches + a compact palette grid + a `＋` that opens the native macOS color panel (via `<input type="color">`). Left-click a swatch sets **Color 1**; right-click sets **Color 2** (kept from Paint).
- **Canvas:** centered on a neutral gray work surface with a soft drop shadow and edge/corner resize handles (as in Win11 Paint). `image-rendering: pixelated` for crisp pixels.
- **Status bar:** cursor coordinates, image dimensions, selection size, and a **zoom slider + percentage** at the right — the persistent zoom control is a signature modern-Paint element.
- **Typography & materials:** `system-ui` / SF Pro. Light mode = white/neutral surfaces, hairline separators, rounded corners. **Full dark mode** mirroring the macOS appearance.
- **Cursors:** per-tool — crosshair (pencil/shapes), small square (brush/eraser), eyedropper (picker), bucket (fill). Each tool declares its own `cursor`.
- **Avoid (the "unnaturally Windows" traps):** Segoe UI, fake Windows min/max/close buttons, Fluent acrylic, Windows-style tooltips and context menus.

---

## 7. Feature scope (ranked for this objective)

Ranked by usefulness **for a Windows 11 Paint user landing on macOS** — i.e. what they'll immediately reach for or notice missing. Both columns are 0–10 where **higher is better**: **Useful** = value to that user; **Ease** = how easy to implement (10 = trivial, low = hard).

The objective *raises the v1 bar*: modern Paint always shows undo/redo buttons and a zoom slider, and Mac users expect dark mode. So three things that would be "later" in a classic clone — **undo/redo, zoom, dark mode** — are table stakes here. Budget for them up front even though undo (Ease 4) and zoom (Ease 5) aren't trivial.

### Tier 1 — v1 (the modern-Paint baseline)

| Feature | Useful | Ease | Notes |
|---|:--:|:--:|---|
| Top toolbar + tool selection | 10 | 8 | The structure that says "this is Paint." |
| Pencil | 10 | 8 | Line from last point to current so fast strokes don't gap. |
| Undo / redo | 10 | 4 | Snapshot `History`; wire ⌘Z/⇧⌘Z + toolbar buttons. Table stakes. |
| Save / Open (PNG) | 10 | 6 | Tauri dialog + `toBlob`; Open loads onto canvas. |
| Eraser | 9 | 8 | Paints Color 2 (classic Paint behavior). |
| Brush + size slider | 9 | 7 | Variable-width round stroke. |
| Line | 9 | 7 | Overlay preview, commit on release. |
| Flood fill (bucket) | 9 | 4 | Queue/scanline fill over one `ImageData` pass, with tolerance. |
| Zoom (slider + %) | 9 | 5 | Signature modern element; status bar looks broken without it. Coord-mapping bug magnet. |
| Rectangle | 8 | 7 | Fill/outline modes. |
| Ellipse | 8 | 7 | Same pattern as rectangle. |
| Color palette + Color 1/2 + custom | 8 | 8 | Native color panel for custom. |
| Dark mode | 8 | 7 | Mac expectation; Win11 Paint has it too, so it's on-brand. |
| Eyedropper | 7 | 8 | Read one pixel via `getImageData`. |
| Status bar (coords, dimensions) | 6 | 8 | Cheap, expected. |

### Tier 2 — next (expected soon after)

| Feature | Useful | Ease | Notes |
|---|:--:|:--:|---|
| Rectangular selection → move / cut / copy / paste | 9 | 3 | Prominent "Select"; introduces selection layer + compositing. |
| Text | 8 | 3 | Floating input over the canvas, rasterize on commit. |
| Crop to selection | 7 | 5 | Prominent Crop button in Win11 Paint; depends on selection. |
| Resize / rotate / flip | 7 | 6 | "Resize" dialog + rotate 90/180 + flip H/V. |
| System clipboard (image in/out) | 6 | 4 | clipboard-manager plugin; internal clipboard first. |

### Tier 3 — polish / power

| Feature | Useful | Ease | Notes |
|---|:--:|:--:|---|
| More shapes (rounded rect, polygon, curve) | 5 | 5 | Fills out the shape gallery. |
| Brush shapes (round/square/calligraphy) | 5 | 7 | Vary brush stamp/lineCap. |
| Free-form (lasso) select | 4 | 3 | Arbitrary path as a clip mask. |
| More formats (JPG / BMP / GIF) | 5 | 6 | PNG/JPG native; BMP/GIF need a small lib. |
| Airbrush / spray | 4 | 6 | Random points in a radius on a timer. |
| Invert colors | 4 | 8 | Loop over `ImageData`. |
| Gridlines / rulers | 3 | 7 | Overlay guides at high zoom. |

### Tier 4 — modern extras (evaluate later) / skip

| Feature | Useful | Ease | Notes |
|---|:--:|:--:|---|
| Layers | 6 | 2 | The one modern feature needing a real engine extension (ordered layer array, not just base/overlay). Big scope; defer. |
| Transparency / remove background | 4 | 4 | Bg-color → alpha, or edge detection. |
| Print | 3 | 5 | Webview print; awkward. |
| AI (Cocreator / generative fill) | — | — | Out of scope. |
| Set as desktop background / scan-acquire | 2 | — | Obsolete; skip. |

### The 80/20

All of Tier 1 gives a genuinely usable, unmistakably-Paint app that feels native on macOS. The Tier-1 items that look cheap but aren't — **undo/redo (Ease 4)** and **flood fill (Ease 4)**, plus **zoom (Ease 5)** — are where the real v1 effort goes; design the layer + history architecture around them from day one.

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
- **Flood fill performance** — queue/scanline fill over one `getImageData`/`putImageData` pass; compare against a small color tolerance; never read pixels per-iteration.
- **Preview without commit** — all in-progress shapes live on the overlay and are cleared each `onPointerMove`; the base is only touched on commit. This is what makes shape tools and undo trivial.
- **Right-click** — disable the context menu on the canvas; map secondary button to Color 2.
- **Pointer capture** — use `setPointerCapture` so a drag that leaves the canvas still finishes correctly.
- **Crisp pixels** — `image-rendering: pixelated` on the canvas elements; logical-resolution backing store.

---

## 10. Roadmap / milestones

- **M0 — Scaffold** · *Done.* Tauri + React + TS + Vite, Tailwind v4, macOS transparent-titlebar window, light/dark theme tokens, shell.
- **M1 — Engine + first tool + history** · *Done.* `CanvasEngine` (base/overlay), commit flow, snapshot `History`, pointer plumbing, `coords.ts`, pencil, color model, palette, top toolbar. (Undo works from here.)
- **M2 — Menu + shortcuts** · *To do.* Native macOS menu, New/clear; ⌘Z/⇧⌘Z and toolbar undo/redo already work outside the menu — the letter shortcuts and File/Edit/View menus remain.
- **M3 — Shape & brush tools** · *Done.* Line, rectangle, ellipse (overlay preview); eraser; brush + size slider.
- **M4 — Pixel tools** · *Done.* Flood fill, eyedropper.
- **M5 — File I/O** · *To do.* Open + save/save-as PNG, dirty tracking, window title. (Dialog + fs permissions already granted.)
- **M6 — Zoom** · *Partial.* Zoom slider + coordinate mapping + status bar (coords / dimensions / zoom %) done; fit-to-window, wheel/pinch zoom, and pan remain.
- **M7 — Selection** · *To do.* Rectangular marquee, move, cut/copy/paste (internal clipboard first).
- **M8 — Polish** · *Partial.* Text is a basic single-line editor; crop, resize/rotate/flip, more shapes/formats, and system clipboard remain.

### Keyboard shortcuts (via native menu)

- ⌘N new · ⌘O open · ⌘S save · ⇧⌘S save as
- ⌘Z undo · ⇧⌘Z redo · ⌘X/⌘C/⌘V cut/copy/paste · ⌘A select all
- `B` brush · `P` pencil · `E` eraser · `L` line · `R` rect · `O` ellipse · `F` fill · `I` eyedropper · `Esc` cancel current action

---

## 11. First commands

```bash
npm create tauri-app@latest vibepaint  # choose: React, TypeScript, Vite
cd vibepaint
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
