// Imperative escape hatches the CanvasStage registers for the action layer.
// Some state that must yield to app-level commands lives inside the stage —
// the floating text editor and an in-progress multi-gesture shape — and these
// hooks let Save/New/Open/Undo reach it without routing React state upward.
export const stageHooks: {
  // Rasterize and close the floating text editor, if one is open. Called
  // before anything that exports or replaces the document, so typed-but-
  // uncommitted text can't be silently lost.
  flushTextEdit: (() => void) | null;
  // Cancel the active tool's in-progress gesture/session (e.g. a half-built
  // polygon), so undo/redo can't leave a stale rubber-band preview behind.
  cancelToolSession: (() => void) | null;
} = {
  flushTextEdit: null,
  cancelToolSession: null,
};
