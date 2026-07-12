import { describe, expect, it } from "vitest";
import { History } from "./History";

// History treats snapshots as opaque values (it never reads their pixels), so
// plain tagged objects stand in for ImageData.
const snap = (tag: string) => ({ tag }) as unknown as ImageData;

describe("History", () => {
  it("starts with nothing to undo or redo", () => {
    const h = new History();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });

  it("walks back and forward over pushed snapshots", () => {
    const h = new History();
    const [a, b, c] = [snap("a"), snap("b"), snap("c")];
    h.push(a);
    h.push(b);
    h.push(c);
    expect(h.undo()).toBe(b);
    expect(h.undo()).toBe(a);
    expect(h.canUndo()).toBe(false); // snapshot #0 is the floor, not undoable past
    expect(h.redo()).toBe(b);
    expect(h.redo()).toBe(c);
    expect(h.canRedo()).toBe(false);
  });

  it("forks history: a push after undo discards the redo tail", () => {
    const h = new History();
    const [a, b, c, d] = [snap("a"), snap("b"), snap("c"), snap("d")];
    h.push(a);
    h.push(b);
    h.push(c);
    h.undo(); // at b
    h.push(d); // fork: c is gone
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBe(b);
    expect(h.redo()).toBe(d);
  });

  it("caps the stack by dropping the oldest snapshot", () => {
    const h = new History(3);
    const [a, b, c, d] = [snap("a"), snap("b"), snap("c"), snap("d")];
    h.push(a);
    h.push(b);
    h.push(c);
    h.push(d); // a falls off
    expect(h.undo()).toBe(c);
    expect(h.undo()).toBe(b);
    expect(h.canUndo()).toBe(false); // a is gone
  });

  it("reset drops everything", () => {
    const h = new History();
    h.push(snap("a"));
    h.push(snap("b"));
    h.reset();
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
  });
});
