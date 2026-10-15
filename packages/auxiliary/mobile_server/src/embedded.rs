//! The files of the mobile website. The script `build.rs` puts them inside the program, so the server needs no folder
//! of files at run time.

use std::ffi::OsStr;
use std::path::Path;

include!(concat!(env!("OUT_DIR"), "/embedded_files.rs"));

/// One file of the mobile website.
pub struct EmbeddedFile {
    /// The bytes of the file.
    pub bytes: &'static [u8],
    /// The value of the header `Content-Type` for the file.
    pub content_type: &'static str,
}

/// Finds a file by its path in the folder `dist`, for example `index.html` or `assets/index-1a2b3c.js`. Only a path of
/// the table is found: no other path reaches the disk.
pub fn find(path: &str) -> Option<EmbeddedFile> {
    EMBEDDED_FILES.iter().find(|(name, _)| *name == path).map(|(name, bytes)| EmbeddedFile {
        bytes,
        content_type: content_type_of(name),
    })
}

/// Lists the path of every file of the mobile website.
#[cfg(test)]
pub fn paths() -> impl Iterator<Item = &'static str> {
    EMBEDDED_FILES.iter().map(|(name, _)| *name)
}

/// Gives the `Content-Type` of a file from its extension. A file of an unknown extension is sent as bytes that a
/// browser must not run.
pub fn content_type_of(path: &str) -> &'static str {
    match Path::new(path).extension().and_then(OsStr::to_str) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("webmanifest") => "application/manifest+json",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("ico") => "image/x-icon",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text_of(path: &str) -> String {
        let file = find(path).unwrap_or_else(|| panic!("the file {path} is embedded"));
        String::from_utf8(file.bytes.to_vec()).unwrap()
    }

    #[test]
    fn the_page_the_manifest_the_script_and_the_style_are_embedded() {
        let paths: Vec<&str> = paths().collect();
        assert!(paths.contains(&"index.html"));
        assert!(paths.contains(&"manifest.webmanifest"));
        assert!(paths.iter().any(|path| path.starts_with("assets/") && path.ends_with(".js")));
        assert!(paths.iter().any(|path| path.starts_with("assets/") && path.ends_with(".css")));
    }

    #[test]
    fn a_path_outside_the_table_is_not_found() {
        for path in ["", "nope.html", "../Cargo.toml", "assets/../index.html", "/index.html", "assets/"] {
            assert!(find(path).is_none(), "path {path:?}");
        }
    }

    #[test]
    fn an_unknown_extension_is_sent_as_plain_bytes() {
        assert_eq!(content_type_of("data.bin"), "application/octet-stream");
        assert_eq!(content_type_of("no_extension"), "application/octet-stream");
        assert_eq!(content_type_of("index.html.exe"), "application/octet-stream");
    }

    #[test]
    fn the_page_has_no_inline_script_and_no_inline_style() {
        let page = text_of("index.html");
        for script in page.split("<script").skip(1) {
            let tag = script.split('>').next().unwrap();
            assert!(tag.contains("src=\""), "an inline script: <script{tag}>");
        }
        assert!(!page.contains("<style"), "an inline style element");
        assert!(!page.contains(" style=\""), "an inline style attribute");
    }

    #[test]
    fn every_file_that_the_page_names_is_embedded() {
        let page = text_of("index.html");
        let mut named = Vec::new();
        for attribute in ["src=\"", "href=\""] {
            for part in page.split(attribute).skip(1) {
                named.push(part.split('"').next().unwrap().to_string());
            }
        }
        assert!(named.len() >= 3, "the page names the script, the style, and the manifest: {named:?}");
        for address in named {
            let path = address.strip_prefix('/').unwrap_or_else(|| panic!("{address} is not an address of this server"));
            assert!(find(path).is_some(), "the page names {address}, which is not embedded");
        }
    }
}
