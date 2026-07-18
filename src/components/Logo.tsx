// The Paintlet app mark: the pixel-art painter's palette from the original
// artwork, centered on its light-blue tile. The image lives at public/logo.png
// (also the favicon) and is the same art the bundle icons (src-tauri/icons)
// are generated from, so the in-window mark, the dock icon, and the favicon all
// match.
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
