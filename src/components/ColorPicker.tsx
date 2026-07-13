import { useRef, useState } from "react";
import {
  hexToRgba,
  hsvToRgb,
  isHexColor,
  rgbToHex,
  rgbToHsv,
} from "../engine/color";
import { PALETTE } from "../lib/palette";

// One R/G/B channel field (0–255). Module-level so typing doesn't remount it
// and drop focus.
function RgbField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-1 items-center gap-1 text-[11px] text-ink-muted">
      {label}
      <input
        type="number"
        min={0}
        max={255}
        value={value}
        onChange={(e) =>
          onChange(Math.max(0, Math.min(255, Math.round(Number(e.target.value) || 0))))
        }
        className="w-full rounded border border-hairline bg-work px-1 py-1 text-center text-xs tabular-nums text-ink outline-none focus:border-[var(--vp-accent)]"
      />
    </label>
  );
}

// The full color chooser: a saturation/value rainbow area, a hue slider, the
// basic MS Paint palette, and both hex and RGB (0–255) fields — so a color can
// be dialed in visually, picked from the palette, or typed numerically. Shown
// in a popup (see ColorControls), not inline.
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

  const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const rgb = { r: Math.round(r), g: Math.round(g), b: Math.round(b) };

  // Push a concrete RGB out: update the hex field, keep HSV, notify the parent.
  const emitRgb = (nr: number, ng: number, nb: number) => {
    const hex = rgbToHex(nr, ng, nb);
    setHexText(hex);
    setHsv(rgbToHsv(nr, ng, nb));
    onChange(hex);
  };
  const emitHsv = (h: number, s: number, v: number) => {
    const [er, eg, eb] = hsvToRgb(h, s, v);
    const hex = rgbToHex(er, eg, eb);
    setHexText(hex);
    onChange(hex);
  };

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const dragSV = (e: React.PointerEvent) => {
    const rect = svRef.current!.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setHsv((p) => ({ ...p, s, v }));
    emitHsv(hsv.h, s, v);
  };
  const dragHue = (e: React.PointerEvent) => {
    const rect = hueRef.current!.getBoundingClientRect();
    const h = Math.max(0, Math.min(359.999, ((e.clientX - rect.left) / rect.width) * 360));
    setHsv((p) => ({ ...p, h }));
    emitHsv(h, hsv.s, hsv.v);
  };
  // Shared press-drag: capture the pointer so the drag continues off the widget.
  const press =
    (handler: (e: React.PointerEvent) => void) => (e: React.PointerEvent) => {
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

  const setFromHex = (hex: string) => {
    const [hr, hg, hb] = hexToRgba(hex);
    setHexText(rgbToHex(hr, hg, hb));
    setHsv(rgbToHsv(hr, hg, hb));
    onChange(rgbToHex(hr, hg, hb));
  };

  const hueColor = rgbToHex(...hsvToRgb(hsv.h, 1, 1));
  const current = rgbToHex(rgb.r, rgb.g, rgb.b);

  return (
    <div className="flex w-64 flex-col gap-2.5">
      {/* Saturation (x) / value (y) rainbow area. */}
      <div
        ref={svRef}
        onPointerDown={press(dragSV)}
        className="relative h-36 w-full cursor-crosshair rounded"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hueColor}`,
        }}
      >
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }}
        />
      </div>

      {/* Hue slider. */}
      <div
        ref={hueRef}
        onPointerDown={press(dragHue)}
        className="relative h-3.5 w-full cursor-ew-resize rounded"
        style={{
          background:
            "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white shadow"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
        />
      </div>

      {/* Basic palette. */}
      <div className="grid grid-cols-10 gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setFromHex(c)}
            className="h-4 w-full rounded-[3px] border border-hairline transition-transform hover:scale-110"
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Hex + RGB (0–255). */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 shrink-0 rounded border border-hairline" style={{ background: current }} />
        <label className="flex items-center gap-1 text-[11px] text-ink-muted">
          Hex
          <input
            type="text"
            value={hexText}
            spellCheck={false}
            onChange={(e) => {
              const t = e.target.value;
              setHexText(t);
              if (isHexColor(t)) setFromHex(t.startsWith("#") ? t : `#${t}`);
            }}
            className="w-20 rounded border border-hairline bg-work px-2 py-1 text-xs tabular-nums text-ink outline-none focus:border-[var(--vp-accent)]"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <RgbField label="R" value={rgb.r} onChange={(n) => emitRgb(n, rgb.g, rgb.b)} />
        <RgbField label="G" value={rgb.g} onChange={(n) => emitRgb(rgb.r, n, rgb.b)} />
        <RgbField label="B" value={rgb.b} onChange={(n) => emitRgb(rgb.r, rgb.g, n)} />
      </div>
    </div>
  );
}
