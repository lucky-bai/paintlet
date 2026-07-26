import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Logo } from "./Logo";

const REPO_URL = "https://github.com/lucky-bai/paintlet";

// Contents of the About window (Paintlet → About Paintlet).
//
// Unlike Resize/Settings/Edit Color this is a real macOS window, not a DOM
// panel, because that's the platform convention for an About box: it gets a
// native title bar, a real close button, a Window-menu entry, and can be moved
// to another display. It's also the only dialog where that's cheap — it reads
// nothing from the CanvasEngine, so there is no IPC contract to maintain. Its
// only inputs are the bundle version and the persisted theme.
export function AboutWindow() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  // Esc closes, matching every other dialog in the app. The native red button
  // and ⌘W (File → Close Window) already work for free.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().close().catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-surface px-6 py-5 text-center text-ink select-none">
      <Logo size={64} />
      <h1 className="mt-3 text-base font-semibold">Paintlet</h1>
      {version && <p className="mt-0.5 text-xs text-ink-muted">Version {version}</p>}
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
    </div>
  );
}
