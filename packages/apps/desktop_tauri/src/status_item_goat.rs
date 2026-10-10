//! The baby goat of the status item: loads the eight frames of the walk, cuts the empty margins away, and scales the
//! frames to the height of the picture of the status item.

use crate::status_item_picture::Sprite;
use std::sync::OnceLock;
use tauri::image::Image;

/// The eight frames of the walk, in order.
const FRAME_FILES: [&[u8]; 8] = [
    include_bytes!("../assets/baby_goat_walk/walk_00.png"),
    include_bytes!("../assets/baby_goat_walk/walk_01.png"),
    include_bytes!("../assets/baby_goat_walk/walk_02.png"),
    include_bytes!("../assets/baby_goat_walk/walk_03.png"),
    include_bytes!("../assets/baby_goat_walk/walk_04.png"),
    include_bytes!("../assets/baby_goat_walk/walk_05.png"),
    include_bytes!("../assets/baby_goat_walk/walk_06.png"),
    include_bytes!("../assets/baby_goat_walk/walk_07.png"),
];

/// Height of the goat in the picture, in pixels: nearly the whole height of the picture.
const GOAT_HEIGHT: u32 = 42;

/// A pixel with an alpha below this value counts as empty when the margins are cut.
const MIN_ALPHA: u8 = 16;

/// The frames of the walk, ready to draw. Loaded once, at the first use.
static FRAMES: OnceLock<Vec<Sprite>> = OnceLock::new();

/// The frames of the walk of the goat. The list is empty when a frame cannot be read.
pub fn frames() -> &'static [Sprite] {
    FRAMES.get_or_init(|| load(&FRAME_FILES))
}

/// Reads the frames from PNG files, and cuts and scales them. All the frames get the same box, so that the goat does
/// not jump from one frame to the next.
fn load(files: &[&[u8]]) -> Vec<Sprite> {
    let images: Vec<Image<'static>> = files.iter().filter_map(|bytes| Image::from_bytes(bytes).ok()).collect();
    let Some(first) = images.first() else {
        return Vec::new();
    };
    let is_consistent = images.len() == files.len()
        && images.iter().all(|image| image.width() == first.width() && image.height() == first.height());
    if !is_consistent {
        return Vec::new();
    }
    let Some(region) = common_region(&images) else {
        return Vec::new();
    };
    images.iter().map(|image| scale(image, region, GOAT_HEIGHT)).collect()
}

/// A rectangle of an image, in pixels: the left and top sides are inside, the right and bottom sides are outside.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Region {
    left: u32,
    top: u32,
    right: u32,
    bottom: u32,
}

/// The smallest rectangle that holds every visible pixel of every image, or `None` when all the images are empty.
fn common_region(images: &[Image<'static>]) -> Option<Region> {
    let mut region: Option<Region> = None;
    for image in images {
        for y in 0..image.height() {
            for x in 0..image.width() {
                if image.rgba()[((y * image.width() + x) * 4 + 3) as usize] < MIN_ALPHA {
                    continue;
                }
                region = Some(match region {
                    None => Region { left: x, top: y, right: x + 1, bottom: y + 1 },
                    Some(known) => Region {
                        left: known.left.min(x),
                        top: known.top.min(y),
                        right: known.right.max(x + 1),
                        bottom: known.bottom.max(y + 1),
                    },
                });
            }
        }
    }
    region
}

/// Scales `region` of `image` to `target_height` pixels high, in the same proportions, by the average of the pixels
/// that fall in each new pixel. The colors are weighted by the alpha, so that a transparent pixel does not darken the
/// edge of the goat.
fn scale(image: &Image<'static>, region: Region, target_height: u32) -> Sprite {
    let step = (region.bottom - region.top) as f32 / target_height as f32;
    let target_width = (((region.right - region.left) as f32 / step).round() as u32).max(1);
    let rgba = image.rgba();
    let mut pixels = vec![0u8; (target_width * target_height * 4) as usize];
    for target_y in 0..target_height {
        for target_x in 0..target_width {
            let x_from = region.left as f32 + target_x as f32 * step;
            let y_from = region.top as f32 + target_y as f32 * step;
            let (x_to, y_to) = (x_from + step, y_from + step);
            let (mut weight_sum, mut alpha_sum, mut color_sum) = (0.0f32, 0.0f32, [0.0f32; 3]);
            for y in (y_from.floor() as u32)..(y_to.ceil() as u32).min(region.bottom) {
                for x in (x_from.floor() as u32)..(x_to.ceil() as u32).min(region.right) {
                    let overlap_x = (x_to.min((x + 1) as f32) - x_from.max(x as f32)).max(0.0);
                    let overlap_y = (y_to.min((y + 1) as f32) - y_from.max(y as f32)).max(0.0);
                    let weight = overlap_x * overlap_y;
                    let offset = ((y * image.width() + x) * 4) as usize;
                    let alpha = rgba[offset + 3] as f32 / 255.0;
                    weight_sum += weight;
                    alpha_sum += weight * alpha;
                    for channel in 0..3 {
                        color_sum[channel] += weight * alpha * rgba[offset + channel] as f32;
                    }
                }
            }
            if weight_sum > 0.0 && alpha_sum > 0.0 {
                let offset = ((target_y * target_width + target_x) * 4) as usize;
                for channel in 0..3 {
                    pixels[offset + channel] = (color_sum[channel] / alpha_sum).round().clamp(0.0, 255.0) as u8;
                }
                pixels[offset + 3] = (alpha_sum / weight_sum * 255.0).round().clamp(0.0, 255.0) as u8;
            }
        }
    }
    Sprite { width: target_width, height: target_height, pixels }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(width: u32, height: u32, pixel: [u8; 4]) -> Image<'static> {
        Image::new_owned(pixel.repeat((width * height) as usize), width, height)
    }

    #[test]
    fn the_eight_frames_of_the_walk_are_read_and_have_the_same_size() {
        let frames = frames();
        assert_eq!(frames.len(), 8);
        assert!(frames.iter().all(|frame| frame.height == GOAT_HEIGHT && frame.width == frames[0].width));
        assert!(frames[0].width > 10);
    }

    #[test]
    fn the_frames_of_the_walk_are_not_all_the_same_picture() {
        let frames = frames();
        assert!(frames.iter().any(|frame| frame.pixels != frames[0].pixels));
    }

    #[test]
    fn the_goat_is_visible_and_the_corner_of_the_frame_is_transparent() {
        let frame = &frames()[0];
        let visible = frame.pixels.chunks(4).filter(|pixel| pixel[3] > 200).count();
        assert!(visible > 200);
        assert_eq!(frame.pixels[3], 0);
    }

    #[test]
    fn scaling_a_solid_image_keeps_its_color_and_its_proportions() {
        let image = solid(8, 4, [200, 100, 50, 255]);
        let region = Region { left: 0, top: 0, right: 8, bottom: 4 };
        let sprite = scale(&image, region, 2);
        assert_eq!((sprite.width, sprite.height), (4, 2));
        assert!(sprite.pixels.chunks(4).all(|pixel| pixel == [200, 100, 50, 255]));
    }

    #[test]
    fn scaling_a_transparent_image_gives_a_transparent_sprite() {
        let image = solid(4, 4, [255, 255, 255, 0]);
        let sprite = scale(&image, Region { left: 0, top: 0, right: 4, bottom: 4 }, 2);
        assert!(sprite.pixels.iter().all(|byte| *byte == 0));
    }

    #[test]
    fn a_transparent_pixel_does_not_darken_the_color_of_its_neighbors() {
        let pixels = [[255, 0, 0, 255], [0, 0, 0, 0], [255, 0, 0, 255], [0, 0, 0, 0]].concat();
        let image = Image::new_owned(pixels, 2, 2);
        let sprite = scale(&image, Region { left: 0, top: 0, right: 2, bottom: 2 }, 1);
        assert_eq!(&sprite.pixels[..3], &[255, 0, 0]);
        assert_eq!(sprite.pixels[3], 128);
    }

    #[test]
    fn the_common_region_holds_the_visible_pixels_of_every_image() {
        let mut first = [0u8, 0, 0, 0].repeat(16);
        first[(1 * 4 + 1) * 4 + 3] = 255;
        let mut second = [0u8, 0, 0, 0].repeat(16);
        second[(2 * 4 + 3) * 4 + 3] = 255;
        let images = vec![Image::new_owned(first, 4, 4), Image::new_owned(second, 4, 4)];
        assert_eq!(common_region(&images), Some(Region { left: 1, top: 1, right: 4, bottom: 3 }));
        assert_eq!(common_region(&[solid(2, 2, [0, 0, 0, 0])]), None);
    }
}
