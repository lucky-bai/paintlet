// Which image formats Paintlet can read and write.
//
// Both directions are bounded by the webview, not by Rust — read_image_file /
// write_image_file just move bytes and neither knows nor cares about formats.
// WebKit sits on ImageIO, so what it can *decode* is wider than the
// web-standard set (BMP and HEIC come free), while what it can *encode* is
// narrower in one dangerous way: canvas.toBlob() cannot produce WebP and hands
// back PNG instead of failing. Every entry below was verified against
// WKWebView on macOS 26 by round-tripping a canvas through toBlob and
// createImageBitmap.

// Offered in the Open dialog; all of these decode via createImageBitmap.
// TIFF also decodes, but a Paint clone offering it is more clutter than help.
export const OPEN_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "heic",
  "heif",
];

export interface Encoding {
  type: string;
  quality?: number;
}

// Extension → encoder. An extension may only appear here if the canvas can
// genuinely produce that format, because this table decides what bytes get
// written under a given filename: listing a format we can't encode means
// writing PNG bytes into a .webp, which corrupts the file rather than saving
// it. WebP and HEIC are deliberately absent — they open fine, but WebKit
// cannot write either one.
export const ENCODERS: Record<string, Encoding> = {
  png: { type: "image/png" },
  jpg: { type: "image/jpeg", quality: 0.92 },
  jpeg: { type: "image/jpeg", quality: 0.92 },
  gif: { type: "image/gif" },
  bmp: { type: "image/bmp" },
};

export const PNG_ENCODING: Encoding = { type: "image/png" };

// What the save panel's format popup offers, in order — the first is what an
// extension-less name becomes. Uniform type identifiers, because that's what
// NSSavePanel's allowedContentTypes takes; AppKit derives each menu item's
// label and extension from the UTI itself, so there are no display names to
// keep in sync here.
//
// `ext` records which ENCODERS entry each UTI resolves to, so a format can't be
// offered in the popup without something able to write it — a test asserts it.
//
// GIF comes last because it quantizes to 256 colors. It writes a real GIF, but
// a full-color drawing loses color depth doing so, which makes it a deliberate
// pick rather than something that should sit next to PNG at the top.
export const SAVE_FORMATS = [
  { uti: "public.png", ext: "png" },
  { uti: "public.jpeg", ext: "jpeg" },
  { uti: "com.microsoft.bmp", ext: "bmp" },
  { uti: "com.compuserve.gif", ext: "gif" },
];

export const SAVE_UTIS = SAVE_FORMATS.map((f) => f.uti);

// The final path component's extension, lowercased; "" when there is none.
// Anchored past any separator so a dot in a directory name ("~/v1.2/sketch")
// doesn't read as an extension.
export function extOf(path: string): string {
  return path.match(/\.([^./\\]+)$/)?.[1].toLowerCase() ?? "";
}

// Whether this path's format can be written at all. Drives two decisions: may
// ⌘S re-write the file in place, and does a name typed into the save panel
// keep its extension or gain a .png.
export function canEncode(path: string): boolean {
  return extOf(path) in ENCODERS;
}

export function encodingFor(path: string): Encoding {
  return ENCODERS[extOf(path)] ?? PNG_ENCODING;
}
