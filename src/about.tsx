import React from "react";
import ReactDOM from "react-dom/client";
import { AboutWindow } from "./components/AboutWindow";
import { applyTheme } from "./lib/theme";
import { loadSettings } from "./state/settings";
import "./styles/index.css";

// Entry point for the About window's webview (about.html).
//
// Deliberately separate from main.tsx: a second entry keeps the whole editor —
// App, CanvasEngine, the tool registry — out of this window's bundle. Booting
// main.tsx here would allocate a full set of canvases for a panel that shows a
// logo and a version string.
//
// Theme comes from localStorage rather than IPC. Both windows are the same
// origin, so they share the storage area, which means no event contract to keep
// in sync. Applied before render so there's no flash of light-mode chrome.
applyTheme(loadSettings().theme);

// Follow the setting if the user changes it in Settings while this window is
// open. The `storage` event fires in same-origin documents other than the one
// that wrote, which covers exactly this case. Best-effort: if the webview
// doesn't deliver it, the theme is still correct on next open.
window.addEventListener("storage", () => applyTheme(loadSettings().theme));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AboutWindow />
  </React.StrictMode>,
);
