import type { Theme } from "../engine/types";

// Resolve a Theme setting onto <html data-theme> and keep it live.
//
// Shared by both webviews: the main window drives it from the store, and the
// About window drives it from localStorage. Each Tauri window is its own
// webview with its own document, so a new window starts with no data-theme at
// all — without this it would render light-mode colors until something set the
// attribute, producing a visible flash.
//
// Returns a cleanup function that detaches the media-query listener.
export function applyTheme(theme: Theme): () => void {
  const root = document.documentElement;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = () => {
    const dark = theme === "dark" || (theme === "system" && mq.matches);
    root.setAttribute("data-theme", dark ? "dark" : "light");
  };
  apply();

  // Only "system" needs to track the OS appearance; explicit light/dark is fixed.
  if (theme !== "system") return () => {};
  mq.addEventListener("change", apply);
  return () => mq.removeEventListener("change", apply);
}
