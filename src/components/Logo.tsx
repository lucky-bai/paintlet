// The Paintlet app mark: a painter's palette with a brush on a light-blue
// rounded tile. The artwork lives in public/logo.svg (also the favicon) and is
// the same composition as the bundle icon (src-tauri/icons), so the in-window
// mark, the dock icon, and the favicon all match. Pure vector — crisp at any
// size, from the title bar to a Retina dock.
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
