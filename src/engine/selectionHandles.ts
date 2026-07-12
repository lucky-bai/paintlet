import type { Rect } from "./types";

// The eight resize grips around a selection (four corners + four edge
// midpoints), shared by the renderer (draws them) and the select tool
// (hit-tests them) so the two never disagree.

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface Handle {
  id: HandleId;
  x: number; // image px
  y: number;
}

// Handle centers in image pixels, in a stable order.
export function selectionHandles(r: Rect): Handle[] {
  const midX = r.x + r.w / 2;
  const midY = r.y + r.h / 2;
  const right = r.x + r.w;
  const bottom = r.y + r.h;
  return [
    { id: "nw", x: r.x, y: r.y },
    { id: "n", x: midX, y: r.y },
    { id: "ne", x: right, y: r.y },
    { id: "e", x: right, y: midY },
    { id: "se", x: right, y: bottom },
    { id: "s", x: midX, y: bottom },
    { id: "sw", x: r.x, y: bottom },
    { id: "w", x: r.x, y: midY },
  ];
}

// The CSS cursor for each grip.
export const HANDLE_CURSOR: Record<HandleId, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

// Which edges a grip moves (the others stay pinned to the opposite anchor).
export function handleEdges(id: HandleId): {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
} {
  return {
    left: id.includes("w"),
    right: id.includes("e"),
    top: id.includes("n"),
    bottom: id.includes("s"),
  };
}
