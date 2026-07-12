import { describe, expect, it } from "vitest";
import { HANDLE_CURSOR, handleEdges, selectionHandles } from "./selectionHandles";

const R = { x: 10, y: 20, w: 100, h: 60 };

describe("selectionHandles", () => {
  it("places eight grips at the corners and edge midpoints", () => {
    const h = Object.fromEntries(selectionHandles(R).map((g) => [g.id, g]));
    expect(selectionHandles(R)).toHaveLength(8);
    expect([h.nw.x, h.nw.y]).toEqual([10, 20]);
    expect([h.se.x, h.se.y]).toEqual([110, 80]);
    expect([h.n.x, h.n.y]).toEqual([60, 20]); // top edge midpoint
    expect([h.e.x, h.e.y]).toEqual([110, 50]); // right edge midpoint
  });

  it("maps each grip to a resize cursor", () => {
    expect(HANDLE_CURSOR.nw).toBe("nwse-resize");
    expect(HANDLE_CURSOR.ne).toBe("nesw-resize");
    expect(HANDLE_CURSOR.n).toBe("ns-resize");
    expect(HANDLE_CURSOR.e).toBe("ew-resize");
  });

  it("reports which edges a grip moves", () => {
    expect(handleEdges("se")).toEqual({ left: false, right: true, top: false, bottom: true });
    expect(handleEdges("nw")).toEqual({ left: true, right: false, top: true, bottom: false });
    expect(handleEdges("e")).toEqual({ left: false, right: true, top: false, bottom: false });
    expect(handleEdges("n")).toEqual({ left: false, right: false, top: true, bottom: false });
  });
});
