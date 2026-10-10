//! Draws the picture of the status item in the macOS menu bar: four glossy buttons side by side.
//!
//! Every function here is pure: the same slots and the same time always give the same pixels. The module
//! `status_item` owns the timer and gives the time of each frame.

use std::f32::consts::PI;

/// Width of one slot, in pixels. The picture is drawn at twice the size of the menu bar, for Retina screens.
pub const SLOT_WIDTH: u32 = 48;

/// Height of the picture, in pixels. The library that shows the picture in the menu bar always scales it to 18 points
/// high. Empty space above and below the discs would make the discs smaller than the icons of the other applications,
/// so the discs nearly fill the height.
pub const PICTURE_HEIGHT: u32 = 44;

/// Outer radius of the disc or the ring of a slot, in pixels.
const RADIUS: f32 = 18.0;

/// Inner radius of the ring of a slot, in pixels.
const RING_INNER_RADIUS: f32 = 12.0;

/// Width of the glow around a pulsing disc, in pixels.
const HALO_WIDTH: f32 = 4.0;

/// Empty space on the left and on the right of the whole picture, in pixels.
pub const PICTURE_PADDING: u32 = 16;

/// Empty space on each side of a sprite, in pixels.
const SPRITE_MARGIN: u32 = 2;

/// Number of frames of a walking sprite per second.
const WALK_FRAMES_PER_SECOND: f32 = 8.0;

/// Color of the glow behind the whole picture while an agent stays blocked for too long: red, green, blue.
const BLOCKED_ALARM_COLOR: [u8; 3] = [235, 64, 52];

/// Number of pulses per second of the glow behind the whole picture.
const ALARM_FREQUENCY: f32 = 1.2;

/// Radius of the rounded corners of the glow behind the whole picture, in pixels.
const ALARM_CORNER_RADIUS: f32 = 12.0;

/// Number of pulses per second of a pulsing disc.
const PULSE_FREQUENCY: f32 = 0.8;

/// Direction of the light that shines on the buttons: from the top left, toward the viewer.
const LIGHT: [f32; 3] = [-0.35, -0.55, 0.75];

/// The animation of a disc.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Effect {
    /// The disc does not move.
    None,
    /// A glow around the disc grows and shrinks.
    Pulse,
    /// A bright spot turns around the edge of the disc.
    Orbit,
    /// A band of light crosses the disc every few seconds.
    Shine,
}

/// One slot of the picture.
#[derive(Clone, Debug)]
pub enum Slot {
    /// A glossy disc with the number of agents inside. A disc with the number zero is dim and does not move.
    Disc {
        /// Number of agents. Numbers above 99 are drawn as 99.
        count: usize,
        /// Color of the disc: red, green, blue.
        color: [u8; 3],
        /// Animation of the disc when the number is not zero.
        effect: Effect,
    },
    /// A glossy ring that fills clockwise from the top with a percentage.
    Ring {
        /// Share of the ring that is filled, from 0 to 100. `None` draws an empty ring.
        percent: Option<f64>,
        /// Color of the filled part: red, green, blue.
        color: [u8; 3],
        /// `true` makes the ring pulse.
        is_urgent: bool,
    },
    /// A small picture with several frames, for example the baby goat. The slot is as wide as the frames.
    Sprite {
        /// The frames of the walk. All the frames have the same size.
        frames: &'static [Sprite],
        /// `true` plays the frames in a loop, `false` shows the first frame.
        is_walking: bool,
    },
}

/// A small picture: red, green, blue, alpha bytes, row by row.
#[derive(Clone, Debug)]
pub struct Sprite {
    /// Width in pixels.
    pub width: u32,
    /// Height in pixels.
    pub height: u32,
    /// The pixels, `width * height * 4` bytes.
    pub pixels: Vec<u8>,
}

impl Slot {
    /// Width of the slot, in pixels.
    pub fn width(&self) -> u32 {
        match self {
            Slot::Sprite { frames, .. } => frames.first().map_or(0, |frame| frame.width + 2 * SPRITE_MARGIN),
            _ => SLOT_WIDTH,
        }
    }

    /// True when the slot looks different from one frame to the next.
    pub fn is_animated(&self) -> bool {
        match self {
            Slot::Disc { count, effect, .. } => *count > 0 && *effect != Effect::None,
            Slot::Ring { is_urgent, .. } => *is_urgent,
            Slot::Sprite { frames, is_walking } => *is_walking && frames.len() > 1,
        }
    }
}

/// Width of the slots side by side, in pixels.
pub fn slots_width(slots: &[Slot]) -> u32 {
    slots.iter().map(Slot::width).sum()
}

/// Width of the whole picture: the slots side by side, and the empty space on the left and on the right.
pub fn picture_width(slots: &[Slot]) -> u32 {
    slots_width(slots) + 2 * PICTURE_PADDING
}

/// True when at least one slot moves, so that the picture must be drawn again for every frame.
pub fn is_animated(slots: &[Slot]) -> bool {
    slots.iter().any(Slot::is_animated)
}

/// A color with red, green, blue, alpha, each from 0 to 1. The alpha is not multiplied into the other values.
type Color = [f32; 4];

const TRANSPARENT: Color = [0.0, 0.0, 0.0, 0.0];

/// Puts `top` over `bottom`.
fn over(top: Color, bottom: Color) -> Color {
    let alpha = top[3] + bottom[3] * (1.0 - top[3]);
    if alpha <= 0.0 {
        return TRANSPARENT;
    }
    let mix = |index: usize| (top[index] * top[3] + bottom[index] * bottom[3] * (1.0 - top[3])) / alpha;
    [mix(0), mix(1), mix(2), alpha]
}

/// Smooth step from 0 at `from` to 1 at `to`.
fn smooth_step(from: f32, to: f32, value: f32) -> f32 {
    let x = ((value - from) / (to - from)).clamp(0.0, 1.0);
    x * x * (3.0 - 2.0 * x)
}

fn normalize(vector: [f32; 3]) -> [f32; 3] {
    let length = (vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]).sqrt();
    [vector[0] / length, vector[1] / length, vector[2] / length]
}

fn to_float(color: [u8; 3]) -> [f32; 3] {
    [color[0] as f32 / 255.0, color[1] as f32 / 255.0, color[2] as f32 / 255.0]
}

///////////////////////////////////////////////////////////////////////////////
// Digits
///////////////////////////////////////////////////////////////////////////////

/// Digits of a font that is 3 pixels wide and 5 pixels high. Each row is 3 bits, the left pixel is the highest bit.
const DIGIT_ROWS: [[u8; 5]; 10] = [
    [0b111, 0b101, 0b101, 0b101, 0b111],
    [0b010, 0b110, 0b010, 0b010, 0b111],
    [0b111, 0b001, 0b111, 0b100, 0b111],
    [0b111, 0b001, 0b111, 0b001, 0b111],
    [0b101, 0b101, 0b111, 0b001, 0b001],
    [0b111, 0b100, 0b111, 0b001, 0b111],
    [0b111, 0b100, 0b111, 0b101, 0b111],
    [0b111, 0b001, 0b001, 0b010, 0b010],
    [0b111, 0b101, 0b111, 0b101, 0b111],
    [0b111, 0b101, 0b111, 0b001, 0b111],
];

/// The pixels of a number, placed in the middle of a slot.
struct Digits {
    /// Left side of the first digit, in pixels from the left side of the slot.
    left: i32,
    /// Top side of the digits, in pixels from the top side of the slot.
    top: i32,
    /// Size of one font pixel, in pixels of the picture.
    scale: i32,
    /// The digits, from left to right.
    digits: Vec<usize>,
}

impl Digits {
    /// The digits of `count`, or `None` when the count is zero.
    fn of(count: usize) -> Option<Digits> {
        if count == 0 {
            return None;
        }
        let count = count.min(99);
        let digits: Vec<usize> = count.to_string().bytes().map(|byte| (byte - b'0') as usize).collect();
        let scale = if digits.len() == 1 { 4 } else { 3 };
        let width = digits.len() as i32 * 3 * scale + (digits.len() as i32 - 1) * scale;
        let height = 5 * scale;
        Some(Digits {
            left: (SLOT_WIDTH as i32 - width) / 2,
            top: (PICTURE_HEIGHT as i32 - height) / 2,
            scale,
            digits,
        })
    }

    /// True when the pixel (`x`, `y`) of the slot belongs to a digit.
    fn contains(&self, x: i32, y: i32) -> bool {
        let font_x = x - self.left;
        let font_y = y - self.top;
        if font_x < 0 || font_y < 0 {
            return false;
        }
        let column = font_x / self.scale;
        let row = font_y / self.scale;
        if row >= 5 {
            return false;
        }
        let digit_index = (column / 4) as usize;
        let column_in_digit = column % 4;
        if digit_index >= self.digits.len() || column_in_digit >= 3 {
            return false;
        }
        DIGIT_ROWS[self.digits[digit_index]][row as usize] >> (2 - column_in_digit) & 1 == 1
    }
}

///////////////////////////////////////////////////////////////////////////////
// Discs
///////////////////////////////////////////////////////////////////////////////

/// The color of the pixel at (`dx`, `dy`) from the center of a disc, without the digits.
fn disc_color(dx: f32, dy: f32, color: [u8; 3], is_dim: bool, effect: Effect, time: f32) -> Color {
    let distance = (dx * dx + dy * dy).sqrt();
    // A disc without agent is an unlit lamp: the same color, dark and dull, but still opaque.
    let base = to_float(color).map(|channel| if is_dim { channel * 0.3 + 0.12 } else { channel });
    let is_moving = !is_dim && effect != Effect::None;

    let pulse = 0.5 + 0.5 * (2.0 * PI * PULSE_FREQUENCY * time).sin();
    let mut halo = TRANSPARENT;
    if is_moving && effect == Effect::Pulse {
        let falloff = (1.0 - (distance - RADIUS).max(0.0) / HALO_WIDTH).clamp(0.0, 1.0);
        halo = [base[0], base[1], base[2], (0.1 + 0.4 * pulse) * falloff * falloff];
    }

    let coverage = (RADIUS + 0.5 - distance).clamp(0.0, 1.0);
    if coverage <= 0.0 {
        return halo;
    }

    // The disc is a ball lit from the top left.
    let nx = dx / RADIUS;
    let ny = dy / RADIUS;
    let radial = (nx * nx + ny * ny).min(1.0);
    let nz = (1.0 - radial).sqrt();
    let light = normalize(LIGHT);
    let diffuse = (nx * light[0] + ny * light[1] + nz * light[2]).max(0.0);
    let mut brightness = 0.55 + 0.65 * diffuse;
    brightness *= 1.0 - 0.3 * smooth_step(0.78, 1.0, radial.sqrt());
    if is_moving && effect == Effect::Pulse {
        brightness *= 1.0 + 0.1 * pulse;
    }
    let half = normalize([light[0], light[1], light[2] + 1.0]);
    let specular = (nx * half[0] + ny * half[1] + nz * half[2]).max(0.0).powi(28) * 0.9;

    let mut rgb = [
        base[0] * brightness + specular,
        base[1] * brightness + specular,
        base[2] * brightness + specular,
    ];

    // The glass: a pale ellipse across the upper part of the disc.
    let ellipse_x = nx / 0.72;
    let ellipse_y = (ny + 0.5) / 0.3;
    let ellipse = ellipse_x * ellipse_x + ellipse_y * ellipse_y;
    let mut gloss = if ellipse < 1.0 { 0.35 * (1.0 - ellipse) } else { 0.0 };

    if is_moving && effect == Effect::Orbit {
        let angle = dy.atan2(dx);
        let spot = time * 2.0 * PI * 0.9;
        let mut delta = (angle - spot) % (2.0 * PI);
        if delta > PI {
            delta -= 2.0 * PI;
        } else if delta < -PI {
            delta += 2.0 * PI;
        }
        let near_edge = smooth_step(0.7, 0.9, radial.sqrt());
        let lift = near_edge * (1.0 - delta.abs() / 0.9).max(0.0) * 0.7;
        for channel in rgb.iter_mut() {
            *channel += lift;
        }
    }

    if is_moving && effect == Effect::Shine {
        let progress = (time % 3.0) / 0.9;
        let position = -0.9 + progress * 1.8;
        let across = (dx + dy) / (2.0 * RADIUS);
        let lift = (1.0 - (across - position).abs() / 0.18).max(0.0) * 0.55;
        for channel in rgb.iter_mut() {
            *channel += lift;
        }
    }

    if is_dim {
        gloss *= 0.5;
    }
    let disc = over(
        [1.0, 1.0, 1.0, gloss],
        [rgb[0].clamp(0.0, 1.0), rgb[1].clamp(0.0, 1.0), rgb[2].clamp(0.0, 1.0), coverage],
    );
    over(disc, halo)
}

///////////////////////////////////////////////////////////////////////////////
// Rings
///////////////////////////////////////////////////////////////////////////////

/// The color of the pixel at (`dx`, `dy`) from the center of a ring.
fn ring_color(dx: f32, dy: f32, percent: Option<f64>, color: [u8; 3], is_urgent: bool, time: f32) -> Color {
    let distance = (dx * dx + dy * dy).sqrt();
    let coverage = (RADIUS + 0.5 - distance).clamp(0.0, 1.0) * (distance - RING_INNER_RADIUS + 0.5).clamp(0.0, 1.0);
    if coverage <= 0.0 {
        return TRANSPARENT;
    }
    let mut turn = dx.atan2(-dy) / (2.0 * PI);
    if turn < 0.0 {
        turn += 1.0;
    }
    let is_filled = match percent {
        Some(percent) => (turn as f64) * 100.0 <= percent.clamp(0.0, 100.0),
        None => false,
    };
    // A tube: the middle of the band is brighter than its two edges.
    let across = ((distance - RING_INNER_RADIUS) / (RADIUS - RING_INNER_RADIUS)).clamp(0.0, 1.0);
    let tube = 0.65 + 0.55 * (PI * across).sin();
    if is_filled {
        let urgency = if is_urgent { 1.0 + 0.25 * (0.5 + 0.5 * (2.0 * PI * 1.5 * time).sin()) } else { 1.0 };
        let base = to_float(color);
        let lit = |channel: f32| (channel * tube * urgency + 0.15 * (tube - 0.65).max(0.0)).clamp(0.0, 1.0);
        [lit(base[0]), lit(base[1]), lit(base[2]), coverage]
    } else {
        let gray = 0.6 * tube;
        [gray, gray, gray + 0.03, 0.4 * coverage]
    }
}

///////////////////////////////////////////////////////////////////////////////
// Sprites
///////////////////////////////////////////////////////////////////////////////

/// The frame of a sprite that is shown at `time` seconds: the walk plays in a loop, the stop shows the first frame.
fn frame_at(frames: &[Sprite], is_walking: bool, time: f32) -> Option<&Sprite> {
    if frames.is_empty() {
        return None;
    }
    let index = if is_walking { (time * WALK_FRAMES_PER_SECOND) as usize % frames.len() } else { 0 };
    frames.get(index)
}

/// The color of the pixel (`local_x`, `y`) of a sprite slot. The sprite stands in the middle of the height.
fn sprite_color(frames: &[Sprite], is_walking: bool, time: f32, local_x: u32, y: u32) -> Color {
    let Some(sprite) = frame_at(frames, is_walking, time) else {
        return TRANSPARENT;
    };
    let top = PICTURE_HEIGHT.saturating_sub(sprite.height) / 2;
    if local_x < SPRITE_MARGIN || y < top {
        return TRANSPARENT;
    }
    let (sprite_x, sprite_y) = (local_x - SPRITE_MARGIN, y - top);
    if sprite_x >= sprite.width || sprite_y >= sprite.height {
        return TRANSPARENT;
    }
    let offset = ((sprite_y * sprite.width + sprite_x) * 4) as usize;
    let byte = |channel: usize| sprite.pixels[offset + channel] as f32 / 255.0;
    [byte(0), byte(1), byte(2), byte(3)]
}

///////////////////////////////////////////////////////////////////////////////
// Picture
///////////////////////////////////////////////////////////////////////////////

/// True when the picture looks different from one frame to the next.
pub fn is_frame_animated(slots: &[Slot], is_alarm: bool) -> bool {
    is_alarm || is_animated(slots)
}

/// The red glow behind the whole picture, at the pixel (`x`, `y`) of a picture `width` pixels wide.
fn alarm_color(x: f32, y: f32, width: f32, time: f32) -> Color {
    let half_width = width / 2.0 - 1.0;
    let half_height = PICTURE_HEIGHT as f32 / 2.0 - 1.0;
    let to_corner_x = (x - width / 2.0).abs() - (half_width - ALARM_CORNER_RADIUS);
    let to_corner_y = (y - PICTURE_HEIGHT as f32 / 2.0).abs() - (half_height - ALARM_CORNER_RADIUS);
    let outside = (to_corner_x.max(0.0).powi(2) + to_corner_y.max(0.0).powi(2)).sqrt()
        + to_corner_x.max(to_corner_y).min(0.0)
        - ALARM_CORNER_RADIUS;
    let coverage = (0.5 - outside).clamp(0.0, 1.0);
    let pulse = 0.5 + 0.5 * (2.0 * PI * ALARM_FREQUENCY * time).sin();
    let color = to_float(BLOCKED_ALARM_COLOR);
    [color[0], color[1], color[2], coverage * (0.3 + 0.45 * pulse)]
}

/// Draws the whole picture: the slots with the empty space on the left and on the right. When `is_alarm` is true, a
/// red glow pulses behind everything, the empty space included. Returns the pixels as red, green, blue, alpha bytes,
/// row by row.
///
/// `time` is the time of the frame, in seconds. It moves the animations.
pub fn draw_frame(slots: &[Slot], is_alarm: bool, time: f32) -> Vec<u8> {
    let slots_pixels = draw_slots(slots, time);
    let width = picture_width(slots);
    let slots_row_bytes = (slots_width(slots) * 4) as usize;
    let padding_bytes = (PICTURE_PADDING * 4) as usize;
    let mut pixels = vec![0u8; (width * PICTURE_HEIGHT * 4) as usize];
    if slots_row_bytes > 0 {
        for (row, slots_row) in slots_pixels.chunks(slots_row_bytes).enumerate() {
            let start = row * (width * 4) as usize + padding_bytes;
            pixels[start..start + slots_row_bytes].copy_from_slice(slots_row);
        }
    }
    if is_alarm {
        for y in 0..PICTURE_HEIGHT {
            for x in 0..width {
                let offset = ((y * width + x) * 4) as usize;
                let drawn = [0, 1, 2, 3].map(|channel| pixels[offset + channel] as f32 / 255.0);
                let color = over(drawn, alarm_color(x as f32 + 0.5, y as f32 + 0.5, width as f32, time));
                for channel in 0..4 {
                    pixels[offset + channel] = (color[channel].clamp(0.0, 1.0) * 255.0).round() as u8;
                }
            }
        }
    }
    pixels
}

/// Draws the slots side by side, without the empty space and without the red glow, and returns the pixels as red,
/// green, blue, alpha bytes, row by row.
fn draw_slots(slots: &[Slot], time: f32) -> Vec<u8> {
    let width = slots_width(slots);
    let mut pixels = vec![0u8; (width * PICTURE_HEIGHT * 4) as usize];
    let center_y = PICTURE_HEIGHT as f32 / 2.0;
    let mut slot_left = 0;
    for slot in slots {
        let slot_width = slot.width();
        let center_x = slot_width as f32 / 2.0;
        let digits = match slot {
            Slot::Disc { count, .. } => Digits::of(*count),
            Slot::Ring { .. } | Slot::Sprite { .. } => None,
        };
        for y in 0..PICTURE_HEIGHT {
            for local_x in 0..slot_width {
                let dx = local_x as f32 + 0.5 - center_x;
                let dy = y as f32 + 0.5 - center_y;
                let mut color = match slot {
                    Slot::Disc { count, color, effect } => disc_color(dx, dy, *color, *count == 0, *effect, time),
                    Slot::Ring { percent, color, is_urgent } => ring_color(dx, dy, *percent, *color, *is_urgent, time),
                    Slot::Sprite { frames, is_walking } => sprite_color(frames, *is_walking, time, local_x, y),
                };
                if let Some(digits) = &digits {
                    if digits.contains(local_x as i32, y as i32 - 2) {
                        color = over([0.0, 0.0, 0.0, 0.45], color);
                    }
                    if digits.contains(local_x as i32, y as i32) {
                        color = [1.0, 1.0, 1.0, 1.0];
                    }
                }
                let x = slot_left + local_x;
                let offset = ((y * width + x) * 4) as usize;
                for channel in 0..4 {
                    pixels[offset + channel] = (color[channel].clamp(0.0, 1.0) * 255.0).round() as u8;
                }
            }
        }
        slot_left += slot_width;
    }
    pixels
}

#[cfg(test)]
mod tests {
    use super::*;

    const RED: [u8; 3] = [235, 64, 52];
    const BLUE: [u8; 3] = [10, 132, 255];

    /// The row in the middle of the picture, where the centers of the discs are.
    const MIDDLE: u32 = PICTURE_HEIGHT / 2;

    fn disc(count: usize, effect: Effect) -> Slot {
        Slot::Disc { count, color: RED, effect }
    }

    fn pixel(pixels: &[u8], width: u32, x: u32, y: u32) -> [u8; 4] {
        let offset = ((y * width + x) * 4) as usize;
        [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]]
    }

    fn brightness(color: [u8; 4]) -> u32 {
        color[0] as u32 + color[1] as u32 + color[2] as u32
    }

    #[test]
    fn the_picture_is_as_wide_as_the_slots() {
        let slots = vec![disc(1, Effect::None), disc(2, Effect::None), disc(3, Effect::None)];
        assert_eq!(draw_slots(&slots, 0.0).len() as u32, SLOT_WIDTH * 3 * PICTURE_HEIGHT * 4);
    }

    #[test]
    fn a_disc_is_lit_from_the_top_left() {
        let pixels = draw_slots(&[disc(0, Effect::None), disc(1, Effect::None)], 0.0);
        let width = SLOT_WIDTH * 2;
        let top_left = pixel(&pixels, width, SLOT_WIDTH + 14, MIDDLE - 10);
        let bottom_right = pixel(&pixels, width, SLOT_WIDTH + 34, MIDDLE + 12);
        assert!(brightness(top_left) > brightness(bottom_right) + 60);
    }

    #[test]
    fn the_corner_of_a_slot_is_transparent() {
        let pixels = draw_slots(&[disc(1, Effect::None)], 0.0);
        assert_eq!(pixel(&pixels, SLOT_WIDTH, 0, 0)[3], 0);
    }

    #[test]
    fn a_disc_without_agent_is_an_opaque_unlit_lamp_and_a_disc_with_agents_is_lit() {
        let pixels = draw_slots(&[disc(0, Effect::None), disc(1, Effect::None)], 0.0);
        let width = SLOT_WIDTH * 2;
        let unlit = pixel(&pixels, width, 14, MIDDLE);
        let lit = pixel(&pixels, width, SLOT_WIDTH + 14, MIDDLE);
        assert_eq!(unlit[3], 255);
        assert_eq!(lit[3], 255);
        assert!(brightness(lit) > brightness(unlit) + 100);
    }

    #[test]
    fn the_number_is_drawn_in_white_in_the_middle_of_the_disc() {
        let pixels = draw_slots(&[disc(1, Effect::None)], 0.0);
        let digits = Digits::of(1).expect("one agent has a digit");
        let (x, y) = (0..SLOT_WIDTH as i32)
            .flat_map(|x| (0..PICTURE_HEIGHT as i32).map(move |y| (x, y)))
            .find(|(x, y)| digits.contains(*x, *y))
            .expect("the digit has at least one pixel");
        assert_eq!(pixel(&pixels, SLOT_WIDTH, x as u32, y as u32), [255, 255, 255, 255]);
    }

    #[test]
    fn a_number_above_99_is_drawn_as_99() {
        let large = Digits::of(250).expect("a digit");
        let ninety_nine = Digits::of(99).expect("a digit");
        assert_eq!(large.digits, ninety_nine.digits);
        assert!(Digits::of(0).is_none());
    }

    #[test]
    fn a_pulsing_disc_changes_with_the_time_and_a_still_disc_does_not() {
        let at = |effect: Effect, time: f32| draw_slots(&[disc(1, effect)], time);
        assert_ne!(at(Effect::Pulse, 0.0), at(Effect::Pulse, 0.2));
        assert_eq!(at(Effect::None, 0.0), at(Effect::None, 0.2));
    }

    #[test]
    fn the_orbit_and_the_shine_change_with_the_time() {
        let at = |effect: Effect, time: f32| draw_slots(&[disc(1, effect)], time);
        assert_ne!(at(Effect::Orbit, 0.0), at(Effect::Orbit, 0.3));
        assert_ne!(at(Effect::Shine, 0.1), at(Effect::Shine, 0.4));
    }

    #[test]
    fn an_empty_disc_does_not_move() {
        let at = |time: f32| draw_slots(&[disc(0, Effect::Pulse)], time);
        assert_eq!(at(0.0), at(0.2));
    }

    #[test]
    fn the_picture_moves_only_when_a_slot_moves() {
        let still = vec![disc(0, Effect::Pulse), Slot::Ring { percent: Some(50.0), color: BLUE, is_urgent: false }];
        let moving = vec![disc(2, Effect::Pulse)];
        let urgent = vec![Slot::Ring { percent: Some(95.0), color: RED, is_urgent: true }];
        assert!(!is_animated(&still));
        assert!(is_animated(&moving));
        assert!(is_animated(&urgent));
    }

    #[test]
    fn a_ring_fills_clockwise_from_the_top() {
        let slots = [Slot::Ring { percent: Some(50.0), color: BLUE, is_urgent: false }];
        let pixels = draw_slots(&slots, 0.0);
        let right = pixel(&pixels, SLOT_WIDTH, 24 + 15, MIDDLE);
        let left = pixel(&pixels, SLOT_WIDTH, 24 - 15, MIDDLE);
        assert_eq!(right[3], 255);
        assert!(left[3] < 140);
    }

    fn sprite_frames() -> &'static [Sprite] {
        let frame = |red: u8| Sprite { width: 4, height: 4, pixels: [red, 0, 0, 255].repeat(16) };
        Box::leak(vec![frame(10), frame(20), frame(30)].into_boxed_slice())
    }

    #[test]
    fn a_sprite_slot_is_as_wide_as_its_frames_plus_a_margin_on_each_side() {
        let sprite = Slot::Sprite { frames: sprite_frames(), is_walking: false };
        assert_eq!(sprite.width(), 4 + 2 * SPRITE_MARGIN);
        assert_eq!(slots_width(&[sprite, disc(1, Effect::None)]), 4 + 2 * SPRITE_MARGIN + SLOT_WIDTH);
    }

    #[test]
    fn the_slot_after_a_sprite_starts_where_the_sprite_slot_ends() {
        let sprite = Slot::Sprite { frames: sprite_frames(), is_walking: false };
        let sprite_width = sprite.width();
        let slots = [sprite, disc(1, Effect::None)];
        let pixels = draw_slots(&slots, 0.0);
        let width = slots_width(&slots);
        assert_eq!(pixels.len() as u32, width * PICTURE_HEIGHT * 4);
        assert_eq!(pixel(&pixels, width, sprite_width + 14, MIDDLE)[3], 255);
        assert_eq!(pixel(&pixels, width, sprite_width + 2, 0)[3], 0);
    }

    #[test]
    fn a_walking_sprite_plays_its_frames_and_a_stopped_sprite_shows_the_first_frame() {
        let red_at = |is_walking: bool, time: f32| {
            let slots = [Slot::Sprite { frames: sprite_frames(), is_walking }];
            let pixels = draw_slots(&slots, time);
            pixel(&pixels, slots_width(&slots), SPRITE_MARGIN, MIDDLE - 2)[0]
        };
        assert_eq!(red_at(true, 0.0), 10);
        assert_eq!(red_at(true, 0.13), 20);
        assert_eq!(red_at(true, 0.26), 30);
        assert_eq!(red_at(true, 0.4), 10);
        assert_eq!(red_at(false, 0.26), 10);
    }

    #[test]
    fn a_sprite_stands_in_the_middle_of_the_height_and_the_margins_are_transparent() {
        let slots = [Slot::Sprite { frames: sprite_frames(), is_walking: false }];
        let pixels = draw_slots(&slots, 0.0);
        let width = slots_width(&slots);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE - 3)[3], 0);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE - 2)[3], 255);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE + 1)[3], 255);
        assert_eq!(pixel(&pixels, width, SPRITE_MARGIN, MIDDLE + 2)[3], 0);
        assert_eq!(pixel(&pixels, width, 0, MIDDLE - 2)[3], 0);
    }

    #[test]
    fn only_a_walking_sprite_makes_the_picture_move() {
        assert!(is_animated(&[Slot::Sprite { frames: sprite_frames(), is_walking: true }]));
        assert!(!is_animated(&[Slot::Sprite { frames: sprite_frames(), is_walking: false }]));
        assert!(!is_animated(&[Slot::Sprite { frames: &[], is_walking: true }]));
    }

    #[test]
    fn a_sprite_slot_without_frame_is_empty() {
        let slot = Slot::Sprite { frames: &[], is_walking: true };
        assert_eq!(slot.width(), 0);
        assert!(draw_slots(&[slot], 0.0).is_empty());
    }

    #[test]
    fn the_alarm_puts_a_red_glow_behind_the_whole_picture_and_the_glow_pulses() {
        let slots = [Slot::Sprite { frames: sprite_frames(), is_walking: false }, disc(1, Effect::None)];
        let width = picture_width(&slots);
        let quiet = draw_frame(&slots, false, 0.0);
        let at_low = draw_frame(&slots, true, 0.0);
        let at_high = draw_frame(&slots, true, 0.21);
        let behind_sprite = |pixels: &[u8]| pixel(pixels, width, 1, MIDDLE);
        assert_eq!(behind_sprite(&quiet)[3], 0);
        assert!(behind_sprite(&at_low)[3] > 0);
        assert!(behind_sprite(&at_low)[0] > 200);
        assert!(behind_sprite(&at_high)[3] > behind_sprite(&at_low)[3] + 40);
    }

    #[test]
    fn the_alarm_keeps_the_corners_of_the_picture_round() {
        let slots = [disc(1, Effect::None), disc(1, Effect::None)];
        let width = picture_width(&slots);
        let pixels = draw_frame(&slots, true, 0.2);
        assert_eq!(pixel(&pixels, width, 0, 0)[3], 0);
        assert_eq!(pixel(&pixels, width, width - 1, PICTURE_HEIGHT - 1)[3], 0);
    }

    #[test]
    fn the_picture_has_empty_space_on_the_left_and_on_the_right_of_the_slots() {
        let slots = [disc(1, Effect::None), disc(1, Effect::None)];
        let width = picture_width(&slots);
        assert_eq!(width, 2 * SLOT_WIDTH + 2 * PICTURE_PADDING);
        let pixels = draw_frame(&slots, false, 0.0);
        assert_eq!(pixels.len() as u32, width * PICTURE_HEIGHT * 4);
        for x in (0..PICTURE_PADDING).chain(width - PICTURE_PADDING..width) {
            assert_eq!(pixel(&pixels, width, x, PICTURE_HEIGHT / 2)[3], 0);
        }
    }

    #[test]
    fn the_first_slot_starts_after_the_empty_space_and_keeps_its_pixels() {
        let slots = [disc(1, Effect::None)];
        let width = picture_width(&slots);
        let frame = draw_frame(&slots, false, 0.0);
        let content = draw_slots(&slots, 0.0);
        let slots_width = slots_width(&slots);
        for y in 0..PICTURE_HEIGHT {
            for x in 0..slots_width {
                assert_eq!(pixel(&frame, width, PICTURE_PADDING + x, y), pixel(&content, slots_width, x, y));
            }
        }
    }

    #[test]
    fn the_red_glow_also_covers_the_empty_space_on_the_left_and_on_the_right() {
        let slots = [disc(1, Effect::None)];
        let width = picture_width(&slots);
        let pixels = draw_frame(&slots, true, 0.0);
        assert!(pixel(&pixels, width, 2, PICTURE_HEIGHT / 2)[3] > 0);
        assert!(pixel(&pixels, width, width - 3, PICTURE_HEIGHT / 2)[3] > 0);
    }

    #[test]
    fn a_picture_without_slot_is_empty_space_only() {
        let width = picture_width(&[]);
        assert_eq!(width, 2 * PICTURE_PADDING);
        assert!(draw_frame(&[], false, 0.0).iter().all(|byte| *byte == 0));
    }

    #[test]
    fn the_alarm_makes_the_picture_move_even_when_no_slot_moves() {
        let still = [disc(0, Effect::None)];
        assert!(!is_frame_animated(&still, false));
        assert!(is_frame_animated(&still, true));
    }

    #[test]
    fn the_middle_of_a_ring_is_transparent() {
        let slots = [Slot::Ring { percent: Some(100.0), color: BLUE, is_urgent: false }];
        let pixels = draw_slots(&slots, 0.0);
        assert_eq!(pixel(&pixels, SLOT_WIDTH, 24, MIDDLE)[3], 0);
    }
}
