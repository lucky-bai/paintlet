import { usePaintStore } from "../state/store";
import { ZOOM_MAX, ZOOM_MIN, clampZoom } from "../lib/zoom";

// Bottom status bar: cursor coordinates, image dimensions, and a persistent
// zoom slider + percentage on the right — a signature modern-Paint element.
export function StatusBar() {
  const cursorPos = usePaintStore((s) => s.cursorPos);
  const { w, h } = usePaintStore((s) => s.imageSize);
  const selectionSize = usePaintStore((s) => s.selectionSize);
  const zoom = usePaintStore((s) => s.view.zoom);
  const setZoom = usePaintStore((s) => s.setZoom);

  return (
    <div className="flex h-7 shrink-0 items-center gap-4 border-t border-hairline bg-surface px-3 text-xs text-ink-muted">
      <span className="w-28 tabular-nums">
        {cursorPos
          ? `${Math.floor(cursorPos.x)}, ${Math.floor(cursorPos.y)} px`
          : " "}
      </span>
      <span className="tabular-nums">
        {w} × {h}px
      </span>
      {selectionSize && (
        <span className="tabular-nums">
          ⬚ {selectionSize.w} × {selectionSize.h}px
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          title="Zoom out"
          onClick={() => setZoom(clampZoom(zoom - 0.25))}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-hover"
        >
          −
        </button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.25}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-32 accent-[var(--vp-accent)]"
          title={`${Math.round(zoom * 100)}%`}
        />
        <button
          type="button"
          title="Zoom in"
          onClick={() => setZoom(clampZoom(zoom + 0.25))}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-hover"
        >
          +
        </button>
        <span className="w-10 text-right tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
