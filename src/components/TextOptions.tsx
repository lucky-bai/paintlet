import { usePaintStore } from "../state/store";
import { ToolButton } from "./ToolButton";

// A short, curated font list that renders reliably in the macOS webview.
const FONTS = [
  "Helvetica",
  "Arial",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Comic Sans MS",
  "system-ui",
];

const clampSize = (n: number) => Math.max(6, Math.min(300, Math.round(n || 6)));

// Contextual toolbar segment shown while the Text tool is active: font family,
// size, and bold / italic. Edits live in the store so the floating editor and
// the raster step both read the same style.
export function TextOptions() {
  const style = usePaintStore((s) => s.textStyle);
  const set = usePaintStore((s) => s.setTextStyle);

  return (
    <div className="flex items-center gap-1.5 px-1">
      <select
        value={style.fontFamily}
        onChange={(e) => set({ fontFamily: e.target.value })}
        className="h-7 rounded-md border border-hairline bg-work px-1.5 text-xs text-ink outline-none"
        title="Font"
      >
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={6}
        max={300}
        value={style.fontSize}
        onChange={(e) => set({ fontSize: clampSize(Number(e.target.value)) })}
        className="h-7 w-14 rounded-md border border-hairline bg-work px-2 text-right text-xs text-ink tabular-nums outline-none"
        title="Font size (px)"
      />
      <ToolButton
        title="Bold"
        active={style.bold}
        onClick={() => set({ bold: !style.bold })}
      >
        <span className="text-sm font-bold">B</span>
      </ToolButton>
      <ToolButton
        title="Italic"
        active={style.italic}
        onClick={() => set({ italic: !style.italic })}
      >
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
