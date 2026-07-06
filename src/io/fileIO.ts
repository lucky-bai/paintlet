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

// File → Save / Save As. Encodes the base layer and writes it to disk.
export async function saveImage(saveAs = false): Promise<void> {
  const store = usePaintStore.getState();
  let path = store.filePath;

  if (saveAs || !path) {
    const chosen = await save({
      defaultPath: path ?? "untitled.png",
      filters: [
        { name: "PNG", extensions: ["png"] },
        { name: "JPEG", extensions: ["jpg", "jpeg"] },
      ],
    });
    if (!chosen) return;
    path = chosen;
  }

  // Ensure a usable extension so the encoder and the file name agree.
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext || !KNOWN_EXTS.has(ext)) path = `${path}.png`;

  // Bake any floating selection into the base before exporting.
  engine.deselect();

  const { type, quality } = encoding(path);
  const blob = await engine.toBlob(type, quality);
  const buf = new Uint8Array(await blob.arrayBuffer());
  await invoke("write_image_file", { path, data: Array.from(buf) });

  store.setFilePath(path);
  engine.markSaved();
}
