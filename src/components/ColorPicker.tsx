import { useRef, useState } from "react";
import {
  hexToRgba,
  hsvToRgb,
  isHexColor,
  rgbToHex,
  rgbToHsv,
} from "../engine/color";

// An in-app color picker popover: a saturation/value area, a hue slider, and a
// hex field — all inside the app window. This replaces <input type="color">,
// whose native macOS panel opens as a separate, awkwardly-placed window.
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  // Local HSV so dragging through greys/blacks (where hue/sat are ambiguous)
  // doesn't snap the hue around. Seeded once from the incoming color.
  const [hsv, setHsv] = useState(() => {
    const [r, g, b] = hexToRgba(value);
    return rgbToHsv(r, g, b);
  });
  const [hexText, setHexText] = useState(value);

  const emit = (h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    setHexText(hex);
    onChange(hex);
  };

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const dragSV = (e: React.PointerEvent) => {
    const el = svRef.current!;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const next = { ...hsv, s, v };
    setHsv(next);
    emit(next.h, s, v);
  };
  const dragHue = (e: React.PointerEvent) => {
    const el = hueRef.current!;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(359.999, ((e.clientX - rect.left) / rect.width) * 360));
    const next = { ...hsv, h };
    setHsv(next);
    emit(h, next.s, next.v);
  };
  // Shared press-drag: capture the pointer so the drag continues off the widget.
  const press = (handler: (e: React.PointerEvent) => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handler(e);
    const move = (ev: PointerEvent) => handler(ev as unknown as React.PointerEvent);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const hueColor = rgbToHex(...hsvToRgb(hsv.h, 1, 1));
  const current = rgbToHex(...hsvToRgb(hsv.h, hsv.s, hsv.v));

  return (
    <div className="flex w-52 flex-col gap-2">
      {/* Saturation (x) / value (y) area. */}
      <div
        ref={svRef}
        onPointerDown={press(dragSV)}
        className="relative h-32 w-full cursor-crosshair rounded"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hueColor}`,
        }}
      >
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            background: current,
          }}
        />
      </div>

      {/* Hue slider. */}
      <div
        ref={hueRef}
        onPointerDown={press(dragHue)}
        className="relative h-3 w-full cursor-ew-resize rounded"
        style={{
          background:
            "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
        />
      </div>

      {/* Hex field + live swatch. */}
      <div className="flex items-center gap-2">
        <div
          className="h-6 w-6 shrink-0 rounded border border-hairline"
          style={{ background: current }}
        />
        <input
          type="text"
          value={hexText}
          spellCheck={false}
          onChange={(e) => {
            const t = e.target.value;
            setHexText(t);
            if (isHexColor(t)) {
              const hex = t.startsWith("#") ? t : `#${t}`;
              const [r, g, b] = hexToRgba(hex);
              setHsv(rgbToHsv(r, g, b));
              onChange(rgbToHex(r, g, b));
            }
          }}
          className="w-full rounded border border-hairline bg-surface px-2 py-1 text-xs tabular-nums text-ink outline-none focus:border-[var(--vp-accent)]"
        />
      </div>
    </div>
  );
}
