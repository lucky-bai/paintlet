import { useEffect, useState } from "react";
import { engine, usePaintStore } from "../../state/store";
import { cx } from "../../lib/cx";

const MIN = 1;
const MAX = 8192;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, Math.round(n || MIN)));

// Modal for Image → Resize. Scales the whole image to new pixel dimensions,
// optionally locking the aspect ratio and choosing smooth (bilinear) vs
// nearest-neighbor resampling.
export function ResizeDialog() {
  const open = usePaintStore((s) => s.resizeDialogOpen);
  const setOpen = usePaintStore((s) => s.setResizeDialogOpen);
  const { w, h } = usePaintStore((s) => s.imageSize);

  const [unit, setUnit] = useState<"px" | "pct">("px");
  const [width, setWidth] = useState(w);
  const [height, setHeight] = useState(h);
  const [lock, setLock] = useState(true);
  const [smooth, setSmooth] = useState(true);

  // Seed the fields whenever the dialog opens or the unit switches: pixels show
  // the current dimensions; percent starts at 100.
  useEffect(() => {
    if (!open) return;
    if (unit === "px") {
      setWidth(w);
      setHeight(h);
    } else {
      setWidth(100);
      setHeight(100);
    }
  }, [open, unit, w, h]);

  if (!open) return null;

  const aspect = w / h;
  // With the ratio locked, pixels preserve the aspect; percent scales uniformly.
  const changeW = (val: number) => {
    setWidth(val);
    if (!lock) return;
    setHeight(unit === "px" ? Math.max(MIN, Math.round(val / aspect)) : val);
  };
  const changeH = (val: number) => {
    setHeight(val);
    if (!lock) return;
    setWidth(unit === "px" ? Math.max(MIN, Math.round(val * aspect)) : val);
  };

  const close = () => setOpen(false);
  const apply = () => {
    const px =
      unit === "px"
        ? { w: width, h: height }
        : { w: (w * width) / 100, h: (h * height) / 100 };
    engine.resizeImage(clamp(px.w), clamp(px.h), smooth);
    close();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={close}
    >
      <div
        className="w-72 rounded-xl border border-hairline bg-surface p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
          else if (e.key === "Escape") close();
        }}
      >
        <h2 className="mb-3 text-sm font-semibold text-ink">Resize image</h2>

        <div className="mb-3 flex gap-1">
          {(["px", "pct"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={cx(
                "flex-1 rounded-md px-2.5 py-1 text-xs",
                unit === u
                  ? "bg-[var(--vp-accent)] text-white"
                  : "text-ink hover:bg-hover",
              )}
            >
              {u === "px" ? "Pixels" : "Percent"}
            </button>
          ))}
        </div>

        <label className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          Width
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={MIN}
              max={unit === "px" ? MAX : 1000}
              value={width}
              autoFocus
              onChange={(e) => changeW(Number(e.target.value))}
              className="w-20 rounded border border-hairline bg-work px-2 py-1 text-right text-xs text-ink tabular-nums outline-none focus:border-[var(--vp-accent)]"
            />
            {unit === "px" ? "px" : "%"}
          </span>
        </label>

        <label className="mb-3 flex items-center justify-between text-xs text-ink-muted">
          Height
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={MIN}
              max={unit === "px" ? MAX : 1000}
              value={height}
              onChange={(e) => changeH(Number(e.target.value))}
              className="w-20 rounded border border-hairline bg-work px-2 py-1 text-right text-xs text-ink tabular-nums outline-none focus:border-[var(--vp-accent)]"
            />
            {unit === "px" ? "px" : "%"}
          </span>
        </label>

        <label className="mb-1.5 flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={lock}
            onChange={(e) => setLock(e.target.checked)}
          />
          Maintain aspect ratio
        </label>
        <label className="mb-4 flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={smooth}
            onChange={(e) => setSmooth(e.target.checked)}
          />
          Smooth (resample)
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-1.5 text-xs text-ink hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-md bg-[var(--vp-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Resize
          </button>
        </div>
      </div>
    </div>
  );
}
