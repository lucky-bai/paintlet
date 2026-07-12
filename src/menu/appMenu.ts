import {
  Menu,
  MenuItem,
  PredefinedMenuItem,
  Submenu,
} from "@tauri-apps/api/menu";
import * as A from "../actions";

// Build the native macOS menu bar in JS. Each item's `action` calls straight
// into the shared command layer, so no Rust round-trip is needed. This is the
// natural Mac home for File/Edit/Image/View and gives real ⌘-accelerators.
//
// Note on shortcuts: menu accelerators are app-global on macOS. Single-key tool
// shortcuts (P/B/E/…) are therefore handled in a keydown listener instead — as
// menu accelerators they'd hijack every keystroke in the text editor.

const item = (
  text: string,
  accelerator: string | undefined,
  action: () => void,
) => MenuItem.new({ text, accelerator, action });

const sep = () => PredefinedMenuItem.new({ item: "Separator" });

export async function installAppMenu(): Promise<void> {
  const appMenu = await Submenu.new({
    text: "VibePaint",
    items: [
      await PredefinedMenuItem.new({ item: "Hide", text: "Hide VibePaint" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await sep(),
      await PredefinedMenuItem.new({ item: "Quit", text: "Quit VibePaint" }),
    ],
  });

  const fileMenu = await Submenu.new({
    text: "File",
    items: [
      await item("New", "CmdOrCtrl+N", A.newDocument),
      await item("Open…", "CmdOrCtrl+O", A.openFile),
      await sep(),
      await item("Save", "CmdOrCtrl+S", A.saveFile),
      await item("Save As…", "CmdOrCtrl+Shift+S", A.saveFileAs),
      await sep(),
      await PredefinedMenuItem.new({ item: "CloseWindow", text: "Close Window" }),
    ],
  });

  // Edit holds the clipboard/selection commands and, folded in below, the image
  // operations (there's no separate Image menu — those commands live here).
  const editMenu = await Submenu.new({
    text: "Edit",
    items: [
      await item("Undo", "CmdOrCtrl+Z", A.undo),
      await item("Redo", "CmdOrCtrl+Shift+Z", A.redo),
      await sep(),
      await item("Cut", "CmdOrCtrl+X", A.cut),
      await item("Copy", "CmdOrCtrl+C", A.copy),
      await item("Paste", "CmdOrCtrl+V", A.paste),
      await item("Delete", undefined, A.deleteSelection),
      await sep(),
      await item("Select All", "CmdOrCtrl+A", A.selectAll),
      await sep(),
      await item("Resize…", undefined, A.openResizeDialog),
      await item("Crop to Selection", undefined, A.crop),
      await sep(),
      await item("Flip Horizontal", undefined, A.flipHorizontal),
      await item("Flip Vertical", undefined, A.flipVertical),
      await item("Rotate 90° Right", undefined, A.rotateRight),
      await item("Rotate 90° Left", undefined, A.rotateLeft),
      await item("Rotate 180°", undefined, A.rotate180),
    ],
  });

  const viewMenu = await Submenu.new({
    text: "View",
    items: [
      await item("Zoom In", undefined, A.zoomIn),
      await item("Zoom Out", undefined, A.zoomOut),
      await item("Actual Size", undefined, A.actualSize),
      await item("Fit to Window", undefined, A.fitToWindow),
    ],
  });

  const menu = await Menu.new({
    items: [appMenu, fileMenu, editMenu, viewMenu],
  });
  await menu.setAsAppMenu();
}
