import { useEffect, useState } from "react";
import { usePaintStore } from "../state/store";
import { cx } from "../lib/cx";
import { PALETTE } from "../lib/palette";
import { Icon } from "./Icon";
import { ColorPicker } from "./ColorPicker";

// Color 1 / Color 2 swatches + a quick palette grid. Clicking a swatch opens
// the full color chooser in a popup. Left-click a palette chip = Color 1;
// right-click = Color 2 (kept from Paint).
export function ColorControls() {
  const color1 = usePaintStore((s) => s.color1);
  const color2 = usePaintStore((s) => s.color2);
  const setColor1 = usePaintStore((s) => s.setColor1);
  const setColor2 = usePaintStore((s) => s.setColor2);
  const swapColors = usePaintStore((s) => s.swapColors);

  const [editing, setEditing] = useState<"color1" | "color2" | null>(null);

  // Esc closes the picker.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const Swatch = ({ which }: { which: "color1" | "color2" }) => (
    <button
      type="button"
      title={
        which === "color1"
          ? "Color 1 (foreground) — click to edit"
          : "Color 2 (background) — click to edit"
      }
      onClick={() => setEditing(which)}
      className={cx(
        "h-8 w-8 rounded-md border shadow-sm",
        editing === which ? "border-accent ring-2 ring-accent/50" : "border-hairline",
      )}
      style={{ background: which === "color1" ? color1 : color2 }}
    />
  );

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Swatch which="color1" />
        <Swatch which="color2" />
        <button
          type="button"
          title="Swap colors"
          aria-label="Swap colors"
          onClick={swapColors}
          className="flex h-7 w-6 items-center justify-center rounded-md text-ink-muted hover:bg-hover"
        >
          <Icon name="swap" size={15} />
        </button>
      </div>

      {/* Quick palette grid: left-click → Color 1, right-click → Color 2. */}
      <div className="grid grid-cols-10 gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            title={`${c} — click for Color 1, right-click for Color 2`}
            onClick={() => setColor1(c)}
            onContextMenu={(e) => {
              e.preventDefault();
              setColor2(c);
            }}
            className="h-4 w-4 rounded-[3px] border border-hairline transition-transform hover:scale-110"
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Full color chooser, shown as a centered popup. */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onMouseDown={() => setEditing(null)}
        >
          <div
            className="rounded-xl border border-hairline bg-surface p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">
                Edit {editing === "color1" ? "Color 1" : "Color 2"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md bg-[var(--vp-accent)] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Done
              </button>
            </div>
            <ColorPicker
              value={editing === "color1" ? color1 : color2}
              onChange={(hex) => (editing === "color1" ? setColor1(hex) : setColor2(hex))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
