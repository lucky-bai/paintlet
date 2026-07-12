// Per-tool CSS cursors, drawn as inline SVG data URIs (Paint telegraphs the
// active tool through its cursor). Each glyph is stroked twice — a thick white
// underlay beneath a thin black line — so it stays visible over any pixels.
// The hotspot is the point that maps to the click coordinate.

function svgCursor(
  inner: string,
  hotX: number,
  hotY: number,
  fallback: string,
): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" ` +
    `fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g stroke="#ffffff" stroke-width="4.5">${inner}</g>` +
    `<g stroke="#000000" stroke-width="2">${inner}</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

// Paint bucket, tipped over — hotspot at the pouring corner (bottom-left).
export const bucketCursor = svgCursor(
  '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0L19 11Z"/>' +
    '<path d="m5 2 5 5"/><path d="M2 13h15"/>',
  2,
  17,
  "crosshair",
);

// Eyedropper — hotspot at the sampling tip (bottom-left).
export const dropperCursor = svgCursor(
  '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/>' +
    '<path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  2,
  20,
  "crosshair",
);

// Eraser — a small square outline, centered on the click point.
export const eraserCursor = svgCursor(
  '<rect x="7" y="7" width="10" height="10"/>',
  11,
  11,
  "crosshair",
);
