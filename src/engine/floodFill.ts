// Scanline flood fill over a single getImageData/putImageData pass — never read
// pixels per-iteration. Fills the contiguous region matching the seed pixel's
// color (within a tolerance) with fillColor.

export function floodFill(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  fillColor: [number, number, number, number],
  tolerance = 0,
): void {
  const x0 = Math.floor(seedX);
  const y0 = Math.floor(seedY);
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;

  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const idx = (x: number, y: number) => (y * width + x) * 4;

  const s = idx(x0, y0);
  const target = [data[s], data[s + 1], data[s + 2], data[s + 3]];

  // Already the fill color at the seed → nothing to do (also prevents an
  // infinite loop when target === fill).
  if (
    Math.abs(target[0] - fillColor[0]) <= tolerance &&
    Math.abs(target[1] - fillColor[1]) <= tolerance &&
    Math.abs(target[2] - fillColor[2]) <= tolerance &&
    Math.abs(target[3] - fillColor[3]) <= tolerance
  ) {
    return;
  }

  const matches = (i: number) =>
    Math.abs(data[i] - target[0]) <= tolerance &&
    Math.abs(data[i + 1] - target[1]) <= tolerance &&
    Math.abs(data[i + 2] - target[2]) <= tolerance &&
    Math.abs(data[i + 3] - target[3]) <= tolerance;

  const paint = (i: number) => {
    data[i] = fillColor[0];
    data[i + 1] = fillColor[1];
    data[i + 2] = fillColor[2];
    data[i + 3] = fillColor[3];
  };

  // Stack of seed points; for each we fill its whole horizontal span, then push
  // seeds for newly-openable spans above and below.
  const stack: Array<[number, number]> = [[x0, y0]];
  while (stack.length) {
    const [px, py] = stack.pop()!;
    let x = px;
    while (x >= 0 && matches(idx(x, py))) x--;
    x++;
    let spanUp = false;
    let spanDown = false;
    while (x < width && matches(idx(x, py))) {
      paint(idx(x, py));
      if (py > 0) {
        const up = matches(idx(x, py - 1));
        if (up && !spanUp) {
          stack.push([x, py - 1]);
          spanUp = true;
        } else if (!up) {
          spanUp = false;
        }
      }
      if (py < height - 1) {
        const down = matches(idx(x, py + 1));
        if (down && !spanDown) {
          stack.push([x, py + 1]);
          spanDown = true;
        } else if (!down) {
          spanDown = false;
        }
      }
      x++;
    }
  }

  ctx.putImageData(img, 0, 0);
}
