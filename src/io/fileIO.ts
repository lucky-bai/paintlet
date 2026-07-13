import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { engine, usePaintStore } from "../state/store";

// Formats we can decode on Open (whatever the webview's createImageBitmap
// supports) and the ones we can encode on Save.
const OPEN_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
const KNOWN_EXTS = new Set([...OPEN_EXTS, "bmp"]);

// Pick the encoder mime type (and JPEG quality) from a file's extension.
function encoding(path: string): { type: string; quality?: number } {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return { type: "image/jpeg", quality: 0.92 };
  return { type: "image/png" };
}

// File → Open. Decode the chosen image and replace the whole document.
export async function openImage(): Promise<void> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Images", extensions: OPEN_EXTS }],
  });
  if (typeof selected !== "string") return;

  // Read the bytes through our Rust command (returns an ArrayBuffer) so the
  // user can open from anywhere without fs-scope restrictions.
  const bytes = await invoke<ArrayBuffer>("read_image_file", { path: selected });
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
  engine.loadBitmap(bitmap);
  bitmap.close();

  usePaintStore.getState().setFilePath(selected);
}

// File → Save / Save As. An already-saved file re-writes in place with no
// prompt. Otherwise the native save panel is shown ONCE — its file-type popup
// (PNG or JPEG) is where the format is chosen, so there's no extra in-app step:
// the format is taken from the extension the user lands on (defaulting to PNG).
export async function saveImage(saveAs = false): Promise<void> {
  const store = usePaintStore.getState();
  const path = store.filePath;
  if (!saveAs && path) {
    await writeTo(path, encoding(path));
    return;
  }

  const stem = path ? path.replace(/\.[^./\\]+$/, "") : "untitled";
  const chosen = await save({
    defaultPath: `${stem}.png`,
    filters: [
      { name: "PNG image", extensions: ["png"] },
      { name: "JPEG image", extensions: ["jpg", "jpeg"] },
    ],
  });
  if (!chosen) return; // cancelled

  // Ensure a known extension so the encoder and the on-disk name agree; an
  // extension-less name defaults to PNG.
  let dest = chosen;
  const ext = dest.split(".").pop()?.toLowerCase();
  if (!ext || !KNOWN_EXTS.has(ext)) dest = `${dest}.png`;

  await writeTo(dest, encoding(dest));
}

// Bake any floating selection in, encode the base, and write it to disk.
async function writeTo(
  path: string,
  { type, quality }: { type: string; quality?: number },
): Promise<void> {
  engine.deselect();
  const blob = await engine.toBlob(type, quality);
  const buf = new Uint8Array(await blob.arrayBuffer());
  await invoke("write_image_file", { path, data: Array.from(buf) });
  usePaintStore.getState().setFilePath(path);
  engine.markSaved();
}
