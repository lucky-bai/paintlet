// A save panel with a real file-format popup, like Preview's and like Windows
// Paint's "Save as type".
//
// Why this exists instead of tauri-plugin-dialog's save(): that plugin goes
// through rfd, whose macOS backend flattens every filter into one flat
// setAllowedFileTypes array and discards the filter names, so no format control
// ever appears. The user's only way to choose JPEG or BMP was to type the
// extension — and since macOS hides known extensions, the panel didn't even
// hint that the format was a choice.
//
// NSSavePanel can show the control itself (`showsContentTypes`, macOS 14+), so
// there's no accessory view or custom target/action class here. AppKit owns the
// popup, rewrites the filename's extension as the selection changes, and runs
// its own overwrite confirmation against the final name. The extension on the
// returned path therefore stays the single source of truth for which encoder
// runs — exactly what io/formats.ts already keys off.
//
// On macOS 13 and earlier `showsContentTypes` doesn't exist. Rather than crash
// on an unrecognized selector we probe for it and report back, letting the
// frontend fall back to the plugin dialog.

/// What the frontend asks for: a starting filename and the formats to offer,
/// most-preferred first (the first is what an extension-less name becomes).
#[derive(serde::Deserialize)]
pub struct SaveRequest {
    /// Filename to prefill, extension included (e.g. "untitled.png").
    pub name: String,
    /// Uniform type identifiers, e.g. ["public.png", "public.jpeg"].
    pub types: Vec<String>,
    /// Directory to open in, when the document already has a home.
    pub directory: Option<String>,
}

/// `path` is None when the user cancelled. `supported` is false when this macOS
/// is too old for the format popup, which tells the caller to use the plugin
/// dialog instead — a cancel and an unsupported OS must not look alike.
#[derive(serde::Serialize)]
pub struct SaveResponse {
    pub path: Option<String>,
    pub supported: bool,
}

impl SaveResponse {
    pub fn unsupported() -> Self {
        Self {
            path: None,
            supported: false,
        }
    }
    fn cancelled() -> Self {
        Self {
            path: None,
            supported: true,
        }
    }
    fn chosen(path: String) -> Self {
        Self {
            path: Some(path),
            supported: true,
        }
    }
}

/// Runs the panel. Must be called on the main thread — AppKit panels are
/// main-thread-only, and `runModal` spins its own event loop there.
#[cfg(target_os = "macos")]
pub fn run(mtm: objc2::MainThreadMarker, req: &SaveRequest) -> SaveResponse {
    use objc2::rc::Retained;
    use objc2::runtime::NSObjectProtocol;
    use objc2::sel;
    use objc2_app_kit::{NSModalResponseOK, NSSavePanel};
    use objc2_foundation::{NSArray, NSString, NSURL};
    use objc2_uniform_type_identifiers::UTType;

    let panel = NSSavePanel::savePanel(mtm);

    // `showsContentTypes` is macOS 14+. Probing for the selector beats reading a
    // version number, and beats crashing on an unrecognized selector.
    if !panel.respondsToSelector(sel!(setShowsContentTypes:)) {
        return SaveResponse::unsupported();
    }

    // Map identifiers to UTTypes, dropping any this system doesn't know. An
    // unknown identifier would otherwise be a silent hole in the popup.
    let types: Vec<Retained<UTType>> = req
        .types
        .iter()
        .filter_map(|id| UTType::typeWithIdentifier(&NSString::from_str(id)))
        .collect();

    if types.is_empty() {
        // With no content types AppKit hides the control anyway, so there'd be
        // nothing to gain over the plugin dialog.
        return SaveResponse::unsupported();
    }

    let refs: Vec<&UTType> = types.iter().map(|t| t.as_ref()).collect();
    panel.setAllowedContentTypes(&NSArray::from_slice(&refs));
    // The popup itself. Everything else here is ordinary panel configuration;
    // this one line is the whole point of the module.
    panel.setShowsContentTypes(true);
    // Keep the extension visible so the chosen format is legible in the name
    // field too, not only in the popup — the old panel hid it, which is half of
    // why the format never looked like a choice.
    panel.setExtensionHidden(false);
    panel.setCanSelectHiddenExtension(false);
    // AppKit shows a Finder-tags field by default, but NSSavePanel only
    // *collects* tags: its contract expects the app to read -tagNames and apply
    // them to the file once the save completes (which is why tagging works in
    // NSDocument apps and nowhere else for free). Paintlet writes bytes through
    // write_image_file and never reads them back, so anything typed there would
    // be silently dropped. Hide the field rather than offer a control that does
    // nothing — Paint has no notion of tagging either.
    panel.setShowsTagField(false);
    panel.setNameFieldStringValue(&NSString::from_str(&req.name));

    if let Some(dir) = &req.directory {
        let url = NSURL::fileURLWithPath(&NSString::from_str(dir));
        panel.setDirectoryURL(Some(&url));
    }

    if panel.runModal() != NSModalResponseOK {
        return SaveResponse::cancelled();
    }

    match panel.URL().and_then(|u| u.path()) {
        Some(p) => SaveResponse::chosen(p.to_string()),
        // OK with no URL shouldn't happen; treat it as a cancel rather than
        // inventing a path to write to.
        None => SaveResponse::cancelled(),
    }
}
