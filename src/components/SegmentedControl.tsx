import { cx } from "../lib/cx";

// A macOS-style segmented control: one bordered container, equal-width buttons,
// the active segment filled with the accent color.
//
// Shared rather than inlined because there are two of these (Settings'
// Appearance and Resize's Pixels/Percent) and they had drifted — one grew the
// container border and the other didn't, leaving the unselected segment looking
// like bare text instead of a button. One component, one appearance.
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        "flex overflow-hidden rounded-md border border-hairline",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "flex-1 px-3 py-1.5 text-xs",
            value === o.id
              ? "bg-[var(--vp-accent)] text-white"
              : "text-ink hover:bg-hover",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
