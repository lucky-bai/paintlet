import { useEffect, useState } from "react";
import { usePaintStore } from "../state/store";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";
import { ColorPicker } from "./ColorPicker";

// Classic MS Paint default palette (two rows of ten).
const PALETTE = [
  "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27",
  "#fff200", "#22b14c", "#00a2e8", "#3f48cc", "#a349a4",
  "#ffffff", "#c3c3c3", "#b97a57", "#ffaec9", "#ffc90e",
  "#efe4b0", "#b5e61d", "#99d9ea", "#7092be", "#c8bfe7",
];

// Color 1 / Color 2 swatches + the palette grid. Clicking a swatch opens an
// in-app picker popover (no native system color panel). Left-click a palette
// chip = Color 1; right-click = Color 2 (kept from Paint).
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
      onClick={() => setEditing((e) => (e === which ? null : which))}
      className={cx(
        "h-8 w-8 rounded-md border shadow-sm",
        editing === which
          ? "border-accent ring-2 ring-accent/50"
          : "border-hairline",
      )}
      style={{ background: which === "color1" ? color1 : color2 }}
    />
  );

  return (
    <div className="relative flex items-center gap-3">
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

      {/* Palette grid: left-click → Color 1, right-click → Color 2. */}
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

      {editing && (
        <>
          {/* Outside-click catcher. */}
          <div className="fixed inset-0 z-40" onClick={() => setEditing(null)} />
          <div className="absolute right-0 top-full z-50 mt-2 rounded-lg border border-hairline bg-surface p-3 shadow-xl">
            <ColorPicker
              value={editing === "color1" ? color1 : color2}
              onChange={(hex) =>
                editing === "color1" ? setColor1(hex) : setColor2(hex)
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
