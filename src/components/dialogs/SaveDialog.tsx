import { useEffect, useState } from "react";
import { usePaintStore } from "../../state/store";
import { cx } from "../../lib/cx";
import { currentFormat, saveWithFormat, type SaveFormat } from "../../io/fileIO";

// Modal shown on Save (new document) and Save As. The format is an explicit
// choice — PNG or JPEG — so the user never has to guess it from a typed
// extension; JPEG also exposes a quality slider. Picking a destination still
// uses the native panel, now filtered to just the chosen format.
export function SaveDialog() {
  const open = usePaintStore((s) => s.saveDialogOpen);
  const setOpen = usePaintStore((s) => s.setSaveDialogOpen);

  const [format, setFormat] = useState<SaveFormat>("png");
  const [quality, setQuality] = useState(92);

  // Seed the format from the current file whenever the dialog opens.
  useEffect(() => {
    if (open) setFormat(currentFormat());
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);
  const confirm = async () => {
    // Close first so the native destination panel isn't behind our modal.
    setOpen(false);
    await saveWithFormat(format, quality);
  };

  const FORMATS: { id: SaveFormat; label: string; hint: string }[] = [
    { id: "png", label: "PNG", hint: "Lossless — best for drawings and text" },
    { id: "jpeg", label: "JPEG", hint: "Smaller — best for photos" },
  ];

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={close}
    >
      <div
        className="w-80 rounded-xl border border-hairline bg-surface p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void confirm();
          else if (e.key === "Escape") close();
        }}
      >
        <h2 className="mb-3 text-sm font-semibold text-ink">Save image</h2>

        <label className="mb-1 block text-xs text-ink-muted">Format</label>
        <select
          value={format}
          autoFocus
          onChange={(e) => setFormat(e.target.value as SaveFormat)}
          className="mb-1.5 w-full rounded-md border border-hairline bg-work px-2 py-1.5 text-sm text-ink outline-none focus:border-[var(--vp-accent)]"
        >
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="mb-3 text-[11px] text-ink-muted">
          {FORMATS.find((f) => f.id === format)!.hint}
        </p>

        {format === "jpeg" && (
          <label className="mb-4 flex items-center justify-between gap-2 text-xs text-ink-muted">
            Quality
            <span className="flex items-center gap-2">
              <input
                type="range"
                min={10}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-32 accent-[var(--vp-accent)]"
              />
              <span className="w-8 text-right tabular-nums">{quality}%</span>
            </span>
          </label>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-1.5 text-xs text-ink hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            className={cx(
              "rounded-md bg-[var(--vp-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90",
            )}
          >
            Choose Location…
          </button>
        </div>
      </div>
    </div>
  );
}
