import { useEffect } from "react";
import { usePaintStore } from "../../state/store";
import type { Theme } from "../../engine/types";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const clampDim = (n: number) => Math.max(1, Math.min(10000, Math.round(n || 1)));

// App preferences (Paintlet → Settings…, ⌘,). Appearance (theme) and the size
// a new image opens at. Both persist across launches (see the store's
// saveSettings). Kept intentionally small — this is a paint app, not an IDE.
export function SettingsDialog() {
  const open = usePaintStore((s) => s.settingsDialogOpen);
  const setOpen = usePaintStore((s) => s.setSettingsDialogOpen);
  const theme = usePaintStore((s) => s.theme);
  const setTheme = usePaintStore((s) => s.setTheme);
  const size = usePaintStore((s) => s.defaultCanvasSize);
  const setSize = usePaintStore((s) => s.setDefaultCanvasSize);

  // Close on Esc — listen on the window since the dialog owns no default focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const close = () => setOpen(false);
  const numberField =
    "no-spinner h-7 w-20 rounded-md border border-hairline bg-work px-2 text-xs text-ink tabular-nums outline-none focus:border-[var(--vp-accent)]";

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={close}
    >
      <div
        className="w-80 rounded-xl border border-hairline bg-surface p-6 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink">Settings</h2>

        {/* Appearance */}
        <div className="mt-4">
          <p className="text-xs font-medium text-ink">Appearance</p>
          <div className="mt-2 flex overflow-hidden rounded-md border border-hairline">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={
                  "flex-1 px-3 py-1.5 text-xs " +
                  (theme === t.id
                    ? "bg-[var(--vp-accent)] text-white"
                    : "text-ink hover:bg-hover")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-ink-muted">
            System follows your macOS light/dark appearance.
          </p>
        </div>

        {/* Default new-image size */}
        <div className="mt-4">
          <p className="text-xs font-medium text-ink">New image size</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10000}
              value={size.w}
              onChange={(e) => setSize({ w: clampDim(Number(e.target.value)), h: size.h })}
              className={numberField}
              title="Width (px)"
              aria-label="Default width"
            />
            <span className="text-xs text-ink-muted">×</span>
            <input
              type="number"
              min={1}
              max={10000}
              value={size.h}
              onChange={(e) => setSize({ w: size.w, h: clampDim(Number(e.target.value)) })}
              className={numberField}
              title="Height (px)"
              aria-label="Default height"
            />
            <span className="text-xs text-ink-muted">px</span>
          </div>
          <p className="mt-1 text-[10px] text-ink-muted">
            Used when you create a new image (File → New).
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={close}
            className="rounded-md bg-[var(--vp-accent)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
