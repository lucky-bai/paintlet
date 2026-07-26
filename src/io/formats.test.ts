import { describe, expect, it } from "vitest";
import {
  ENCODERS,
  OPEN_EXTS,
  SAVE_FORMATS,
  SAVE_UTIS,
  canEncode,
  encodingFor,
  extOf,
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

  it("exposes the identifiers in the same order", () => {
    expect(SAVE_UTIS).toEqual(SAVE_FORMATS.map((f) => f.uti));
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
