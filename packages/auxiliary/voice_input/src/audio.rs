//! The conversion of the audio of the microphone to the audio that Whisper reads: 16 kilohertz, one channel, numbers between -1
//! and 1. The functions here are pure: they open no device and no file.

/// The sample rate that Whisper reads, in hertz.
pub const WHISPER_RATE: u32 = 16_000;

/// The length of a window to measure the loudness, in milliseconds.
const WINDOW_MILLISECONDS: usize = 30;

/// Mixes the channels of interleaved audio into one channel: each frame becomes the average of its channels.
pub fn mix_to_mono(interleaved: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }
    interleaved.chunks(channels).map(|frame| frame.iter().sum::<f32>() / frame.len() as f32).collect()
}

/// Changes the sample rate of one channel of audio. Going to a lower rate averages the samples that fall in the span of each new
/// sample, which removes the sounds above the new limit. Going to a higher rate interpolates between two neighbors.
pub fn resample(mono: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || mono.is_empty() || from_rate == 0 || to_rate == 0 {
        return mono.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let output_length = (mono.len() as f64 / ratio).floor() as usize;
    let mut output = Vec::with_capacity(output_length);
    for index in 0..output_length {
        let start = index as f64 * ratio;
        if ratio > 1.0 {
            let end = start + ratio;
            let mut sum = 0.0f64;
            let mut position = start.floor() as usize;
            while (position as f64) < end && position < mono.len() {
                let weight = (end.min(position as f64 + 1.0) - start.max(position as f64)).max(0.0);
                sum += mono[position] as f64 * weight;
                position += 1;
            }
            output.push((sum / ratio) as f32);
        } else {
            let lower = start.floor() as usize;
            let upper = (lower + 1).min(mono.len() - 1);
            let fraction = (start - lower as f64) as f32;
            output.push(mono[lower] * (1.0 - fraction) + mono[upper] * fraction);
        }
    }
    output
}

/// Changes interleaved audio of any rate and any number of channels into the audio that Whisper reads.
pub fn to_whisper_samples(interleaved: &[f32], channels: usize, rate: u32) -> Vec<f32> {
    resample(&mix_to_mono(interleaved, channels), rate, WHISPER_RATE)
}

/// The loudness of the loudest window of 30 milliseconds: the root mean square of its samples. Speech reaches 0.02 or more, and
/// the noise of a quiet room stays under 0.002.
pub fn loudest_level(samples: &[f32], rate: u32) -> f32 {
    let window = (rate as usize * WINDOW_MILLISECONDS / 1000).max(1);
    samples
        .chunks(window)
        .map(|chunk| (chunk.iter().map(|sample| sample * sample).sum::<f32>() / chunk.len() as f32).sqrt())
        .fold(0.0, f32::max)
}

/// The level to draw for some samples, from 0 (silence) to 1 (loud): the root mean square of the samples, in decibels, from -60
/// decibels (0) to -10 decibels (1). A quiet room is under 0.05, and speech is between 0.5 and 0.9.
pub fn display_level(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let mean_square = samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32;
    if mean_square <= 0.0 {
        return 0.0;
    }
    let decibels = 10.0 * mean_square.log10();
    ((decibels + 60.0) / 50.0).clamp(0.0, 1.0)
}

/// Every sample is an exact zero. A real microphone always adds a little noise, so only a refused permission or a microphone
/// that is off gives this.
pub fn is_digital_silence(samples: &[f32]) -> bool {
    samples.is_empty() == false && samples.iter().all(|sample| *sample == 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_channels_become_their_average() {
        assert_eq!(mix_to_mono(&[1.0, 0.0, 0.5, 0.5], 2), vec![0.5, 0.5]);
        assert_eq!(mix_to_mono(&[0.25, 0.5], 1), vec![0.25, 0.5]);
    }

    #[test]
    fn a_rate_of_48000_hertz_gives_one_third_of_the_samples() {
        let input: Vec<f32> = (0..4800).map(|index| (index as f32 / 48.0).sin()).collect();
        let output = resample(&input, 48_000, 16_000);
        assert_eq!(output.len(), 1600);
    }

    #[test]
    fn going_down_averages_the_samples_of_the_span() {
        let output = resample(&[0.0, 3.0, 6.0, 9.0, 12.0, 15.0], 48_000, 16_000);
        assert_eq!(output, vec![3.0, 12.0]);
    }

    #[test]
    fn a_sound_that_the_new_rate_cannot_hold_is_removed() {
        // 24 kilohertz alternating samples at 48 kilohertz are above the limit of 8 kilohertz of the new rate.
        let input: Vec<f32> = (0..4800).map(|index| if index % 2 == 0 { 1.0 } else { -1.0 }).collect();
        let output = resample(&input, 48_000, 16_000);
        assert!(loudest_level(&output, 16_000) < 0.4);
    }

    #[test]
    fn a_rate_of_44100_hertz_keeps_the_duration() {
        let output = resample(&vec![0.5; 44_100], 44_100, 16_000);
        assert!((output.len() as i64 - 16_000).abs() <= 1);
        assert!(output.iter().all(|sample| (*sample - 0.5).abs() < 1e-5));
    }

    #[test]
    fn going_up_interpolates_between_neighbors() {
        assert_eq!(resample(&[0.0, 1.0], 8_000, 16_000), vec![0.0, 0.5, 1.0, 1.0]);
    }

    #[test]
    fn the_same_rate_changes_nothing() {
        assert_eq!(resample(&[0.1, 0.2], 16_000, 16_000), vec![0.1, 0.2]);
        assert!(resample(&[], 48_000, 16_000).is_empty());
    }

    #[test]
    fn the_loudest_window_tells_speech_from_noise() {
        let mut samples = vec![0.001f32; 16_000];
        assert!(loudest_level(&samples, 16_000) < 0.002);
        for sample in samples.iter_mut().skip(7_680).take(480) {
            *sample = 0.1;
        }
        assert!((loudest_level(&samples, 16_000) - 0.1).abs() < 1e-4);
    }

    #[test]
    fn the_level_to_draw_goes_from_silence_to_loud() {
        assert_eq!(display_level(&[]), 0.0);
        assert_eq!(display_level(&[0.0; 100]), 0.0);
        assert!(display_level(&[0.0007; 480]) < 0.05, "a quiet room");
        let speech = display_level(&[0.05; 480]);
        assert!(speech > 0.5 && speech < 0.9, "speech {speech}");
        assert_eq!(display_level(&[0.5; 480]), 1.0);
        assert!(display_level(&[0.01; 480]) < display_level(&[0.1; 480]));
    }

    #[test]
    fn only_exact_zeros_are_digital_silence() {
        assert!(is_digital_silence(&[0.0; 100]));
        assert!(is_digital_silence(&[0.0, 0.0, 0.0001]) == false);
        assert!(is_digital_silence(&[]) == false);
    }
}
