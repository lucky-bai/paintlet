import { readImage, writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { Image } from "@tauri-apps/api/image";
import { engine, usePaintStore } from "../state/store";

// A fallback clipboard living inside the app, so copy/paste always works even
// if the system clipboard rejects an image — and it's faster for in-app
// round-trips (no encode/decode).
let internal: ImageData | null = null;

// Pixels to copy: the selection (or float) if there is one, else the whole
// image — matching Paint, where ⌘C with nothing selected copies everything.
function selectionOrWhole(): ImageData {
  return engine.getSelectionPixels() ?? engine.fullImageData();
}

export async function copySelection(): Promise<void> {
  const img = selectionOrWhole();
  internal = img;
  try {
    const tImg = await Image.new(new Uint8Array(img.data), img.width, img.height);
    await writeImage(tImg);
  } catch {
    // System clipboard unavailable; the internal copy still enables paste.
  }
}

export async function cutSelection(): Promise<void> {
  await copySelection();
  engine.deleteSelection(usePaintStore.getState().color2);
}

export async function pasteClipboard(): Promise<void> {
  let img: ImageData | null = null;
  try {
    const tImg = await readImage();
    const size = await tImg.size();
    const rgba = await tImg.rgba();
    img = new ImageData(new Uint8ClampedArray(rgba), size.width, size.height);
  } catch {
    img = internal; // nothing usable on the system clipboard
  }
  if (!img) return;
  engine.pasteImageData(img);
  // Drop into the selection tool so the pasted float can be moved immediately.
  usePaintStore.getState().setTool("select");
}
