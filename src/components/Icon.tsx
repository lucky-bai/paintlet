import type { ReactNode } from "react";

// Minimal stroke-based icon set (Lucide-style geometry). Inline SVG rather than
// a font so glyphs render identically across the webview and inherit
// currentColor — the clean, consistent look the "macOS clothing" goal wants.
export type IconName =
  | "undo"
  | "redo"
  | "pencil"
  | "brush"
  | "fill"
  | "text"
  | "eraser"
  | "eyedropper"
  | "line"
  | "rectangle"
  | "ellipse"
  | "swap";

const PATHS: Record<IconName, ReactNode> = {
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  pencil: (
    <>
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </>
  ),
  brush: (
    <>
      <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
      <path d="M9 8c-2 3-4 3.5-7 4l8 8c1-3 1.5-5 4-7" />
      <path d="M14.5 17.5 4.5 15" />
    </>
  ),
  fill: (
    <>
      <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0L19 11Z" />
      <path d="m5 2 5 5" />
      <path d="M2 13h15" />
      <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
    </>
  ),
  text: (
    <>
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </>
  ),
  eraser: (
    <>
      <path d="m7 21-4.3-4.3a1.7 1.7 0 0 1 0-2.4l9.3-9.3a1.7 1.7 0 0 1 2.4 0l5.6 5.6a1.7 1.7 0 0 1 0 2.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </>
  ),
  eyedropper: (
    <>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </>
  ),
  line: <path d="M5 19 19 5" />,
  rectangle: <rect x="3" y="4" width="18" height="16" rx="1.5" />,
  ellipse: <circle cx="12" cy="12" r="9" />,
  swap: (
    <>
      <path d="M7 4 4 7l3 3" />
      <path d="M4 7h13" />
      <path d="m17 20 3-3-3-3" />
      <path d="M20 17H7" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
