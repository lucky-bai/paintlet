import { usePaintStore } from "../../state/store";
import type { Theme } from "../../engine/types";
import { DialogFrame } from "./DialogFrame";
import { SegmentedControl } from "../SegmentedControl";

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

// App preferences (Paintlet → Settings…, ⌘,). Appearance only, and persisted
// across launches (see state/settings). Paint has no preferences window at all,
// so anything here is already a departure — theme earns its place because macOS
// apps are expected to offer it, and nothing else has.
export function SettingsDialog() {
  const open = usePaintStore((s) => s.settingsDialogOpen);
  const setOpen = usePaintStore((s) => s.setSettingsDialogOpen);
  const theme = usePaintStore((s) => s.theme);
  const setTheme = usePaintStore((s) => s.setTheme);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <DialogFrame title="Settings" onClose={close} className="w-80">
      <p className="text-xs font-medium text-ink">Appearance</p>
      <SegmentedControl
        className="mt-2"
        ariaLabel="Appearance"
        value={theme}
        options={THEMES}
        onChange={setTheme}
      />
      <p className="mt-1 text-[10px] text-ink-muted">
        System follows your macOS light/dark appearance.
      </p>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={close}
          className="rounded-md bg-[var(--vp-accent)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          Done
        </button>
      </div>
    </DialogFrame>
  );
}
