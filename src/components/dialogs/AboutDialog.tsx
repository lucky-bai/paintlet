import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePaintStore } from "../../state/store";
import { Logo } from "../Logo";

const REPO_URL = "https://github.com/lucky-bai/paintlet";

// Modal for Paintlet → About. App mark, version, a link to the GitHub repo,
// and the standard license line.
export function AboutDialog() {
  const open = usePaintStore((s) => s.aboutDialogOpen);
  const setOpen = usePaintStore((s) => s.setAboutDialogOpen);
  const [version, setVersion] = useState("");

  // The bundle version comes from tauri.conf.json via an async API; fetch it
  // once the dialog first opens.
  useEffect(() => {
    if (!open || version) return;
    getVersion().then(setVersion).catch(() => {});
  }, [open, version]);

  // Close on Esc — the dialog has no focused field, so listen on the window.
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

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={close}
    >
      <div
        className="flex w-72 flex-col items-center rounded-xl border border-hairline bg-surface p-6 text-center shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Logo size={64} />
        <h2 className="mt-3 text-base font-semibold text-ink">Paintlet</h2>
        {version && (
          <p className="mt-0.5 text-xs text-ink-muted">Version {version}</p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          An MS Paint-style image editor for macOS.
        </p>

        <button
          type="button"
          onClick={() => openUrl(REPO_URL)}
          className="mt-3 text-xs text-[var(--vp-accent)] hover:underline"
        >
          github.com/lucky-bai/paintlet
        </button>

        <p className="mt-3 text-[10px] leading-relaxed text-ink-muted">
          © 2026 Bai Li. Released under the MIT License.
        </p>

        <button
          type="button"
          onClick={close}
          className="mt-4 rounded-md bg-[var(--vp-accent)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          OK
        </button>
      </div>
    </div>
  );
}
