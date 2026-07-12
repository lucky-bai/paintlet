// End-to-end smoke test: boots the web build (Vite dev server, no Tauri
// shell), drives it with real pointer/keyboard input in headless Chromium, and
// asserts by reading pixels back off the three canvases. Covers the seams unit
// tests can't: the commit flow, alpha-hardening, selection lifecycle, zoom.
//
//   pnpm test:e2e
//
// Exits non-zero on the first failing count; a screenshot of the final state
// lands in tests/artifacts/ either way.
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(root, "artifacts");
await mkdir(ARTIFACTS, { recursive: true });

const server = await createServer({
  root: path.join(root, ".."),
  server: { port: 5197, strictPort: true },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Minimal Tauri shim: native menu/dialog/window calls resolve to null instead
// of throwing (the app catches and logs them; nothing under test needs them).
await page.addInitScript(() => {
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main", windowLabel: "main" },
    },
    invoke: () => Promise.resolve(null),
    transformCallback: () => Math.floor(Math.random() * 1e9),
    unregisterCallback: () => {},
  };
});

const results = [];
const step = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
};

await page.goto("http://localhost:5197/");
await page.waitForSelector("canvas");
await page.waitForTimeout(400);

// ── helpers ────────────────────────────────────────────────────────────────
// Canvas DOM order: [0] base (committed), [1] overlay (preview + pointer
// target), [2] selection (float + ants).
const canvasBox = () => page.locator("canvas").nth(1).boundingBox();
const countPx = (i, x, y, w, h, mode) =>
  page.evaluate(
    ([i, x, y, w, h, mode]) => {
      const c = document.querySelectorAll("canvas")[i];
      const d = c.getContext("2d").getImageData(x, y, w, h).data;
      let n = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (mode === "dark" && d[k + 3] > 0 && d[k] < 128) n++;
        if (mode === "alpha" && d[k + 3] > 0) n++;
        if (mode === "gray" && d[k] > 40 && d[k] < 215) n++;
      }
      return n;
    },
    [i, x, y, w, h, mode],
  );
// Drive a menu-only action through the app's own module instance.
const action = (name) =>
  page.evaluate(async (n) => (await import("/src/actions.ts"))[n](), name);

let box = await canvasBox();
const at = (x, y) => [box.x + x, box.y + y];
const clickAt = async (x, y) => {
  await page.mouse.move(...at(x, y));
  await page.mouse.down();
  await page.mouse.up();
};
const dragTo = async (x1, y1, x2, y2) => {
  await page.mouse.move(...at(x1, y1));
  await page.mouse.down();
  await page.mouse.move(...at(x2, y2), { steps: 8 });
  await page.mouse.up();
};

// ── 1. 1px rectangle commits exactly 1px thick, then fills with no halo ───
await page.keyboard.press("r");
await page.locator('button[title="1px"]').click();
await dragTo(100, 100, 300, 200);
const edgeRows = await page.evaluate(() => {
  const d = document
    .querySelectorAll("canvas")[0]
    .getContext("2d")
    .getImageData(150, 90, 1, 20).data;
  const rows = [];
  for (let y = 0; y < 20; y++)
    if (d[y * 4] < 128 && d[y * 4 + 3] > 0) rows.push(90 + y);
  return rows;
});
step(
  "1px rectangle commits exactly 1px",
  edgeRows.length === 1 && edgeRows[0] === 100,
  `dark rows at x=150: [${edgeRows}]`,
);

await page.keyboard.press("f");
await clickAt(200, 150);
const filled = await countPx(0, 150, 140, 20, 20, "dark");
const halo = await countPx(0, 95, 95, 40, 15, "gray");
step(
  "flood fill reaches the 1px border with no halo",
  filled === 400 && halo === 0,
  `filled=${filled}/400 grayHalo=${halo}`,
);

// ── 2. undo removes the fill, redo restores it ─────────────────────────────
await action("undo");
const afterUndo = await countPx(0, 150, 140, 20, 20, "dark");
await action("redo");
const afterRedo = await countPx(0, 150, 140, 20, 20, "dark");
step(
  "undo/redo walk the fill",
  afterUndo === 0 && afterRedo === 400,
  `afterUndo=${afterUndo} afterRedo=${afterRedo}`,
);

// ── 3. eraser cuts hard (no gray fringe a flood fill would halo around) ───
await page.keyboard.press("e");
await dragTo(150, 150, 250, 150);
const wake = await countPx(0, 195, 148, 10, 4, "dark");
const fringe = await countPx(0, 140, 140, 120, 20, "gray");
step(
  "eraser erases hard-edged",
  wake === 0 && fringe === 0,
  `darkInWake=${wake} grayFringe=${fringe}`,
);

// ── 4. eyedropper picks and reverts to the previous tool ──────────────────
await page.keyboard.press("p");
await page.keyboard.press("i");
await clickAt(120, 120); // black from the filled region
const cursorAfter = await page
  .locator("canvas")
  .nth(1)
  .evaluate((el) => getComputedStyle(el).cursor);
await dragTo(500, 400, 540, 400); // pencil should draw again, in black
const drew = await countPx(0, 500, 396, 40, 8, "dark");
step(
  "eyedropper reverts to previous tool",
  cursorAfter === "crosshair" && drew > 20,
  `cursor=${cursorAfter.slice(0, 24)} pencilDrew=${drew}`,
);

// ── 5. polygon: multi-click, close on first vertex, Esc cancels a new one ─
await page.keyboard.press("g");
await dragTo(400, 100, 500, 100);
await clickAt(500, 180);
await clickAt(400, 100); // close
const polyEdge = await countPx(0, 430, 96, 40, 8, "dark");
await page.keyboard.press("g");
await dragTo(600, 100, 700, 100);
await page.keyboard.press("Escape");
const cancelled = await countPx(1, 580, 80, 140, 40, "alpha");
step(
  "polygon closes and Esc cancels",
  polyEdge > 20 && cancelled === 0,
  `edge=${polyEdge} overlayAfterEsc=${cancelled}`,
);

// ── 6. lasso: trace, ants follow the outline, move leaves a shaped hole ───
await page.keyboard.press("w");
const cx = 450, cy = 133, r = 60;
await page.mouse.move(...at(cx + r, cy));
await page.mouse.down();
for (let a = 1; a <= 24; a++) {
  const th = (a / 24) * 2 * Math.PI;
  await page.mouse.move(...at(cx + r * Math.cos(th), cy + r * Math.sin(th)));
}
await page.mouse.up();
await page.waitForTimeout(250);
const antsOn = await countPx(2, cx + 38, cy - 50, 14, 14, "alpha"); // ~45° point
const antsCorner = await countPx(2, cx + r - 8, cy - r - 2, 10, 10, "alpha"); // bbox corner
await dragTo(cx, cy, cx + 200, cy + 300);
await page.keyboard.press("Escape"); // bake the float down
await page.waitForTimeout(100);
// The lifted polygon edges land 200/300 px away; sample generously around the
// destination so minor rasterization differences across Chromium versions
// can't flake the count.
const moved = await countPx(0, cx + 150, cy + 260, 100, 90, "dark");
const holeLeft = await countPx(0, cx - 20, cy - 37, 40, 8, "dark"); // old edge area
step(
  "lasso ants follow outline; move bakes at target",
  antsOn > 0 && antsCorner === 0 && moved > 80 && holeLeft === 0,
  `onOutline=${antsOn} atBboxCorner=${antsCorner} moved=${moved} holeLeft=${holeLeft}`,
);

// ── 6b. the selection survives switching between marquee and lasso ────────
await page.keyboard.press("s");
await dragTo(700, 100, 780, 160);
await page.keyboard.press("w"); // marquee → lasso must NOT bake it down
await page.waitForTimeout(150);
const keptReadout = await page.getByText("⬚").count();
const keptAnts = await countPx(2, 700, 98, 80, 6, "alpha");
await page.keyboard.press("Escape");
step(
  "selection survives marquee ↔ lasso switch",
  keptReadout === 1 && keptAnts > 0,
  `sizeReadout=${keptReadout} ants=${keptAnts}`,
);

// ── 7. text: click, type immediately, switch tool → rasterized ────────────
await page.keyboard.press("t");
await clickAt(100, 400);
await page.keyboard.type("Hi"); // must land in the editor, not tool shortcuts
await page.keyboard.press("p"); // goes into the textarea too…
await action("saveFile"); // …so flush via Save (dialog shim aborts the write)
await page.waitForTimeout(150);
const textPx = await countPx(0, 98, 400, 80, 32, "dark");
step(
  "text editor keeps focus and rasterizes",
  textPx > 20 && (await page.locator("textarea").count()) === 0,
  `rasterized=${textPx}`,
);

// ── 8. canvas corner drag-handle grows the canvas; new area is white ──────
box = await canvasBox();
const corner = page.locator('div[title="Drag to resize the canvas"]').nth(2);
const cb = await corner.boundingBox();
const hx = cb.x + cb.width / 2, hy = cb.y + cb.height / 2;
await page.mouse.move(hx, hy);
await page.mouse.down();
await page.mouse.move(hx + 50, hy + 30, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(150);
const grew = await page.getByText("850 × 630px").count();
const grewWhite = (await countPx(0, 805, 605, 40, 20, "dark")) === 0;
step("corner handle grows the canvas", grew === 1 && grewWhite, `dims=${grew} white=${grewWhite}`);

// ── 9. fit-to-window, ctrl-wheel zoom, space-drag pan ─────────────────────
const zoomText = async () => (await page.locator("span.w-10").textContent()).trim();
await page.keyboard.press("Control+9");
const fit = await zoomText();
box = await canvasBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.keyboard.down("Control");
await page.mouse.wheel(0, -300);
await page.keyboard.up("Control");
await page.waitForTimeout(100);
const wheeled = await zoomText();
const scroll = () =>
  page.evaluate(() => {
    const el = document.querySelector("div.overflow-auto");
    return [el.scrollLeft, el.scrollTop];
  });
await page.evaluate(() => {
  const el = document.querySelector("div.overflow-auto");
  el.scrollLeft = 200;
  el.scrollTop = 200;
});
const [sl0, st0] = await scroll();
await page.keyboard.down("Space");
await page.mouse.move(640, 400);
await page.mouse.down();
await page.mouse.move(560, 340, { steps: 5 });
await page.mouse.up();
await page.keyboard.up("Space");
const [sl1, st1] = await scroll();
step(
  "fit / ctrl-wheel zoom / space-drag pan",
  fit !== "100%" && parseInt(wheeled) > parseInt(fit) && sl1 - sl0 === 80 && st1 - st0 === 60,
  `fit=${fit} wheel=${wheeled} pan=(${sl1 - sl0},${st1 - st0})`,
);

await page.screenshot({ path: path.join(ARTIFACTS, "e2e-final.png") });
await browser.close();
await server.close();

const fails = results.filter((ok) => !ok).length;
console.log(`\n${results.length - fails}/${results.length} e2e checks passed`);
process.exit(fails ? 1 : 0);
