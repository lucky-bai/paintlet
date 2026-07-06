import type { CanvasEngine } from "../engine/CanvasEngine";
import type { MouseButton, Point, ToolId } from "../engine/types";

// The extensibility spine. Every tool — current and future — implements exactly
// this interface. Adding a tool means writing one file and registering it; the
// engine, pointer plumbing, and commit flow never change.

export interface ToolContext {
  base: CanvasRenderingContext2D; // committed pixels
  overlay: CanvasRenderingContext2D; // live preview, cleared per stroke
  engine: CanvasEngine;
  color1: string; // foreground (primary button)
  color2: string; // background (secondary button)
  size: number; // brush/stroke width in logical px
  clearPreview(): void; // wipe the overlay
  commit(label: string, crisp?: boolean): void; // overlay → base + push history; crisp hardens AA edges
  setColor1(c: string): void; // write foreground back (eyedropper)
  setColor2(c: string): void; // write background back (eyedropper)
}

export interface PointerInfo {
  point: Point; // already mapped to canvas logical pixels
  button: MouseButton; // which color to paint with
  shiftKey: boolean; // constrain (straight line / square / circle)
}

export interface Tool {
  id: ToolId;
  cursor: string; // CSS cursor while this tool is active

  onPointerDown(p: PointerInfo, ctx: ToolContext): void;
  onPointerMove(p: PointerInfo, ctx: ToolContext): void;
  onPointerUp(p: PointerInfo, ctx: ToolContext): void;

  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void; // cleanup on tool switch
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): void; // e.g. Esc to cancel
}
