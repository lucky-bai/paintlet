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
  | "select" // reserved — not built yet
  | "text"; // reserved — not built yet

export type Theme = "system" | "light" | "dark";
