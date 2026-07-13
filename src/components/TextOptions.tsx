import { useEffect, useState } from "react";
import { usePaintStore } from "../state/store";
import { ToolButton } from "./ToolButton";

// A broad list of fonts that ship with macOS, offered as suggestions. The field
// is a free-text combobox, so ANY installed font can be typed even if it isn't
// listed — and where the Local Font Access API is available (Chromium), the
// full installed set is merged in on mount.
const MACOS_FONTS = [
  "Helvetica", "Helvetica Neue", "Arial", "Arial Black", "Verdana", "Tahoma",
  "Trebuchet MS", "Geneva", "Lucida Grande", "system-ui",
  "Times New Roman", "Times", "Georgia", "Palatino", "Baskerville", "Didot",
  "Hoefler Text", "Cochin", "American Typewriter", "Optima", "Charter",
  "Courier New", "Courier", "Menlo", "Monaco", "Andale Mono", "SF Mono",
  "Futura", "Gill Sans", "Avenir", "Avenir Next", "Copperplate", "Impact",
  "Comic Sans MS", "Marker Felt", "Chalkboard SE", "Chalkduster",
  "Bradley Hand", "Noteworthy", "Snell Roundhand", "Apple Chancery", "Zapfino",
  "Papyrus", "Skia", "Herculanum", "sans-serif", "serif", "monospace",
];

const MIN = 6;
const MAX = 300;
const clampSize = (n: number) => Math.max(MIN, Math.min(MAX, Math.round(n || MIN)));

// Contextual toolbar segment shown while the Text tool is active: font family
// (editable combobox), size (with large steppers), and bold / italic / etc.
export function TextOptions() {
  const style = usePaintStore((s) => s.textStyle);
  const set = usePaintStore((s) => s.setTextStyle);
  const [fonts, setFonts] = useState<string[]>(MACOS_FONTS);

  // Progressive enhancement: if the platform exposes the installed fonts (the
  // Local Font Access API), merge every family in. Unsupported or permission-
  // denied (e.g. WKWebView) → keep the curated macOS list. No user gesture is
  // forced; failure is silent.
  useEffect(() => {
    const q = (window as unknown as {
      queryLocalFonts?: () => Promise<Array<{ family: string }>>;
    }).queryLocalFonts;
    if (!q) return;
    q().then((list) => {
      const families = Array.from(new Set(list.map((f) => f.family))).sort();
      if (families.length) setFonts((prev) => Array.from(new Set([...families, ...prev])));
    }).catch(() => {});
  }, []);

  const setSize = (n: number) => set({ fontSize: clampSize(n) });

  return (
    <div className="flex items-center gap-1.5 px-1">
      <input
        list="vp-font-list"
        value={style.fontFamily}
        onChange={(e) => set({ fontFamily: e.target.value })}
        spellCheck={false}
        className="h-7 w-36 rounded-md border border-hairline bg-work px-2 text-xs text-ink outline-none focus:border-[var(--vp-accent)]"
        title="Font — pick one or type any installed font name"
        style={{ fontFamily: style.fontFamily }}
      />
      <datalist id="vp-font-list">
        {fonts.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {/* Size with large, easy steppers flanking an editable value. */}
      <div className="flex items-center overflow-hidden rounded-md border border-hairline">
        <button
          type="button"
          title="Smaller"
          aria-label="Decrease font size"
          onClick={() => setSize(style.fontSize - 1)}
          className="flex h-7 w-7 items-center justify-center text-base leading-none text-ink hover:bg-hover"
        >
          −
        </button>
        <input
          type="number"
          min={MIN}
          max={MAX}
          value={style.fontSize}
          onChange={(e) => setSize(Number(e.target.value))}
          className="h-7 w-12 border-x border-hairline bg-work px-1 text-center text-xs text-ink tabular-nums outline-none"
          title="Font size (px)"
        />
        <button
          type="button"
          title="Larger"
          aria-label="Increase font size"
          onClick={() => setSize(style.fontSize + 1)}
          className="flex h-7 w-7 items-center justify-center text-base leading-none text-ink hover:bg-hover"
        >
          +
        </button>
      </div>

      <ToolButton title="Bold" active={style.bold} onClick={() => set({ bold: !style.bold })}>
        <span className="text-sm font-bold">B</span>
      </ToolButton>
      <ToolButton title="Italic" active={style.italic} onClick={() => set({ italic: !style.italic })}>
        <span className="font-serif text-sm italic">I</span>
      </ToolButton>
      <ToolButton
        title="Underline"
        active={style.underline}
        onClick={() => set({ underline: !style.underline })}
      >
        <span className="text-sm underline">U</span>
      </ToolButton>
      <ToolButton
        title="Strikethrough"
        active={style.strike}
        onClick={() => set({ strike: !style.strike })}
      >
        <span className="text-sm line-through">S</span>
      </ToolButton>
    </div>
  );
}
