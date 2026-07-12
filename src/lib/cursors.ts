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

// A brush/eraser cursor whose outline matches the size actually painted on
// screen (image px × zoom), so the pointer telegraphs coverage instead of a
// fixed dot that lies about a fat brush. Diameter is clamped to a grabbable,
// browser-supported range (very large cursors are silently dropped by the OS);
// the hotspot stays centered. A round outline suits the brush's round cap, a
// square one the eraser's square cap.
export function sizedCursor(
  diameter: number,
  shape: "circle" | "square",
): string {
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
    `<g stroke="#000000" stroke-width="1">${glyph}</g>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, crosshair`;
}
