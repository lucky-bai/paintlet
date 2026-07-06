# VibePaint — macOS Native App (Tauri) — Build Plan

**VibePaint** — a MS Paint-style raster editor for macOS. The name nods to its vibecoded origins, and it ships under it too. Modern **Windows 11 Paint layout and interactions, rendered in macOS clothing** — familiar skeleton, native skin. HTML `<canvas>` drawing engine, Tauri native shell. Frontend in the stack you know: Vite + React + TypeScript + Tailwind.

Target user: someone who knows current Windows Paint and is now on a Mac. They should recognize it in five seconds (tools where they expect, behaviors they expect) and feel it belongs on macOS (native window, SF Pro, system controls, dark mode) — never that a Windows app is pretending on their Mac.

The guiding principle: **build the small feature set now, but design every subsystem so undo/redo, selection, text, and zoom drop in without rewrites.** Everything below is arranged around that.

---

## Status — current build

Where the app stands today, grouped by state.

### Working

- **Freehand:** pencil, brush, eraser. Left button paints Color 1, right button Color 2; the eraser always paints Color 2 (classic Paint). Continuous width slider (1–64 px).
- **Shapes:** line, rectangle (outline), ellipse / circle (outline). Live overlay preview; **Shift** constrains to 45° / square / circle; **Esc** cancels mid-drag.
- **Flood fill** (bucket) — exact-match scanline fill in a single pass.
- **Eyedropper** — samples the pixel into Color 1 (right-click → Color 2).
- **Text** — multi-line editor with font family, size, and bold / italic / underline / strikethrough; typed in Color 1; rasterized on commit and not re-editable afterward.
- **Selection** — rectangular marquee (**Shift** = square) with marching ants; drag to move (leaves a background-color hole); **Delete** clears it; **Select All** (⌘A).
- **Copy / Cut / Paste** — ⌘C / ⌘X / ⌘V through the system clipboard as an image, with an in-app fallback; paste drops in a floating selection ready to drag.
- **Save / Open** — native dialogs, **PNG (default) and JPEG**; window title + dirty-dot track the current file; the close button / ⌘W confirm before discarding unsaved changes.
- **Image ops** — Resize (pixel dimensions, aspect-locked by default, unlock to stretch, smooth vs nearest resampling), Crop to selection, Flip Horizontal / Vertical, Rotate 90°. All undoable across the size change.
- **Native macOS menu bar** — File / Edit / Image / View with real ⌘-shortcuts: New (⌘N), Open (⌘O), Save (⌘S), Save As (⇧⌘S), Undo/Redo, Cut/Copy/Paste, Select All.
- **Undo / redo** — ⌘Z / ⇧⌘Z and toolbar buttons; snapshot history (30 steps) that tracks dimensions so it spans resize/crop; buttons grey out when unavailable.
- **Colors** — MS Paint palette grid, overlapping Color 1 / Color 2 swatches, swap, and the native macOS color panel for continuous / RGB / hex (`#000`) custom colors.
- **Zoom** — shortcuts for in / out / reset (⌘+ / ⌘− / ⌘0), plus a status-bar slider + %, 0.25×–8×, crisp `pixelated` scaling.
- **Tool shortcuts** — `S P B F T E I L R O` select the tools; `Esc` cancels the current action / deselects.
- **Status bar** — live cursor coordinates and image dimensions.
- **Theme** — light / dark following the macOS appearance, switching live.
- **Window & canvas** — native transparent title bar (traffic lights) with a draggable strip and a dirty-dot in the title; pointer capture; right-click context menu suppressed on the canvas.
- **Toolchain** — pnpm; `pnpm dev` launches the full app.

### Not yet matching target scope

- **Aliased shapes & pencil** — shapes and the pencil currently render anti-aliased (canvas path stroking). The bucket fills by exact color match, so an anti-aliased outline leaves a one-pixel unfilled halo when filled. Target: hard-edged (aliased) rasterization for the pencil and every shape so fills reach the border. The brush stays anti-aliased.
- **Discrete shape widths** — shapes share the continuous 1–64 px slider; target is a fixed 1 / 3 / 5 / 8 px selector for shapes, with the continuous slider reserved for pencil / brush.
- **More shapes** — rounded rectangle, polygon, and curve are not built (line, rectangle, ellipse / circle are).
- **Free-form (lasso) selection** — only the rectangular marquee exists.
- **Resize by percentage** — the dialog takes pixel dimensions only; target adds a % mode alongside pixels.

### Out of scope (won't build)

- Layers · transparency / alpha · AI features (Cocreator, generative fill) · stickers · advanced brushes (airbrush, calligraphy, watercolor, …) · shapes beyond the listed set.

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

## 7. Feature scope

The committed feature set. The rendering rule comes first because it shapes several tools.

### Rendering rule — aliased vs anti-aliased

The bucket fills by exact color match, so any anti-aliased edge leaves a one-pixel unfilled halo when filled. Therefore:

- **The pencil and every shape render hard-edged (aliased)** — a shape outline meets a flood fill with no gap. This is classic-Paint rendering, chosen deliberately for fill fidelity.
- **The brush is the anti-aliased counterpart** to the pencil — the same stroke with smooth edges, for freehand work not meant to be flood-filled.

### Tools & features

- **Selection** — rectangular marquee and free-form (lasso).
- **Colors** — MS Paint palette, plus continuous / RGB / hex (`#000`) custom colors via the native macOS color panel. Left-click = Color 1, right-click = Color 2.
- **Shapes** — line, rectangle, circle, rounded rectangle, polygon, curve. Hard-edged. Fixed widths: 1 / 3 / 5 / 8 px (not continuous).
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
- **M6 — Zoom** · *Partial.* Zoom slider, ⌘+/−/0, coordinate mapping, status bar done; fit-to-window, wheel/pinch zoom, and pan remain.
- **M7 — Selection** · *Done.* Rectangular marquee with marching ants; move, delete, select-all, and copy/cut/paste through the system clipboard (internal fallback).
- **M8 — Polish** · *Partial.* Multi-line styled text, crop, resize, flip H/V, and rotate 90° done; more shapes/formats, fit-to-window zoom, and layers remain.

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
