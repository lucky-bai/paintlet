import { History } from "./History";
import type { Point } from "./types";

// Snapshot of engine state that the UI mirrors (menu/button enablement, title
// dirty dot). The engine pushes these; React never reaches into the engine for
// pixel data.
export type EngineChange = {
  canUndo: boolean;
  canRedo: boolean;
  isDirty: boolean;
};

// The imperative core. Owns the two <canvas> contexts, the commit flow, and
// history. Pixel data lives HERE and only here — never in React/Zustand. This
// is the single most important performance boundary in the app.
export class CanvasEngine {
  // Non-null asserted: set in attach() before any drawing can happen.
  base!: CanvasRenderingContext2D; // committed pixels (source of truth)
  overlay!: CanvasRenderingContext2D; // live preview, cleared per stroke

  private baseCanvas!: HTMLCanvasElement;
  private overlayCanvas!: HTMLCanvasElement;
  private history = new History(30);
  private dirty = false;
  private onChange?: (c: EngineChange) => void;

  width = 800;
  height = 600;

  // Bind the engine to the two stacked canvas elements the CanvasStage mounts.
  // Seeds a white document and history snapshot #0.
  attach(
    base: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    width: number,
    height: number,
  ): void {
    this.baseCanvas = base;
    this.overlayCanvas = overlay;
    this.width = width;
    this.height = height;

    // Backing store is logical image pixels (NOT multiplied by devicePixelRatio);
    // crispness/zoom come from CSS + image-rendering: pixelated.
    base.width = width;
    base.height = height;
    overlay.width = width;
    overlay.height = height;

    // willReadFrequently: we snapshot the base with getImageData on every commit.
    const b = base.getContext("2d", { willReadFrequently: true });
    const o = overlay.getContext("2d");
    if (!b || !o) throw new Error("Could not acquire 2D canvas context");
    this.base = b;
    this.overlay = o;
    this.base.imageSmoothingEnabled = false;
    this.overlay.imageSmoothingEnabled = false;

    this.fillBase("#ffffff");
    this.history.reset();
    this.history.push(this.readBase());
    this.dirty = false;
    this.emit();
  }

  // The store wires this up to mirror canUndo/canRedo/isDirty into React.
  setOnChange(cb: (c: EngineChange) => void): void {
    this.onChange = cb;
  }

  private emit(): void {
    this.onChange?.({
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      isDirty: this.dirty,
    });
  }

  private readBase(): ImageData {
    return this.base.getImageData(0, 0, this.width, this.height);
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

  // The heartbeat: fold the overlay preview into the base, clear it, snapshot.
  // Every tool ends its action here, so undo/selection/text all reduce to this.
  commit(_label: string): void {
    this.base.drawImage(this.overlayCanvas, 0, 0);
    this.clearOverlay();
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
  }

  // Record the current base as a history step without an overlay composite
  // (used by File → Open and any direct base mutation like flood fill).
  snapshot(_label: string): void {
    this.history.push(this.readBase());
    this.dirty = true;
    this.emit();
  }

  undo(): void {
    const snap = this.history.undo();
    if (!snap) return;
    this.base.putImageData(snap, 0, 0);
    this.clearOverlay();
    this.dirty = true;
    this.emit();
  }

  redo(): void {
    const snap = this.history.redo();
    if (!snap) return;
    this.base.putImageData(snap, 0, 0);
    this.clearOverlay();
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

  // Export the base layer (Save). PNG by default.
  toBlob(type = "image/png"): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.baseCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
        type,
      );
    });
  }
}
