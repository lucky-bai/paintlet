// The VibePaint app mark: a paintbrush dipping into a white paint swoosh on a
// light-blue tile — a nod to MS Paint's brush icon, drawn in the app's own
// light-blue / black / white palette. Same artwork as the bundle icon
// (src-tauri/icons), kept here as inline SVG for crisp in-window rendering.
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      role="img"
    >
      <defs>
        <linearGradient id="vp-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3ff" />
          <stop offset="1" stopColor="#3aa8e8" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="116" height="116" rx="27" fill="url(#vp-logo-bg)" />
      <path
        d="M20 92 C 44 74, 84 108, 108 84"
        fill="none"
        stroke="#ffffff"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <g transform="rotate(38 64 64)">
        <rect x="57" y="20" width="14" height="50" rx="7" fill="#111111" />
        <rect
          x="52"
          y="66"
          width="24"
          height="12"
          rx="2"
          fill="#ffffff"
          stroke="#111111"
          strokeWidth="1.6"
        />
        <path
          d="M52.5 78 h23 l-2.5 15 a3 3 0 0 1 -2 2.6 q-9 2.4 -14 0 a3 3 0 0 1 -2 -2.6 z"
          fill="#eaf7ff"
          stroke="#111111"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M60 79 l-1 15 M68 79 l1 15"
          fill="none"
          stroke="#3aa8e8"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
