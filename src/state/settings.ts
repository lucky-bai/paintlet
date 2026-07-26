import type { Theme } from "../engine/types";

// Persisted app settings, stored in localStorage so they survive across
// launches. Just the theme — Paint has no preferences window, and theme is the
// one thing a macOS app is expected to let you pin.
//
// This module is deliberately free of any engine or store import: the About
// window is a separate webview that needs the theme but must NOT instantiate a
// CanvasEngine (that would allocate a full set of canvases in a window that
// only shows a logo and a version string). Keeping the read/write helpers here
// lets both windows share one key and one validation path.

export const SETTINGS_KEY = "paintlet.settings";

export interface PersistedSettings {
  theme: Theme;
}

const DEFAULTS: PersistedSettings = { theme: "system" };

const isTheme = (t: unknown): t is Theme =>
  t === "light" || t === "dark" || t === "system";

// Read and validate the persisted blob. Every access is guarded so non-browser
// contexts (unit tests) and storage-denied webviews fall back silently.
export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<PersistedSettings>;
    return { theme: isTheme(p.theme) ? p.theme : DEFAULTS.theme };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings just won't persist this session */
  }
}
