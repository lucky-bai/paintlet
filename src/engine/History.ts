// Snapshot-based undo/redo.
//
// Every committed action pushes a full-canvas ImageData. Undo/redo is just
// walking an index over that stack and re-applying a snapshot with putImageData.
// It's robust precisely because everything in Paintlet ends as pixels — there
// are no per-tool undo special cases.
//
// Memory: an 800×600 snapshot ≈ 1.9 MB; the default cap of 30 ≈ 57 MB. Fine.
// Evolution path: swap this internal store for dirty-rect diffs or a patch log
// later — this public interface (push/undo/redo/canUndo/canRedo) stays identical,
// so the commit flow and tools never change.

export class History {
  private stack: ImageData[] = [];
  private index = -1;
  private max: number;

  constructor(max = 30) {
    this.max = max;
  }

  push(snapshot: ImageData): void {
    // Discard any redo entries ahead of the current position — a new action
    // forks history.
    if (this.index < this.stack.length - 1) {
      this.stack.length = this.index + 1;
    }
    this.stack.push(snapshot);
    // Cap memory by dropping the oldest snapshot when over the limit.
    if (this.stack.length > this.max) {
      this.stack.shift();
    }
    this.index = this.stack.length - 1;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  undo(): ImageData | null {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return this.stack[this.index];
  }

  redo(): ImageData | null {
    if (!this.canRedo()) return null;
    this.index += 1;
    return this.stack[this.index];
  }

  // Drop all history — used when a fresh/opened document seeds snapshot #0.
  reset(): void {
    this.stack = [];
    this.index = -1;
  }
}
