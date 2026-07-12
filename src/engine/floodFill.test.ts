import { describe, expect, it } from "vitest";
import { floodFill } from "./floodFill";

// floodFill only calls getImageData(0,0,w,h) once and putImageData once, so a
// stub context over a letter-grid is enough to exercise it in plain node.
const COLORS: Record<string, [number, number, number, number]> = {
  W: [255, 255, 255, 255], // white
  B: [0, 0, 0, 255], // black
  R: [255, 0, 0, 255], // red (the fill color in these tests)
};
const RED = COLORS.R;

function grid(rows: string[]) {
  const h = rows.length;
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => data.set(COLORS[ch], (y * w + x) * 4)),
  );
  const img = { data, width: w, height: h } as ImageData;
  const ctx = {
    getImageData: () => img,
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D;
  // Render the grid back to letters for whole-picture assertions.
  const dump = () =>
    Array.from({ length: h }, (_, y) =>
      Array.from({ length: w }, (_, x) => {
        const i = (y * w + x) * 4;
        return (
          Object.keys(COLORS).find((k) =>
            COLORS[k].every((v, j) => v === data[i + j]),
          ) ?? "?"
        );
      }).join(""),
    );
  return { ctx, w, h, dump };
}

describe("floodFill", () => {
  it("fills an enclosed region up to (not through) its border", () => {
    const g = grid([
      "BBBBB",
      "BWWWB",
      "BWWWB",
      "BBBBB",
    ]);
    floodFill(g.ctx, g.w, g.h, 2, 2, RED);
    expect(g.dump()).toEqual([
      "BBBBB",
      "BRRRB",
      "BRRRB",
      "BBBBB",
    ]);
  });

  it("is 4-connected: does not leak through a diagonal gap", () => {
    const g = grid([
      "WWBWW",
      "WWBWW",
      "BBBWW",
      "WWWWW",
    ]);
    floodFill(g.ctx, g.w, g.h, 0, 0, RED);
    // Only the top-left pocket fills; the region below/right of the black
    // elbow is reachable only diagonally, so it stays white.
    expect(g.dump()).toEqual([
      "RRBWW",
      "RRBWW",
      "BBBWW",
      "WWWWW",
    ]);
  });

  it("no-ops when the seed already matches the fill color", () => {
    const g = grid(["RRW", "WWW"]);
    floodFill(g.ctx, g.w, g.h, 0, 0, RED);
    expect(g.dump()).toEqual(["RRW", "WWW"]);
  });

  it("no-ops on an out-of-bounds seed", () => {
    const g = grid(["WW", "WW"]);
    floodFill(g.ctx, g.w, g.h, -1, 5, RED);
    expect(g.dump()).toEqual(["WW", "WW"]);
  });

  it("floors fractional seed coordinates (pointer input)", () => {
    const g = grid([
      "WWB",
      "BBB",
    ]);
    floodFill(g.ctx, g.w, g.h, 1.9, 0.7, RED); // → cell (1, 0)
    expect(g.dump()).toEqual([
      "RRB",
      "BBB",
    ]);
  });
});
