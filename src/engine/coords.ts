import type { Point } from "./types";

// DOM pointer event → canvas logical pixel.
//
// The canvas *backing store* is sized in logical image pixels (canvasEl.width),
// while the element is displayed at whatever size CSS gives it — including any
// zoom scaling and pan offset. getBoundingClientRect() captures both the
// on-screen size and position, so the mapping is simply:
//
//     logical = (client - rectOrigin) * (backingSize / renderedSize)
//
// Because the rect already reflects zoom and pan, tools receive correct logical
// coordinates without knowing anything about the view transform. When zoom/pan
// arrive, only the element's CSS changes — this function does not.
export function screenToCanvas(
  clientX: number,
  clientY: number,
  canvasEl: HTMLCanvasElement,
): Point {
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / rect.width;
  const scaleY = canvasEl.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}
