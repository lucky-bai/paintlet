// Per-tool CSS cursors, drawn as inline SVG data URIs (Paint telegraphs the
// active tool through its cursor). Each glyph is stroked twice — a thick white
// underlay beneath a thin black line — so it stays visible over any pixels.
//
// The SVG's pixel size MUST equal its viewBox so the hotspot (given in the same
// coordinates as the drawing) lands exactly on the intended point — a mismatch
// (e.g. 22px rendered from a 24-unit box) skews the hotspot and makes the tool
// act a couple of pixels off from where the user aims. The hotspot is the point
// that maps to the click coordinate.

const SIZE = 24;

function svgCursor(
  inner: string,
  hotX: number,
  hotY: number,
  fallback: string,
): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" ` +
    `fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<g stroke="#ffffff" stroke-width="4">${inner}</g>` +
    `<g stroke="#000000" stroke-width="1.5">${inner}</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

// A precise crosshair centered on the hotspot, with a small gap at the very
// center so the targeted pixel stays visible. `glyph` adds a compact tool badge
// (kept clear of the center) so fill and eyedropper stay distinguishable.
function precisionCursor(glyph: string): string {
  const c = 12; // center = hotspot
  const cross =
    `<path d="M${c} 2v6M${c} 16v6M2 ${c}h6M16 ${c}h6"/>`;
  return svgCursor(cross + glyph, c, c, "crosshair");
}

// Fill (bucket): crosshair marks the exact pixel; a tiny tipped bucket badge
// sits in the upper-right, clear of the crosshair arms.
export const bucketCursor = precisionCursor(
  '<path d="M14 9l4.5-4.5 3 3L17 12z"/><path d="M20 4l1.6 1.6"/>',
);

// Eyedropper: crosshair marks the sampled pixel; a small dropper badge in the
// corner.
export const dropperCursor = precisionCursor(
  '<path d="m16 4 4 4M18.5 3.2a1.2 1.2 0 0 1 2.3 2.3l-4.8 4.8-2.3-2.3z"/>',
);

// Eraser — a small square outline, centered on the click point (already
// precise: the hotspot is the square's center).
export const eraserCursor = svgCursor(
  '<rect x="7" y="7" width="10" height="10"/>',
  12,
  12,
  "crosshair",
);

// Brush — a small circle matching its round cap, centered on the click point.
export const brushCursor = svgCursor(
  '<circle cx="12" cy="12" r="5"/>',
  12,
  12,
  "crosshair",
);
