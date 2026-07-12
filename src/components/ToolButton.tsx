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
        // Keyboard focus ring for non-mouse navigation (invisible to pointer
        // users via :focus-visible).
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
        disabled
          ? "opacity-30"
          : active
            ? // Clear filled active state (matches the shape-size picker) with a
              // ring, so the selected tool reads at a glance in light and dark.
              "bg-accent/20 text-accent ring-1 ring-inset ring-accent/50"
            : "text-ink hover:bg-hover",
      )}
    >
      {children}
    </button>
  );
}
