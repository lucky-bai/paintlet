import { describe, expect, it } from "vitest";
import {
  ENCODERS,
  ISO_BMFF_EXTS,
  OPEN_EXTS,
  SAVE_FORMATS,
  SAVE_UTIS,
  canEncode,
  encodingFor,
  extOf,
  firstOpenablePath,
  isCompleteIsoBmff,
} from "./formats";

describe("extOf", () => {
  it("reads the final component's extension, lowercased", () => {
    expect(extOf("/a/b/drawing.PNG")).toBe("png");
    expect(extOf("drawing.jpeg")).toBe("jpeg");
  });

  it("is empty when the name has no extension", () => {
    expect(extOf("/a/b/untitled")).toBe("");
  });

  it("ignores dots in directory names", () => {
    expect(extOf("/a/v1.2/untitled")).toBe("");
    expect(extOf("/a/v1.2/sketch.bmp")).toBe("bmp");
  });
});

describe("encoder table", () => {
  // The invariant that matters: an extension must never map to a different
  // format's bytes. Writing PNG into a .gif silently corrupts the file — it
  // still opens in Preview (macOS sniffs content) but lies about what it is.
  it("maps every extension to its own format's mime type", () => {
    const alias: Record<string, string> = { jpg: "jpeg" };
    for (const [ext, enc] of Object.entries(ENCODERS)) {
      expect(enc.type).toBe(`image/${alias[ext] ?? ext}`);
    }
  });

  it("claims only formats the webview can actually encode", () => {
    // WKWebView's canvas cannot produce any of these; toBlob would silently
    // fall back to PNG, so they must stay out of the table.
    for (const ext of ["webp", "heic", "heif", "avif"]) {
      expect(ENCODERS).not.toHaveProperty(ext);
    }
  });

  it("can open every format it can save", () => {
    // A format we write but can't read back would be a dead end.
    for (const ext of Object.keys(ENCODERS)) {
      expect(OPEN_EXTS).toContain(ext);
    }
  });
});

describe("save panel format popup", () => {
  // The popup chooses a format by rewriting the filename's extension, so every
  // entry needs an encoder behind it. A UTI without one would look like a real
  // choice and quietly produce PNG.
  it("offers only formats that have an encoder", () => {
    for (const { uti, ext } of SAVE_FORMATS) {
      expect(ENCODERS, `${uti} has no encoder for .${ext}`).toHaveProperty(ext);
    }
  });

  it("leads with PNG, so an extension-less name becomes one", () => {
    expect(SAVE_FORMATS[0].ext).toBe("png");
  });

  // Pinned as an exact list: the order is what the popup shows, and GIF's
  // 256-color quantization is the reason it sits at the end rather than beside
  // PNG. A format added here without thought would change both.
  it("offers PNG, JPEG, BMP, then GIF", () => {
    expect(SAVE_FORMATS.map((f) => f.ext)).toEqual([
      "png",
      "jpeg",
      "bmp",
      "gif",
    ]);
  });

  it("exposes the identifiers in the same order", () => {
    expect(SAVE_UTIS).toEqual(SAVE_FORMATS.map((f) => f.uti));
  });
});

describe("system-initiated opens", () => {
  // Finder may hand over several paths (multi-select + Open With). The
  // single-document policy takes the first *openable* one: skipping nothing
  // would mean an unsupported file ahead of a supported one silently wins.
  it("picks the first openable path, skipping anything else in the request", () => {
    expect(
      firstOpenablePath(["/a/notes.txt", "/a/sketch.png", "/a/photo.jpg"]),
    ).toBe("/a/sketch.png");
    expect(firstOpenablePath(["/a/notes.txt", "/a/notes.rtf"])).toBeNull();
  });

  it("matches extensions case-insensitively, like the Open dialog", () => {
    expect(firstOpenablePath(["/a/IMG_0001.HEIC"])).toBe("/a/IMG_0001.HEIC");
    expect(firstOpenablePath(["/a/drawing.Png"])).toBe("/a/drawing.Png");
  });

  it("accepts every format the Open dialog offers", () => {
    // The dialog filter and the Finder path must agree — a format one accepts
    // and the other doesn't would make two Open buttons with different reach.
    for (const ext of OPEN_EXTS) {
      expect(firstOpenablePath([`/a/b.${ext}`])).toBe(`/a/b.${ext}`);
    }
  });

  it("ignores extension-less paths", () => {
    expect(firstOpenablePath(["/a/README"])).toBeNull();
  });
});

describe("save-path decisions", () => {
  it("allows an in-place re-write for encodable formats", () => {
    expect(canEncode("/a/b.png")).toBe(true);
    expect(canEncode("/a/b.bmp")).toBe(true);
    expect(canEncode("/a/b.gif")).toBe(true);
  });

  it("refuses an in-place re-write for read-only formats", () => {
    expect(canEncode("/a/b.webp")).toBe(false);
    expect(canEncode("/a/b.heic")).toBe(false);
    expect(canEncode("/a/b.avif")).toBe(false);
  });

  it("falls back to PNG for an unknown or absent extension", () => {
    expect(encodingFor("/a/b.xyz")).toEqual({ type: "image/png" });
    expect(encodingFor("/a/b")).toEqual({ type: "image/png" });
  });

  it("carries JPEG quality on both spellings", () => {
    expect(encodingFor("/a/b.jpg").quality).toBe(0.92);
    expect(encodingFor("/a/b.jpeg").quality).toBe(0.92);
  });

  it("picks the matching encoder for GIF and BMP", () => {
    expect(encodingFor("/a/b.gif").type).toBe("image/gif");
    expect(encodingFor("/a/b.BMP").type).toBe("image/bmp");
  });
});

describe("ISO BMFF completeness", () => {
  const ascii = (value: string) => [...value].map((c) => c.charCodeAt(0));
  const box = (type: string, payload: number[]) => {
    const size = 8 + payload.length;
    const header = [size >>> 24, (size >>> 16) & 0xff, (size >>> 8) & 0xff, size & 0xff];
    return [...header, ...ascii(type), ...payload];
  };
  const file = new Uint8Array([
    ...box("ftyp", [...ascii("avif"), 0, 0, 0, 0, ...ascii("mif1")]),
    ...box("mdat", [1, 2, 3, 4]),
  ]);

  it("offers AVIF for opening without offering an encoder", () => {
    expect(OPEN_EXTS).toContain("avif");
    expect(ENCODERS).not.toHaveProperty("avif");
  });

  it("checks every ISO BMFF format, HEIC included", () => {
    expect(ISO_BMFF_EXTS).toEqual(expect.arrayContaining(["avif", "heic", "heif"]));
  });

  it("accepts a file whose boxes tile it exactly", () => {
    expect(isCompleteIsoBmff(file)).toBe(true);
  });

  it("accepts a 64-bit box size", () => {
    const large = [0, 0, 0, 1, ...ascii("mdat"), 0, 0, 0, 0, 0, 0, 0, 20, 1, 2, 3, 4];
    expect(isCompleteIsoBmff(new Uint8Array(large))).toBe(true);
  });

  it("rejects a truncated file", () => {
    expect(isCompleteIsoBmff(file.slice(0, -1))).toBe(false);
  });

  it("rejects bytes that aren't a box structure", () => {
    expect(isCompleteIsoBmff(new TextEncoder().encode("not an image"))).toBe(false);
    expect(isCompleteIsoBmff(new Uint8Array())).toBe(false);
  });
});
