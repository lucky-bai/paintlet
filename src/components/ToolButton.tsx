import type { ReactNode } from "react";
import { cx } from "../lib/cx";

// A single square icon button. Hover = subtle fill; active = accent-tint fill
// (the modern-Paint active-tool cue); disabled = greyed. Used for tools, shapes,
// and undo/redo alike.
export function ToolButton({
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        disabled
          ? "opacity-30"
          : active
            ? "bg-accent/15 text-accent"
            : "text-ink hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
