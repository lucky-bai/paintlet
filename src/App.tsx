import { useEffect } from "react";
import { engine, usePaintStore } from "./state/store";
import { TitleBar } from "./components/TitleBar";
import { Toolbar } from "./components/Toolbar";
import { CanvasStage } from "./components/CanvasStage";
import { StatusBar } from "./components/StatusBar";

function App() {
  const theme = usePaintStore((s) => s.theme);

  // Resolve theme → data-theme on <html>. "system" follows the OS and updates
  // live when the user flips appearance.
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.setAttribute("data-theme", dark ? "dark" : "light");
    };
    apply();
    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  // Global undo/redo shortcuts. Native menu wiring lands in M2; this makes
  // ⌘Z / ⇧⌘Z work today.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) engine.redo();
        else engine.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-surface text-ink">
      <TitleBar />
      <Toolbar />
      <CanvasStage />
      <StatusBar />
    </div>
  );
}

export default App;
