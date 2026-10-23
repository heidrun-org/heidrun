//! The change of speech into text with Whisper, on the computer. The speech never leaves the computer.

use crate::audio;
use crate::error::VoiceError;
use crate::models::{is_known_language, WhisperModel};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// A recording under this loudness (the loudest window of 30 milliseconds) has no speech.
pub const SPEECH_LEVEL: f32 = 0.006;

/// A segment that Whisper believes is not speech with a probability above this is dropped.
const NO_SPEECH_LIMIT: f32 = 0.6;

/// Whisper wants at least one second of audio; a shorter recording is padded with silence.
const MINIMUM_WHISPER_SAMPLES: usize = audio::WHISPER_RATE as usize + 1600;

/// The model that is in memory, and the file it came from.
struct LoadedModel {
    /// The file that the model was read from.
    path: PathBuf,
    /// The model in memory.
    context: WhisperContext,
}

/// Changes speech into text. It keeps the last model in memory, because loading a model takes up to a few seconds.
pub struct Transcriber {
    /// The model in memory, if any.
    loaded: Mutex<Option<LoadedModel>>,
}

impl Default for Transcriber {
    fn default() -> Self {
        Transcriber::new()
    }
}

impl Transcriber {
    /// A transcriber with no model in memory.
    pub fn new() -> Transcriber {
        crate::whisper_log::install_hook();
        Transcriber { loaded: Mutex::new(None) }
    }

    /// Changes the audio (16 kilohertz, one channel) into text. A recording with no speech gives an empty text and no error.
    /// `language` is `auto` or a code of the list. A model for English only always understands English.
    pub fn transcribe(&self, model_path: &Path, model: &WhisperModel, language: &str, samples: &[f32]) -> Result<String, VoiceError> {
        if is_known_language(language) == false {
            return Err(VoiceError::UnknownLanguage(language.to_string()));
        }
        if has_speech(samples) == false {
            return Ok(String::new());
        }
        if model_path.is_file() == false {
            return Err(VoiceError::ModelMissing(model.id.to_string()));
        }
        let mut guard = self.loaded.lock().map_err(|_| VoiceError::ModelLoadFailed("the model lock is broken".to_string()))?;
        let is_loaded = guard.as_ref().map(|loaded| loaded.path == model_path).unwrap_or(false);
        if is_loaded == false {
            *guard = None;
            let path_text = model_path.to_str().ok_or_else(|| VoiceError::ModelLoadFailed("the path is not text".to_string()))?;
            let context = WhisperContext::new_with_params(path_text, WhisperContextParameters::default())
                .map_err(|error| VoiceError::ModelLoadFailed(error.to_string()))?;
            *guard = Some(LoadedModel { path: model_path.to_path_buf(), context });
        }
        let loaded = guard.as_ref().ok_or_else(|| VoiceError::ModelLoadFailed("no model in memory".to_string()))?;
        let mut state = loaded.context.create_state().map_err(|error| VoiceError::TranscriptionFailed(error.to_string()))?;
        let mut parameters = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        let spoken_language = if model.is_english_only { "en" } else { language };
        parameters.set_language(Some(spoken_language));
        parameters.set_print_progress(false);
        parameters.set_print_realtime(false);
        parameters.set_print_special(false);
        parameters.set_print_timestamps(false);
        parameters.set_no_speech_thold(NO_SPEECH_LIMIT);
        let threads = std::thread::available_parallelism().map(|count| count.get()).unwrap_or(4).min(8);
        parameters.set_n_threads(threads as i32);
        let mut padded: Vec<f32>;
        let input: &[f32] = if samples.len() < MINIMUM_WHISPER_SAMPLES {
            padded = samples.to_vec();
            padded.resize(MINIMUM_WHISPER_SAMPLES, 0.0);
            &padded
        } else {
            samples
        };
        state.full(parameters, input).map_err(|error| VoiceError::TranscriptionFailed(error.to_string()))?;
        let segments: Vec<(String, f32)> = state
            .as_iter()
            .map(|segment| (segment.to_str_lossy().map(|text| text.to_string()).unwrap_or_default(), segment.no_speech_probability()))
            .collect();
        Ok(clean_text(&segments))
    }
}

/// The recording is long enough and loud enough to hold speech.
pub fn has_speech(samples: &[f32]) -> bool {
    samples.len() as f32 / audio::WHISPER_RATE as f32 >= crate::recording::MINIMUM_SECONDS
        && audio::loudest_level(samples, audio::WHISPER_RATE) >= SPEECH_LEVEL
}

/// Joins the segments of Whisper into one text. It drops a segment that Whisper believes is not speech, and a segment that is
/// only a tag of a sound, such as `[BLANK_AUDIO]` or `(music)`.
pub fn clean_text(segments: &[(String, f32)]) -> String {
    let kept: Vec<&str> = segments
        .iter()
        .filter(|(text, no_speech)| *no_speech <= NO_SPEECH_LIMIT && is_sound_tag(text.trim()) == false)
        .map(|(text, _)| text.trim())
        .filter(|text| text.is_empty() == false)
        .collect();
    kept.join(" ").split_whitespace().collect::<Vec<&str>>().join(" ")
}

fn is_sound_tag(text: &str) -> bool {
    let wrapped = (text.starts_with('[') && text.ends_with(']')) || (text.starts_with('(') && text.ends_with(')'));
    let starred = text.len() > 1 && text.starts_with('*') && text.ends_with('*');
    wrapped || starred
}

#[cfg(test)]
mod tests {
    use super::*;

    fn segment(text: &str, no_speech: f32) -> (String, f32) {
        (text.to_string(), no_speech)
    }

    #[test]
    fn the_segments_join_into_one_text() {
        let segments = [segment(" Run the tests", 0.01), segment(" again.  ", 0.02)];
        assert_eq!(clean_text(&segments), "Run the tests again.");
    }

    #[test]
    fn a_tag_of_a_sound_is_dropped() {
        let segments = [segment(" [BLANK_AUDIO]", 0.1), segment("(upbeat music)", 0.1), segment("*sigh*", 0.1), segment("Hello", 0.1)];
        assert_eq!(clean_text(&segments), "Hello");
    }

    #[test]
    fn a_segment_that_is_probably_not_speech_is_dropped() {
        assert_eq!(clean_text(&[segment("Thanks for watching!", 0.9)]), "");
    }

    #[test]
    fn a_text_that_only_has_a_bracket_inside_is_kept() {
        assert_eq!(clean_text(&[segment("Call f(x) now", 0.1)]), "Call f(x) now");
    }

    #[test]
    fn a_short_or_quiet_recording_has_no_speech() {
        assert!(has_speech(&vec![0.1; 1000]) == false);
        assert!(has_speech(&vec![0.001; 32_000]) == false);
        assert!(has_speech(&vec![0.1; 32_000]));
    }

    #[test]
    fn a_recording_with_no_speech_gives_no_text_and_no_error() {
        let transcriber = Transcriber::new();
        let model = crate::models::find_model("tiny").unwrap();
        let text = transcriber.transcribe(Path::new("/no/such/model.bin"), model, "auto", &vec![0.0005; 32_000]).unwrap();
        assert_eq!(text, "");
    }

    #[test]
    fn an_unknown_language_is_refused() {
        let transcriber = Transcriber::new();
        let model = crate::models::find_model("tiny").unwrap();
        let error = transcriber.transcribe(Path::new("/no/such/model.bin"), model, "xx", &vec![0.1; 32_000]).unwrap_err();
        assert_eq!(error.category(), "unknown_language");
    }

    #[test]
    fn a_missing_model_file_is_reported() {
        let transcriber = Transcriber::new();
        let model = crate::models::find_model("tiny").unwrap();
        let error = transcriber.transcribe(Path::new("/no/such/model.bin"), model, "auto", &vec![0.1; 32_000]).unwrap_err();
        assert_eq!(error, VoiceError::ModelMissing("tiny".to_string()));
    }

    #[test]
    fn a_file_that_is_not_a_model_is_reported_as_a_load_failure() {
        let file = std::env::temp_dir().join(format!("voice_input_not_a_model_{}.bin", std::process::id()));
        std::fs::write(&file, b"this is not a Whisper model").unwrap();
        let transcriber = Transcriber::new();
        let model = crate::models::find_model("tiny").unwrap();
        let error = transcriber.transcribe(&file, model, "auto", &vec![0.1; 32_000]).unwrap_err();
        assert_eq!(error.category(), "model_load_failed");
        std::fs::remove_file(&file).unwrap();
    }
}
