import { History } from "./History";
import type { Point, Rect } from "./types";

// Snapshot of engine state that the UI mirrors (menu/button enablement, title
// dirty dot, status-bar dimensions). The engine pushes these; React never
// reaches into the engine for pixel data.
export type EngineChange = {
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
  width: number;
  height: number;
  hasSelection: boolean;
};

// The imperative core. Owns the three stacked <canvas> contexts, the commit
// flow, history, and the selection model. Pixel data lives HERE and only here —
// never in React/Zustand. This is the single most important performance
// boundary in the app.
export class CanvasEngine {
  // Non-null asserted: set in attach() before any drawing can happen.
  base!: CanvasRenderingContext2D; // committed pixels (source of truth)
  overlay!: CanvasRenderingContext2D; // live preview, cleared per stroke
  sel!: CanvasRenderingContext2D; // selection marquee + floating content

  private baseCanvas!: HTMLCanvasElement;
  private overlayCanvas!: HTMLCanvasElement;
  private selectionCanvas!: HTMLCanvasElement;
  private history = new History(30);
  private dirty = false;
  private onChange?: (c: EngineChange) => void;

  width = 800;
  height = 600;

  // — selection state —
  // The committed marquee rect (logical image px), or null when nothing is
  // selected. When content is floating, this rect tracks the floating bounds.
  selection: Rect | null = null;
  // Free-form (lasso) outline, stored RELATIVE to the selection rect's origin
  // so a float drag translates it for free. Null → the selection is the plain
  // rectangle. While the lasso is still being dragged the outline is open;
  // finalizing closes it back to the start.
  private selPoly: Point[] | null = null;
  private selPolyClosed = false;
  // Lifted/pasted pixels that hover above the base until committed. Drawn on the
  // selection layer at (floatX, floatY); folded into the base on commit.
  private floatCanvas: HTMLCanvasElement | null = null;
  private floatX = 0;
  private floatY = 0;
  // True when the float was lifted from the base (a move left a hole that must
  // be kept on delete); false for a pasted float (additive, no hole).
  private floatLifted = false;

  // Bind the engine to the three stacked canvas elements the CanvasStage mounts.
  // Called once on mount; programmatic resizes go through the size-changing
  // methods below rather than re-attaching (which would wipe pixels).
  attach(
    base: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    selection: HTMLCanvasElement,
    width: number,
    height: number,
  ): void {
    this.baseCanvas = base;
    this.overlayCanvas = overlay;
    this.selectionCanvas = selection;

    const b = base.getContext("2d", { willReadFrequently: true });
    const o = overlay.getContext("2d");
    const s = selection.getContext("2d");
    if (!b || !o || !s) throw new Error("Could not acquire 2D canvas context");
    this.base = b;
    this.overlay = o;
    this.sel = s;

    this.applySize(width, height);
    this.fillBase("#ffffff");
    this.setSelection(null);
    this.discardFloat();
    this.history.reset();
    this.history.push(this.readBase());
    this.dirty = false;
    this.emit();
  }

  // The store wires this up to mirror engine state into React.
  setOnChange(cb: (c: EngineChange) => void): void {
    this.onChange = cb;
  }

  private emit(): void {
    this.onChange?.({
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      isDirty: this.dirty,
      width: this.width,
      height: this.height,
      hasSelection: this.selection != null || this.floatCanvas != null,
    });
  }

  private readBase(): ImageData {
    return this.base.getImageData(0, 0, this.width, this.height);
  }

  // Resize the backing store of all three layers to a new logical size. NOTE:
  // setting canvas.width/height clears the canvas and resets context state, so
  // callers must (re)draw content afterward. Crispness/zoom come from CSS, so
  // the backing store is always logical image pixels.
  private applySize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const c of [
      this.baseCanvas,
      this.overlayCanvas,
      this.selectionCanvas,
    ]) {
      c.width = width;
      c.height = height;
    }
    this.base.imageSmoothingEnabled = false;
    this.overlay.imageSmoothingEnabled = false;
    this.sel.imageSmoothingEnabled = false;
  }

  fillBase(color: string): void {
    this.base.save();
    this.base.fillStyle = color;
    this.base.fillRect(0, 0, this.width, this.height);
    this.base.restore();
  }

  clearOverlay(): void {
    this.overlay.clearRect(0, 0, this.width, this.height);
  }

  clearSelectionLayer(): void {
    this.sel.clearRect(0, 0, this.width, this.height);
  }

  // The heartbeat: fold the overlay preview into the base, clear it, snapshot.
  // Every freehand/shape/text action ends here. When `crisp` is set, the
  // overlay's anti-aliased edges are hardened first (see hardenOverlayAlpha) so
  // the result flood-fills cleanly — the pencil and every shape pass crisp.
  commit(_label: string, crisp = false): void {
    if (crisp) this.hardenOverlayAlpha();
    this.base.drawImage(this.overlayCanvas, 0, 0);
    this.clearOverlay();
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
  }

  // Snap the overlay's alpha channel to 0 or 255 at a 50%-coverage cutoff,
  // turning anti-aliased edges into hard ones. The overlay holds a single
  // stroke color over transparency, so its RGB is already the stroke color
  // wherever it was drawn — only the coverage (alpha) needs hardening. This is
  // what lets the exact-match bucket reach a shape's border with no 1px halo.
  private hardenOverlayAlpha(cutoff = 128): void {
    const img = this.overlay.getImageData(0, 0, this.width, this.height);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= cutoff ? 255 : 0;
    this.overlay.putImageData(img, 0, 0);
  }

  // Record the current base as a history step without an overlay composite
  // (flood fill and other direct base mutations).
  snapshot(_label: string): void {
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
  }

  // Clear the dirty flag after a successful save (title dot / close prompt).
  markSaved(): void {
    this.dirty = false;
    this.emit();
  }

  undo(): void {
    const snap = this.history.undo();
    if (snap) this.applySnapshot(snap);
  }

  redo(): void {
    const snap = this.history.redo();
    if (snap) this.applySnapshot(snap);
  }

  // Restore a history snapshot. Because snapshots carry their own dimensions,
  // undo/redo can cross a resize/crop: resize the canvas to match, then paint.
  private applySnapshot(snap: ImageData): void {
    this.discardFloat();
    this.setSelection(null);
    if (snap.width !== this.width || snap.height !== this.height) {
      this.applySize(snap.width, snap.height);
    }
    this.base.putImageData(snap, 0, 0);
    this.clearOverlay();
    this.clearSelectionLayer();
    this.dirty = true;
    this.emit();
  }

  // Read a single base pixel (eyedropper, fill seed). Coords are floored.
  getPixel(p: Point): [number, number, number, number] {
    const d = this.base.getImageData(
      Math.max(0, Math.min(this.width - 1, Math.floor(p.x))),
      Math.max(0, Math.min(this.height - 1, Math.floor(p.y))),
      1,
      1,
    ).data;
    return [d[0], d[1], d[2], d[3]];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Document-level operations (New / Open / Resize / Crop / Flip / Rotate)
  // ─────────────────────────────────────────────────────────────────────────

  // Fresh white document at the given size. Resets history and clears dirty.
  newDocument(width: number, height: number): void {
    this.discardFloat();
    this.setSelection(null);
    this.applySize(width, height);
    this.fillBase("#ffffff");
    this.clearOverlay();
    this.clearSelectionLayer();
    this.history.reset();
    this.history.push(this.readBase());
    this.dirty = false;
    this.emit();
  }

  // Replace the whole document with a decoded image (File → Open). Resets
  // history to that image and marks the document clean.
  loadBitmap(bitmap: ImageBitmap | HTMLImageElement): void {
    const w = bitmap.width;
    const h = bitmap.height;
    this.discardFloat();
    this.setSelection(null);
    this.applySize(w, h);
    // A transparent PNG dropped onto a white paper reads as white, matching
    // Paint (which has no transparent canvas). Fill white, then draw.
    this.fillBase("#ffffff");
    this.base.drawImage(bitmap, 0, 0);
    this.clearOverlay();
    this.clearSelectionLayer();
    this.history.reset();
    this.history.push(this.readBase());
    this.dirty = false;
    this.emit();
  }

  // Scale the whole image to a new size (Image → Resize). `smooth` picks
  // bilinear resampling (photos) vs nearest-neighbor (pixel art).
  resizeImage(width: number, height: number, smooth = true): void {
    this.stampFloatOnly();
    const src = this.copyBase();
    this.applySize(width, height);
    this.base.imageSmoothingEnabled = smooth;
    this.base.drawImage(src, 0, 0, src.width, src.height, 0, 0, width, height);
    this.base.imageSmoothingEnabled = false;
    this.clearOverlay();
    this.setSelection(null);
    this.clearSelectionLayer();
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
  }

  // Trim the canvas to the current selection (Image → Crop). No-op if there's
  // no usable selection.
  cropToSelection(): boolean {
    this.stampFloatOnly();
    const r = this.selection ? this.clampRect(this.selection) : null;
    if (!r || r.w < 1 || r.h < 1) return false;
    const region = this.base.getImageData(r.x, r.y, r.w, r.h);
    this.applySize(r.w, r.h);
    this.base.putImageData(region, 0, 0);
    this.clearOverlay();
    this.setSelection(null);
    this.clearSelectionLayer();
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
    return true;
  }

  flipHorizontal(): void {
    this.transformInPlace(this.width, this.height, (ctx, src) => {
      ctx.translate(this.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0);
    });
  }

  flipVertical(): void {
    this.transformInPlace(this.width, this.height, (ctx, src) => {
      ctx.translate(0, this.height);
      ctx.scale(1, -1);
      ctx.drawImage(src, 0, 0);
    });
  }

  // Rotate 90° clockwise; swaps width and height.
  rotate90(): void {
    this.transformInPlace(this.height, this.width, (ctx, src) => {
      ctx.translate(this.width, 0); // new width == old height
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(src, 0, 0);
    });
  }

  // Shared plumbing for the flip/rotate transforms: snapshot the current base,
  // resize to the target dimensions, and let `draw` paint the transformed copy.
  private transformInPlace(
    newW: number,
    newH: number,
    draw: (ctx: CanvasRenderingContext2D, src: HTMLCanvasElement) => void,
  ): void {
    this.stampFloatOnly();
    const src = this.copyBase();
    this.applySize(newW, newH);
    this.base.save();
    draw(this.base, src);
    this.base.restore();
    this.clearOverlay();
    this.setSelection(null);
    this.clearSelectionLayer();
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Selection lifecycle (marquee → lift → move → stamp; copy/paste/delete)
  // ─────────────────────────────────────────────────────────────────────────

  hasSelectionOrFloat(): boolean {
    return this.selection != null || this.floatCanvas != null;
  }

  // Every selection is rectangular unless a lasso setter re-attaches a poly, so
  // all writes to `selection` funnel through here to keep the two in sync.
  private setSelection(r: Rect | null): void {
    this.selection = r;
    this.selPoly = null;
    this.selPolyClosed = false;
  }

  // The lasso outline as a Path2D positioned at the current selection origin
  // (it follows a float drag automatically). Null for rectangular selections.
  // Clip/fill callers force closure; the ants renderer keeps an in-progress
  // drag's outline open.
  private selPath(forceClose = true): Path2D | null {
    if (!this.selPoly || !this.selection || this.selPoly.length < 3) return null;
    const { x, y } = this.selection;
    const path = new Path2D();
    path.moveTo(x + this.selPoly[0].x, y + this.selPoly[0].y);
    for (let i = 1; i < this.selPoly.length; i++)
      path.lineTo(x + this.selPoly[i].x, y + this.selPoly[i].y);
    if (forceClose || this.selPolyClosed) path.closePath();
    return path;
  }

  // Update the live marquee while dragging (no float yet).
  setMarquee(rect: Rect): void {
    this.setSelection(this.clampRect(rect));
    this.emit();
  }

  // Finalize the marquee on pointer-up. A zero-area drag clears the selection.
  finalizeMarquee(rect: Rect): void {
    const r = this.clampRect(rect);
    this.setSelection(r.w >= 1 && r.h >= 1 ? r : null);
    if (!this.selection) this.clearSelectionLayer();
    this.emit();
  }

  // Live free-form outline while the lasso drags. The selection rect tracks the
  // outline's bounding box; the outline stays open until finalized.
  setLassoPreview(points: Point[]): void {
    const r = this.polyBounds(points);
    this.setSelection(r);
    if (r) this.attachPoly(points, r, false);
    this.emit();
  }

  // Close the lasso back to its start on pointer-up. Degenerate paths (fewer
  // than 3 points or an empty bounding box) clear the selection.
  finalizeLasso(points: Point[]): void {
    const r = points.length >= 3 ? this.polyBounds(points) : null;
    this.setSelection(r);
    if (r) this.attachPoly(points, r, true);
    if (!this.selection) this.clearSelectionLayer();
    this.emit();
  }

  // Bounding box of a point list, clamped to the canvas.
  private polyBounds(points: Point[]): Rect | null {
    if (!points.length) return null;
    let minX = points[0].x,
      minY = points[0].y,
      maxX = points[0].x,
      maxY = points[0].y;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const r = this.clampRect({
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    });
    return r.w >= 1 && r.h >= 1 ? r : null;
  }

  // Store the outline relative to its bounding box (setSelection cleared it).
  private attachPoly(points: Point[], origin: Rect, closed: boolean): void {
    this.selPoly = points.map((p) => ({
      x: p.x - origin.x,
      y: p.y - origin.y,
    }));
    this.selPolyClosed = closed;
  }

  selectAll(): void {
    this.commitFloat();
    this.setSelection({ x: 0, y: 0, w: this.width, h: this.height });
    this.emit();
  }

  // Lift the selected base pixels into a float so they can be dragged, leaving a
  // hole filled with the background color. Part of a move: no snapshot yet.
  // A lasso selection lifts only the pixels inside its outline (the float is
  // transparent outside it) and the hole matches the outline, not the box.
  beginFloat(bgColor: string): void {
    if (!this.selection || this.floatCanvas) return;
    const r = this.selection;
    const path = this.selPath();
    const fc = document.createElement("canvas");
    fc.width = r.w;
    fc.height = r.h;
    const fctx = fc.getContext("2d")!;
    if (path) {
      fctx.translate(-r.x, -r.y);
      fctx.clip(path);
      fctx.drawImage(this.baseCanvas, 0, 0);
    } else {
      fctx.drawImage(this.baseCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    }
    this.floatCanvas = fc;
    this.floatX = r.x;
    this.floatY = r.y;
    this.floatLifted = true;
    this.base.save();
    this.base.fillStyle = bgColor;
    if (path) this.base.fill(path);
    else this.base.fillRect(r.x, r.y, r.w, r.h);
    this.base.restore();
    this.dirty = true;
    this.emit();
  }

  // Reposition the floating content (drag-move). The marquee follows it.
  moveFloatTo(x: number, y: number): void {
    if (!this.floatCanvas || !this.selection) return;
    this.floatX = Math.round(x);
    this.floatY = Math.round(y);
    this.selection = {
      x: this.floatX,
      y: this.floatY,
      w: this.selection.w,
      h: this.selection.h,
    };
  }

  // Fold the float into the base and record one history step. Returns whether a
  // float existed. Used on deselect (Esc / tool switch / new marquee).
  commitFloat(): boolean {
    if (!this.floatCanvas) return false;
    this.base.drawImage(this.floatCanvas, this.floatX, this.floatY);
    this.discardFloat();
    this.history.push(this.readBase());
    this.dirty = true;
    return true;
  }

  // Fold the float into the base WITHOUT snapshotting — for callers (resize,
  // crop, flip, paste, select-all) that immediately record their own step.
  private stampFloatOnly(): void {
    if (!this.floatCanvas) return;
    this.base.drawImage(this.floatCanvas, this.floatX, this.floatY);
    this.discardFloat();
  }

  private discardFloat(): void {
    this.floatCanvas = null;
    this.floatLifted = false;
  }

  // Commit any float, drop the marquee, and clear the selection layer.
  deselect(): void {
    this.commitFloat();
    this.setSelection(null);
    this.clearSelectionLayer();
    this.emit();
  }

  // Delete the selection contents. A moved float already punched a hole, so we
  // just drop it; a pasted float is additive (drop, no base change); a plain
  // selection is cleared to the background color (lasso: just the outline's
  // interior, not its bounding box).
  deleteSelection(bgColor: string): void {
    if (this.floatCanvas) {
      const changed = this.floatLifted;
      this.discardFloat();
      if (changed) {
        this.history.push(this.readBase());
        this.dirty = true;
      }
    } else if (this.selection) {
      const r = this.selection;
      const path = this.selPath();
      this.base.save();
      this.base.fillStyle = bgColor;
      if (path) this.base.fill(path);
      else this.base.fillRect(r.x, r.y, r.w, r.h);
      this.base.restore();
      this.history.push(this.readBase());
      this.dirty = true;
    }
    this.setSelection(null);
    this.clearSelectionLayer();
    this.emit();
  }

  // The pixels the clipboard should copy: the float if any, else the selected
  // base region (lasso: transparent outside the outline), else null (caller may
  // fall back to the whole image).
  getSelectionPixels(): ImageData | null {
    if (this.floatCanvas) {
      return this.floatCanvas
        .getContext("2d")!
        .getImageData(0, 0, this.floatCanvas.width, this.floatCanvas.height);
    }
    if (this.selection) {
      const r = this.selection;
      const path = this.selPath();
      if (path) {
        const c = document.createElement("canvas");
        c.width = r.w;
        c.height = r.h;
        const cctx = c.getContext("2d")!;
        cctx.translate(-r.x, -r.y);
        cctx.clip(path);
        cctx.drawImage(this.baseCanvas, 0, 0);
        return cctx.getImageData(0, 0, r.w, r.h);
      }
      return this.base.getImageData(r.x, r.y, r.w, r.h);
    }
    return null;
  }

  fullImageData(): ImageData {
    return this.readBase();
  }

  // Drop pasted pixels in as a float at the top-left, selected and ready to
  // drag. Additive (no hole), so deleting it just removes it. If the paste is
  // larger than the canvas, grow the canvas to fit rather than clipping it —
  // matching Paint, which enlarges the bitmap to hold a larger paste.
  pasteImageData(img: ImageData): void {
    this.commitFloat();

    const newW = Math.max(this.width, img.width);
    const newH = Math.max(this.height, img.height);
    if (newW !== this.width || newH !== this.height) {
      const prev = this.copyBase(); // existing pixels, at the old size
      this.applySize(newW, newH); // clears all three layers
      this.fillBase("#ffffff"); // white the newly exposed area
      this.base.drawImage(prev, 0, 0); // restore the old pixels, top-left
    }

    const fc = document.createElement("canvas");
    fc.width = img.width;
    fc.height = img.height;
    fc.getContext("2d")!.putImageData(img, 0, 0);
    this.floatCanvas = fc;
    this.floatLifted = false;
    this.floatX = 0;
    this.floatY = 0;
    this.setSelection({ x: 0, y: 0, w: img.width, h: img.height });
    this.dirty = true;
    this.emit();
  }

  // Repaint the selection layer: floating content, then animated marching ants
  // along the current marquee — the rect, or the lasso outline when one exists.
  // Driven by CanvasStage's rAF loop.
  renderSelection(dashOffset = 0): void {
    const s = this.sel;
    s.clearRect(0, 0, this.width, this.height);
    if (this.floatCanvas) s.drawImage(this.floatCanvas, this.floatX, this.floatY);
    const r = this.selection;
    if (!r || r.w < 1 || r.h < 1) return;
    const path = this.selPath(false);
    s.save();
    s.lineWidth = 1;
    s.setLineDash([4, 4]);
    s.strokeStyle = "#ffffff";
    s.lineDashOffset = -dashOffset;
    if (path) s.stroke(path);
    else
      s.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1));
    s.strokeStyle = "#000000";
    s.lineDashOffset = -dashOffset + 4;
    if (path) s.stroke(path);
    else
      s.strokeRect(r.x + 0.5, r.y + 0.5, Math.max(0, r.w - 1), Math.max(0, r.h - 1));
    s.restore();
  }

  // Whether a point (image px) is inside the current selection — for the select
  // tools' move-vs-new-marquee decision. A lasso tests against its outline, not
  // the bounding box.
  isInsideSelection(p: Point): boolean {
    const r = this.selection;
    if (!r) return false;
    const path = this.selPath();
    if (path) return this.sel.isPointInPath(path, p.x, p.y);
    return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  }

  // Snapshot the current base into a detached canvas (for transforms/resize).
  private copyBase(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.width;
    c.height = this.height;
    c.getContext("2d")!.drawImage(this.baseCanvas, 0, 0);
    return c;
  }

  // Clamp/normalize a rect to integer bounds within the canvas.
  private clampRect(r: Rect): Rect {
    const x1 = Math.max(0, Math.min(this.width, Math.round(r.x)));
    const y1 = Math.max(0, Math.min(this.height, Math.round(r.y)));
    const x2 = Math.max(0, Math.min(this.width, Math.round(r.x + r.w)));
    const y2 = Math.max(0, Math.min(this.height, Math.round(r.y + r.h)));
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    };
  }

  // Export the base layer (Save). Callers should deselect() first so a floating
  // selection is baked in. `quality` applies to lossy formats (JPEG).
  toBlob(type = "image/png", quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.baseCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
        type,
        quality,
      );
    });
  }
}
