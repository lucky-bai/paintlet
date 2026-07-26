import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../../lib/cx";

// Shared chrome for Paintlet's in-app modal dialogs (Resize, Settings, Edit
// Color). These are DOM panels rather than real OS windows — the document lives
// in this webview's CanvasEngine, so a separate window could only reach it over
// IPC, which buys nothing for a modal. What they were missing is the one thing
// people actually notice about a real window: being able to move it. This frame
// supplies a grab-handle title bar, a close button, and clamped drag.
//
// The About window is deliberately NOT one of these — see AboutWindow.

// How much of the panel must stay on screen horizontally, so a panel can never
// be dragged so far that there's no header left to grab it by.
const MIN_VISIBLE_X = 80;

interface Offset {
  x: number;
  y: number;
}

// Press-drag on the header, clamped to the window. Pointer capture keeps the
// gesture alive when the cursor outruns the header (or leaves the window), which
// is the difference between a drag that feels native and one that keeps
// "slipping" — the same reason CanvasStage captures for its resize handles.
function useDialogDrag() {
  // Offset from the flex-centered resting position. State (not a ref) because
  // the transform is rendered; the panel starts centered every time the dialog
  // mounts, and since each dialog returns null when closed, reopening it
  // remounts and re-centers for free.
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore anything but the primary button, and let the close button (or any
      // other control placed in the header) handle its own clicks.
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;

      e.preventDefault(); // suppress text selection while dragging
      const handle = e.currentTarget as HTMLElement;
      handle.setPointerCapture(e.pointerId);

      const start = { x: e.clientX, y: e.clientY };
      const from = offset;
      const rect = panelRef.current?.getBoundingClientRect();

      // Precompute the offset range that keeps the panel usable. Derived from
      // the rect at drag start, which already includes the current offset — so
      // the bounds are expressed relative to `from`.
      const limit = rect
        ? {
            minX: from.x - rect.left - rect.width + MIN_VISIBLE_X,
            maxX: from.x + (window.innerWidth - rect.left - MIN_VISIBLE_X),
            // Never above the top edge (the header would go under the title
            // bar), never below the bottom edge.
            minY: from.y - rect.top,
            maxY: from.y + (window.innerHeight - rect.top - rect.height),
          }
        : null;

      const clamp = (n: number, lo: number, hi: number) =>
        // A panel taller than the window makes maxY < minY; pin to the top
        // rather than letting the clamp invert.
        hi < lo ? lo : Math.max(lo, Math.min(hi, n));

      const move = (ev: PointerEvent) => {
        const next = {
          x: from.x + (ev.clientX - start.x),
          y: from.y + (ev.clientY - start.y),
        };
        setOffset(
          limit
            ? {
                x: clamp(next.x, limit.minX, limit.maxX),
                y: clamp(next.y, limit.minY, limit.maxY),
              }
            : next,
        );
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
      };
      // Listen on the capturing element, not the window: with pointer capture
      // active every move retargets here anyway, and this way the listeners are
      // torn down with the element if the dialog closes mid-drag.
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    },
    [offset],
  );

  return { offset, panelRef, onHeaderPointerDown };
}

export function DialogFrame({
  title,
  onClose,
  children,
  className,
  onKeyDown,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Width (and any other sizing) for the panel, e.g. "w-72". */
  className?: string;
  /** Optional key handling for the panel, e.g. Enter to confirm. */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const { offset, panelRef, onHeaderPointerDown } = useDialogDrag();

  // Esc closes, listened for on the window rather than on the panel. A
  // panel-level onKeyDown only fires while focus is inside the panel, and
  // clicking any dead space in the body — the padding, a label — is a mousedown
  // on a non-focusable div, which drops focus to <body> and silently kills the
  // shortcut from then on. Every DialogFrame is modal, so nothing else is
  // competing for the key.
  //
  // Held in a ref so the listener isn't torn down and re-added on every parent
  // render (ColorControls re-renders on each drag frame of the color picker).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // Scrim: dims the app and closes on click-away. A drag that happens to end
    // over the scrim can't close the dialog, because the gesture's mousedown
    // landed on the header (inside the panel) and never reaches here.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl",
          className,
        )}
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Title bar: the grab handle. Mirrors the main window's own title
            strip — centered label, hairline separator underneath. */}
        <div
          onPointerDown={onHeaderPointerDown}
          className="relative flex cursor-grab items-center gap-2 border-b border-hairline bg-surface-raised px-3 py-2 select-none active:cursor-grabbing"
        >
          <h2 className="flex-1 text-center text-xs font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            data-no-drag
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
          >
            <Icon name="close" size={13} />
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
