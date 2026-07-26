import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { engine, usePaintStore } from "../state/store";
import {
  OPEN_EXTS,
  canEncode,
  encodingFor,
  type Encoding,
} from "./formats";

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
// is where the format is chosen, so there's no extra in-app step: the format is
// taken from the extension the user lands on (defaulting to PNG).
export async function saveImage(saveAs = false): Promise<void> {
  const store = usePaintStore.getState();
  const path = store.filePath;

  // Re-write in place only when we can actually produce the format already on
  // disk. A file we can read but not write (WebP, HEIC) falls through to the
  // panel rather than being overwritten with PNG bytes under its original
  // name — that would corrupt the file instead of saving it.
  if (!saveAs && path && canEncode(path)) {
    await writeTo(path, encodingFor(path));
    return;
  }

  const stem = path ? path.replace(/\.[^./\\]+$/, "") : "untitled";
  const chosen = await save({
    defaultPath: `${stem}.png`,
    filters: [
      { name: "PNG image", extensions: ["png"] },
      { name: "JPEG image", extensions: ["jpg", "jpeg"] },
      { name: "BMP image", extensions: ["bmp"] },
    ],
  });
  if (!chosen) return; // cancelled

  // The format follows the extension the user lands on. Anything we can't
  // encode — including no extension at all — gains a .png rather than being
  // written with mismatched bytes. GIF is absent from the panel above because
  // it quantizes to 256 colors, but stays writable here so ⌘S on a file that
  // was already a GIF re-saves as one.
  const dest = canEncode(chosen) ? chosen : `${chosen}.png`;

  await writeTo(dest, encodingFor(dest));
}

// Bake any floating selection in, encode the base, and write it to disk.
async function writeTo(
  path: string,
  { type, quality }: Encoding,
): Promise<void> {
  engine.deselect();
  const blob = await engine.toBlob(type, quality);
  const buf = new Uint8Array(await blob.arrayBuffer());
  await invoke("write_image_file", { path, data: Array.from(buf) });
  usePaintStore.getState().setFilePath(path);
  engine.markSaved();
}
