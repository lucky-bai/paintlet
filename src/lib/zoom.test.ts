import { describe, expect, it } from "vitest";
import { ZOOM_MAX, ZOOM_MIN, clampZoom } from "./zoom";

describe("clampZoom", () => {
  it("clamps to the shared bounds", () => {
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(100)).toBe(ZOOM_MAX);
  });

  it("passes in-range values through", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2.37)).toBe(2.37);
  });
});
