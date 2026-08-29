// Stroke-width ladders and stepping, shared by the toolbar controls and the
// `[` / `]` shortcuts so both walk the same rungs.

// Freehand widths (pencil / brush / eraser) reachable with `[` / `]`: single
// pixels while the stroke is thin — down there one pixel is the whole visible
// difference — and coarser as it grows, so the 1–64 range is crossable in a
// couple of dozen presses instead of sixty. The slider still sets any width in
// between; stepping from one of those moves to the next rung past it.
export const BRUSH_LADDER: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64,
];

export const BRUSH_MIN = BRUSH_LADDER[0];
export const BRUSH_MAX = BRUSH_LADDER[BRUSH_LADDER.length - 1];

// Shape tools draw at one of a few fixed widths rather than the freehand
// tools' continuous slider.
export const SHAPE_SIZES: number[] = [1, 3, 5, 8];

// The next rung strictly past `size`, clamped at both ends. Defining it as
// "past" rather than "index ± 1" handles the on-ladder and off-ladder cases in
// one go, and makes the walk symmetric by construction: whatever `]` reaches,
// `[` returns from.
function stepLadder(ladder: number[], size: number, dir: 1 | -1): number {
  if (dir > 0) {
    for (const n of ladder) if (n > size) return n;
    return ladder[ladder.length - 1];
  }
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (ladder[i] < size) return ladder[i];
  }
  return ladder[0];
}

export const nextBrushSize = (size: number, dir: 1 | -1): number =>
  stepLadder(BRUSH_LADDER, size, dir);

export const nextShapeSize = (size: number, dir: 1 | -1): number =>
  stepLadder(SHAPE_SIZES, size, dir);
