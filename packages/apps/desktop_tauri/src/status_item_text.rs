//! Draws a short text with the system font of macOS into a picture, for the badges of the menu of the status item.
//!
//! Only macOS has this system font. On another system, `render` gives `None` and the badge draws the text with the
//! picture font of `status_item_picture`.

use crate::status_item_picture::TextMask;

/// Empty space around the text in the picture, in pixels, so that the edges of the letters are not cut.
#[cfg(target_os = "macos")]
const MARGIN: usize = 4;

/// Draws `text` in white, with the system font in semibold, `font_size` pixels high, with the digits of the same
/// width. Returns `None` when the system cannot draw the text.
#[cfg(target_os = "macos")]
pub fn render(text: &str, font_size: f64) -> Option<TextMask> {
    use objc2::rc::Retained;
    use objc2::AnyThread;
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{
        NSBitmapImageRep, NSColor, NSDeviceRGBColorSpace, NSFont, NSFontAttributeName, NSFontWeightSemibold,
        NSForegroundColorAttributeName, NSGraphicsContext, NSStringDrawing,
    };
    use objc2_core_foundation::CGPoint;
    use objc2_foundation::{NSDictionary, NSString};

    // SAFETY: the keys of the dictionary are the keys that `NSStringDrawing` reads, and the values are a font and a
    // color. The bitmap owns its memory. The graphics state is saved and restored around the drawing.
    unsafe {
        let font = NSFont::monospacedDigitSystemFontOfSize_weight(font_size, NSFontWeightSemibold);
        let color = NSColor::whiteColor();
        let attributes: Retained<NSDictionary<NSString, AnyObject>> = NSDictionary::from_slices(
            &[NSFontAttributeName, NSForegroundColorAttributeName],
            &[&*font as &AnyObject, &*color as &AnyObject],
        );
        let string = NSString::from_str(text);
        let size = string.sizeWithAttributes(Some(&attributes));
        let width = size.width.ceil() as usize + 2 * MARGIN;
        let height = size.height.ceil() as usize + 2 * MARGIN;

        let bitmap = NSBitmapImageRep::initWithBitmapDataPlanes_pixelsWide_pixelsHigh_bitsPerSample_samplesPerPixel_hasAlpha_isPlanar_colorSpaceName_bytesPerRow_bitsPerPixel(
            NSBitmapImageRep::alloc(),
            std::ptr::null_mut(),
            width as isize,
            height as isize,
            8,
            4,
            true,
            false,
            NSDeviceRGBColorSpace,
            0,
            0,
        )?;
        let context = NSGraphicsContext::graphicsContextWithBitmapImageRep(&bitmap)?;
        NSGraphicsContext::saveGraphicsState_class();
        NSGraphicsContext::setCurrentContext(Some(&context));
        string.drawAtPoint_withAttributes(CGPoint::new(MARGIN as f64, MARGIN as f64), Some(&attributes));
        NSGraphicsContext::restoreGraphicsState_class();

        let data = bitmap.bitmapData();
        if data.is_null() {
            return None;
        }
        let row_bytes = bitmap.bytesPerRow() as usize;
        let mut alpha = Vec::with_capacity(width * height);
        for y in 0..height {
            for x in 0..width {
                alpha.push(*data.add(y * row_bytes + x * 4 + 3));
            }
        }
        Some(TextMask { width: width as u32, height: height as u32, alpha })
    }
}

/// Draws `text` with the system font. Only macOS has this font, so this system gives `None`.
#[cfg(not(target_os = "macos"))]
pub fn render(_text: &str, _font_size: f64) -> Option<TextMask> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn the_system_font_draws_a_visible_text_that_is_wider_for_more_characters() {
        let short = render("1%", 40.0).expect("the system draws the text");
        let long = render("99%", 40.0).expect("the system draws the text");
        let ink_width = |mask: &TextMask| mask.ink_bounds().map(|(left, _, right, _)| right - left);
        assert!(ink_width(&short).expect("the text is visible") > 10);
        assert!(ink_width(&long) > ink_width(&short));
        assert!(short.alpha.iter().any(|alpha| *alpha == 255), "the text has solid pixels");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn the_text_is_smooth_and_not_made_of_big_blocks() {
        let mask = render("34%", 40.0).expect("the system draws the text");
        let partial = mask.alpha.iter().filter(|alpha| **alpha > 0 && **alpha < 255).count();
        assert!(partial > 50, "the edges of the letters have {partial} smooth pixels");
    }
}
