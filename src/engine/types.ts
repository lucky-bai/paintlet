// Shared engine types. Coordinates here are always *logical image pixels*
// (1 canvas pixel = 1 image pixel), never CSS/device pixels — the mapping from
// screen space happens once in coords.ts before any tool sees a point.

export type Point = { x: number; y: number };

// Which mouse button drove the event → which color we paint with.
export type MouseButton = "primary" | "secondary";

// Reserved for zoom/pan. MVP runs at zoom=1/pan=0; the field exists so the
// zoom slider slots in without touching tools.
export type ViewTransform = { zoom: number; panX: number; panY: number };

export type ToolId =
  | "pencil"
  | "brush"
  | "eraser"
  | "line"
  | "rectangle"
  | "ellipse"
  | "fill"
  | "eyedropper"
  | "select"
  | "text";

export type Theme = "system" | "light" | "dark";

// A rectangular region in logical image pixels (integer bounds). Used by the
// selection tool, copy/paste, and crop.
export type Rect = { x: number; y: number; w: number; h: number };

// Text tool styling, mirrored in the store so the contextual options bar can
// edit it and the raster step can read it back.
export type TextStyle = {
  fontFamily: string;
  fontSize: number; // px, in logical image pixels
  bold: boolean;
  italic: boolean;
};
