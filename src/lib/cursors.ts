// Per-tool CSS cursors, drawn as inline SVG data URIs (Paint telegraphs the
// active tool through its cursor). Glyphs are drawn with a thick white underlay
// beneath the colored shape so they stay legible over any pixels.
//
// The SVG's pixel size MUST equal its viewBox so the hotspot (given in the same
// coordinates as the drawing) lands exactly on the intended point — a mismatch
// skews the hotspot and makes the tool act a couple of pixels off from where the
// user aims. The hotspot is the point that maps to the click coordinate.

// Build a cursor value from a complete SVG string, with the hotspot in the
// SVG's own coordinate space.
function cursorUrl(svg: string, hotX: number, hotY: number, fallback: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

// ── Fill (bucket) ──────────────────────────────────────────────────────────
// A tilted paint bucket pouring a stream to its lower-left; the hotspot is the
// drip tip (4,28) — the exact pixel the fill starts from. Reads as the tool,
// not a crosshair.
const BUCKET_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" stroke-linejoin="round" stroke-linecap="round">` +
  `<g stroke="#ffffff" stroke-width="3.5" fill="#ffffff">` +
  `<path d="M4 28 q1.5 -4 3.5 -6"/>` +
  `<g transform="rotate(-38 18 15)"><path d="M9 6 h14 v10 a7 3.2 0 0 1 -14 0 z"/>` +
  `<path d="M9 6 a7 3.2 0 0 0 14 0"/><path d="M11 5.4 a5 5 0 0 1 10 0"/></g></g>` +
  `<path d="M4 28 q1.5 -4 3.5 -6" fill="none" stroke="#111111" stroke-width="1.4"/>` +
  `<circle cx="4" cy="28" r="1.6" fill="#111111"/>` +
  `<g transform="rotate(-38 18 15)" stroke="#111111" stroke-width="1.2">` +
  `<path d="M9 6 h14 v10 a7 3.2 0 0 1 -14 0 z" fill="#dff1ff"/>` +
  `<path d="M9 6 a7 3.2 0 0 0 14 0" fill="#9bd8ff"/>` +
  `<path d="M11 5.4 a5 5 0 0 1 10 0" fill="none"/></g></svg>`;
export const bucketCursor = cursorUrl(BUCKET_SVG, 4, 28, "crosshair");

// ── Eyedropper ─────────────────────────────────────────────────────────────
// A pipette with a light-blue bulb and barrel and a black tube down to a tip at
// (3,29) — the sampled pixel. The live color being sampled is shown as a small
// square that follows the pointer (handled in CanvasStage), not baked in here.
const DROPPER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" stroke-linejoin="round" stroke-linecap="round">` +
  `<g stroke="#ffffff" stroke-width="3.5" fill="none">` +
  `<path d="M3 29 L17 15"/>` +
  `<rect x="15.5" y="8.5" width="9" height="6.5" rx="2.2" transform="rotate(45 20 12)"/>` +
  `<path d="M18.5 6.5 a3.2 3.2 0 0 1 5 5"/></g>` +
  `<path d="M3 29 L17 15" fill="none" stroke="#111111" stroke-width="2.2"/>` +
  `<rect x="15.5" y="8.5" width="9" height="6.5" rx="2.2" transform="rotate(45 20 12)" fill="#dff1ff" stroke="#111111" stroke-width="1.2"/>` +
  `<path d="M18.5 6.5 a3.2 3.2 0 0 1 5 5" fill="#9bd8ff" stroke="#111111" stroke-width="1.2"/></svg>`;
export const dropperCursor = cursorUrl(DROPPER_SVG, 3, 29, "crosshair");

// ── Freehand fallbacks ───────────────────────────────────────────────────────
// The brush and eraser cursors are normally SIZED to the stroke (see
// sizedCursor, used from CanvasStage); these fixed glyphs are the fallback.
const SIZE = 24;
function svgCursor(inner: string, hotX: number, hotY: number, fallback: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" ` +
    `fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g stroke="#ffffff" stroke-width="4">${inner}</g>` +
    `<g stroke="#000000" stroke-width="1.5">${inner}</g></svg>`;
  return cursorUrl(svg, hotX, hotY, fallback);
}

export const eraserCursor = svgCursor(
  '<rect x="7" y="7" width="10" height="10"/>',
  12,
  12,
  "crosshair",
);

export const brushCursor = svgCursor('<circle cx="12" cy="12" r="5"/>', 12, 12, "crosshair");

// A brush/eraser cursor whose outline matches the size actually painted on
// screen (image px × zoom), so the pointer telegraphs coverage instead of a
// fixed dot. Diameter is clamped to a grabbable, browser-supported range (very
// large cursors are silently dropped by the OS); the hotspot stays centered. A
// round outline suits the brush's round cap, a square one the eraser's.
export function sizedCursor(diameter: number, shape: "circle" | "square"): string {
  const d = Math.max(6, Math.min(128, Math.round(diameter)));
  const pad = 3; // room for the white underlay stroke, so the edge isn't clipped
  const size = d + pad * 2;
  const c = size / 2; // center = hotspot
  const glyph =
    shape === "circle"
      ? `<circle cx="${c}" cy="${c}" r="${d / 2}"/>`
      : `<rect x="${pad}" y="${pad}" width="${d}" height="${d}"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ` +
    `fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g stroke="#ffffff" stroke-width="3">${glyph}</g>` +
    `<g stroke="#000000" stroke-width="1">${glyph}</g></svg>`;
  return cursorUrl(svg, c, c, "crosshair");
}
