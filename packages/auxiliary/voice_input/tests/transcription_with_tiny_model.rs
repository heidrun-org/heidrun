//! The change of a spoken sentence into text, with the real Whisper model `tiny` (77 MB). The first run downloads the model
//! from Hugging Face into the folder of the build, which also tests the real download. The next runs read it from there.

use std::path::{Path, PathBuf};
use voice_input::{audio, download_model, find_model, model_path, Transcriber, MODELS_BASE_URL};

/// Reads the samples of a WAV file with 16-bit integers in one channel. The file has other chunks before the chunk `data`.
fn read_wav_samples(path: &Path) -> Vec<f32> {
    let bytes = std::fs::read(path).unwrap();
    assert_eq!(&bytes[0..4], b"RIFF");
    assert_eq!(&bytes[8..12], b"WAVE");
    let mut position = 12;
    while position + 8 <= bytes.len() {
        let name = &bytes[position..position + 4];
        let size = u32::from_le_bytes(bytes[position + 4..position + 8].try_into().unwrap()) as usize;
        if name == b"data" {
            return bytes[position + 8..position + 8 + size]
                .chunks(2)
                .map(|pair| i16::from_le_bytes([pair[0], pair[1]]) as f32 / 32768.0)
                .collect();
        }
        position += 8 + size + (size % 2);
    }
    panic!("the WAV file has no chunk data");
}

/// The folder where the tests keep the model, inside the folder of the build.
fn models_folder() -> PathBuf {
    PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("models")
}

/// The four tests run together, and only one of them downloads the model.
static TINY_MODEL: tokio::sync::OnceCell<PathBuf> = tokio::sync::OnceCell::const_new();

async fn tiny_model_path() -> PathBuf {
    TINY_MODEL
        .get_or_init(|| async {
            let model = find_model("tiny").unwrap();
            let path = model_path(&models_folder(), model);
            if path.is_file() == false {
                download_model(MODELS_BASE_URL, model, &models_folder(), |_| {})
                    .await
                    .expect("the download of the model tiny failed: the test needs the network once");
            }
            path
        })
        .await
        .clone()
}

fn words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|character: char| character.is_alphanumeric() == false)
        .filter(|word| word.is_empty() == false)
        .map(|word| word.to_string())
        .collect()
}

/// The words that the sentence of the file has.
const EXPECTED_WORDS: [&str; 14] =
    ["please", "run", "the", "tests", "again", "and", "tell", "me", "which", "one", "of", "them", "is", "failing"];

fn fixture() -> Vec<f32> {
    read_wav_samples(&Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/please_run_the_tests_again.wav"))
}

#[tokio::test]
async fn the_model_tiny_changes_a_spoken_sentence_into_text() {
    let path = tiny_model_path().await;
    let model = find_model("tiny").unwrap();
    let text = Transcriber::new().transcribe(&path, model, "en", &fixture()).unwrap();
    assert_eq!(words(&text)[..14], EXPECTED_WORDS, "the text was {text:?}");
}

#[tokio::test]
async fn the_sentence_survives_the_conversion_from_a_microphone_at_48_kilohertz_in_two_channels() {
    let path = tiny_model_path().await;
    let model = find_model("tiny").unwrap();
    let mono_48 = audio::resample(&fixture(), 16_000, 48_000);
    let stereo_48: Vec<f32> = mono_48.iter().flat_map(|sample| [*sample, *sample]).collect();
    let samples = audio::to_whisper_samples(&stereo_48, 2, 48_000);
    let text = Transcriber::new().transcribe(&path, model, "en", &samples).unwrap();
    assert_eq!(words(&text)[..14], EXPECTED_WORDS, "the text was {text:?}");
}

#[tokio::test]
async fn the_same_transcriber_reads_two_recordings_with_one_model_in_memory() {
    let path = tiny_model_path().await;
    let model = find_model("tiny").unwrap();
    let transcriber = Transcriber::new();
    let first = transcriber.transcribe(&path, model, "en", &fixture()).unwrap();
    let second = transcriber.transcribe(&path, model, "en", &fixture()).unwrap();
    assert_eq!(first, second);
}

#[tokio::test]
async fn a_quiet_room_gives_no_text() {
    let path = tiny_model_path().await;
    let model = find_model("tiny").unwrap();
    let noise: Vec<f32> = (0..48_000).map(|index| 0.001 * (((index * 7919) % 13) as f32 - 6.0) / 6.0).collect();
    let text = Transcriber::new().transcribe(&path, model, "auto", &noise).unwrap();
    assert_eq!(text, "");
}

#[tokio::test]
async fn the_logs_of_whisper_go_to_the_log_file() {
    let path = tiny_model_path().await;
    let model = find_model("tiny").unwrap();
    let log_path = Path::new(env!("CARGO_TARGET_TMPDIR")).join("logs").join("whisper.log");
    voice_input::whisper_log::write_to_file(&log_path).unwrap();
    Transcriber::new().transcribe(&path, model, "en", &fixture()).unwrap();
    let log = std::fs::read_to_string(&log_path).unwrap();
    assert!(log.contains("whisper_init_from_file_with_params_no_state: loading model from"), "the log was {log:?}");
    assert!(log.contains("whisper_full_with_state: "), "the log was {log:?}");
}
