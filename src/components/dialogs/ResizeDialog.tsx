import { useEffect, useState } from "react";
import { engine, usePaintStore } from "../../state/store";

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

  const [width, setWidth] = useState(w);
  const [height, setHeight] = useState(h);
  const [lock, setLock] = useState(true);
  const [smooth, setSmooth] = useState(true);

  // Seed the fields with the current size each time the dialog opens.
  useEffect(() => {
    if (open) {
      setWidth(w);
      setHeight(h);
    }
  }, [open, w, h]);

  if (!open) return null;

  const aspect = w / h;
  const changeW = (val: number) => {
    setWidth(val);
    if (lock) setHeight(Math.max(MIN, Math.round(val / aspect)));
  };
  const changeH = (val: number) => {
    setHeight(val);
    if (lock) setWidth(Math.max(MIN, Math.round(val * aspect)));
  };

  const close = () => setOpen(false);
  const apply = () => {
    engine.resizeImage(clamp(width), clamp(height), smooth);
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

        <label className="mb-2 flex items-center justify-between text-xs text-ink-muted">
          Width
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={MIN}
              max={MAX}
              value={width}
              autoFocus
              onChange={(e) => changeW(Number(e.target.value))}
              className="w-20 rounded border border-hairline bg-work px-2 py-1 text-right text-xs text-ink tabular-nums outline-none focus:border-[var(--vp-accent)]"
            />
            px
          </span>
        </label>

        <label className="mb-3 flex items-center justify-between text-xs text-ink-muted">
          Height
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={MIN}
              max={MAX}
              value={height}
              onChange={(e) => changeH(Number(e.target.value))}
              className="w-20 rounded border border-hairline bg-work px-2 py-1 text-right text-xs text-ink tabular-nums outline-none focus:border-[var(--vp-accent)]"
            />
            px
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
