import { usePaintStore } from "../state/store";
import { Logo } from "./Logo";

// Slim draggable strip under the traffic lights. With titleBarStyle "Overlay"
// the window content extends to the top edge and the traffic lights float over
// this strip's left side; the centered document title clears them. The whole
// strip is a Tauri drag region so the window moves when dragged here.
export function TitleBar() {
  const filePath = usePaintStore((s) => s.filePath);
  const isDirty = usePaintStore((s) => s.isDirty);
  const name = filePath ? filePath.split("/").pop() : "untitled.png";

  return (
    <div
      data-tauri-drag-region
      className="flex h-7 shrink-0 items-center justify-center gap-1.5 bg-surface text-xs text-ink-muted"
    >
      <Logo size={15} />
      <span data-tauri-drag-region>
        {isDirty ? "• " : ""}VibePaint — {name}
      </span>
    </div>
  );
}
