// Zoom bounds shared by the slider, the menu/keyboard actions, and the
// wheel/pinch handlers — one clamp so no path can zoom past another's limits.
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 8;

export const clampZoom = (z: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
