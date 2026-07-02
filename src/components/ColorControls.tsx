import { usePaintStore } from "../state/store";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";

// Classic MS Paint default palette.
const PALETTE = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27",
  "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4",
  "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9", "#ffc90e",
  "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7",
];

// Color 1 / Color 2 overlapping swatches (each opens the native macOS color
// panel via <input type="color">), a swap control, and the palette grid.
// Left-click a swatch = Color 1; right-click = Color 2 (kept from Paint).
export function ColorControls() {
  const color1 = usePaintStore((s) => s.color1);
  const color2 = usePaintStore((s) => s.color2);
  const setColor1 = usePaintStore((s) => s.setColor1);
  const setColor2 = usePaintStore((s) => s.setColor2);
  const swapColors = usePaintStore((s) => s.swapColors);

  return (
    <div className="flex items-center gap-3">
      {/* Overlapping Color 1 (front) / Color 2 (back) indicator. */}
      <div className="relative h-9 w-9 shrink-0">
        <label
          className="absolute bottom-0 right-0 h-6 w-6 cursor-pointer rounded border border-hairline"
          style={{ background: color2 }}
          title="Color 2 (right-click a swatch, or click to edit)"
        >
          <input
            type="color"
            value={color2}
            onChange={(e) => setColor2(e.target.value)}
            className="sr-only"
          />
        </label>
        <label
          className="absolute left-0 top-0 h-6 w-6 cursor-pointer rounded border border-hairline shadow-sm"
          style={{ background: color1 }}
          title="Color 1 (click to edit)"
        >
          <input
            type="color"
            value={color1}
            onChange={(e) => setColor1(e.target.value)}
            className="sr-only"
          />
        </label>
      </div>

      <button
        type="button"
        title="Swap colors"
        aria-label="Swap colors"
        onClick={swapColors}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-hover"
      >
        <Icon name="swap" size={16} />
      </button>

      {/* Palette grid: left-click → Color 1, right-click → Color 2. */}
      <div className="grid grid-cols-10 gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setColor1(c)}
            onContextMenu={(e) => {
              e.preventDefault();
              setColor2(c);
            }}
            className={cx(
              "h-4 w-4 rounded-[3px] border border-hairline transition-transform",
              "hover:scale-110",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
