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

export type SaveFormat = "png" | "jpeg";

// The format the Save dialog should default to for the current document.
export function currentFormat(): SaveFormat {
  const path = usePaintStore.getState().filePath;
  return path && /\.jpe?g$/i.test(path) ? "jpeg" : "png";
}

// File → Save. An already-saved file re-writes in its existing format with no
// prompt; a new/untitled document needs a format + destination, so it opens the
// in-app Save dialog (which then calls saveWithFormat).
export async function saveImage(saveAs = false): Promise<void> {
  const store = usePaintStore.getState();
  const path = store.filePath;
  if (!saveAs && path) {
    await writeTo(path, encoding(path));
    return;
  }
  store.setSaveDialogOpen(true);
}

// Chosen from the Save dialog: pick the destination (native panel, filtered to
// just the chosen format so it isn't ambiguous), then encode and write. Returns
// false if the user cancelled the destination picker.
export async function saveWithFormat(
  format: SaveFormat,
  quality: number,
): Promise<boolean> {
  const store = usePaintStore.getState();
  const stem = store.filePath ? store.filePath.replace(/\.[^./\\]+$/, "") : "untitled";
  const ext = format === "jpeg" ? "jpg" : "png";
  const filter =
    format === "jpeg"
      ? { name: "JPEG image", extensions: ["jpg", "jpeg"] }
      : { name: "PNG image", extensions: ["png"] };

  const chosen = await save({ defaultPath: `${stem}.${ext}`, filters: [filter] });
  if (!chosen) return false;

  // Honor the picked format even if the typed name carried a different (or no)
  // extension — the dialog's dropdown is the source of truth, not the guess.
  let path = chosen;
  const chosenExt = path.split(".").pop()?.toLowerCase();
  if (!chosenExt || !KNOWN_EXTS.has(chosenExt)) path = `${path}.${ext}`;

  await writeTo(path, {
    type: format === "jpeg" ? "image/jpeg" : "image/png",
    quality: format === "jpeg" ? quality / 100 : undefined,
  });
  return true;
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
