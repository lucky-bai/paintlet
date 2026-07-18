import { useEffect, useRef, useState } from "react";
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

// Editable font combobox that renders every choice in its own typeface, so the
// list is a live preview of what each font looks like — not just a column of
// names. The dropdown always shows the full list (typing sets the family but
// never filters the options — you can always browse to any font). Stays a
// free-text field: typing sets the family even if it isn't in the list, and the
// native <datalist> can't style options per-font, hence this custom dropdown.
function FontPicker() {
  const family = usePaintStore((s) => s.textStyle.fontFamily);
  const set = usePaintStore((s) => s.setTextStyle);
  const [fonts, setFonts] = useState<string[]>(MACOS_FONTS);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // Close the dropdown on any pointer press outside the widget.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (f: string) => {
    set({ fontFamily: f });
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={family}
        onChange={(e) => {
          set({ fontFamily: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "Enter") {
            setOpen(false);
          }
        }}
        spellCheck={false}
        className="h-7 w-40 rounded-md border border-hairline bg-work px-2 text-xs text-ink outline-none focus:border-[var(--vp-accent)]"
        title="Font — pick one or type any installed font name"
        style={{ fontFamily: family }}
      />
      {open && (
        <ul
          className="absolute left-0 top-full z-50 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-hairline bg-surface-raised py-1 shadow-xl"
          role="listbox"
        >
          {fonts.map((f) => (
            <li key={f}>
              <button
                type="button"
                // mousedown (not click) so the selection lands before the
                // input's blur can close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(f);
                }}
                className={
                  "flex w-full items-center justify-between gap-2 px-3 py-1 text-left text-sm hover:bg-hover " +
                  (f === family ? "text-[var(--vp-accent)]" : "text-ink")
                }
              >
                <span className="truncate" style={{ fontFamily: f }}>
                  {f}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Contextual toolbar segment shown while the Text tool is active: font family
// (previewing combobox), size (with large ± steppers), and bold / italic / etc.
export function TextOptions() {
  const style = usePaintStore((s) => s.textStyle);
  const set = usePaintStore((s) => s.setTextStyle);

  const setSize = (n: number) => set({ fontSize: clampSize(n) });

  return (
    <div className="flex items-center gap-1.5 px-1">
      <FontPicker />

      {/* Size with large ± steppers flanking an editable value. The native
          number spinners are hidden (see .no-spinner) so these are the only
          steppers. */}
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
          className="no-spinner h-7 w-12 border-x border-hairline bg-work px-1 text-center text-xs text-ink tabular-nums outline-none"
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
