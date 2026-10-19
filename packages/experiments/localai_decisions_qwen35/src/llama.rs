//! A small safe layer over the C functions of llama.cpp (crate `llama-cpp-sys-2`).
//!
//! The package does not use the crate `llama-cpp-2`, because it hides the raw context that the extended
//! batch needs, and its `chat_template(Some(name))` frees the name before llama.cpp reads it.

use std::ffi::{c_char, c_void, CStr, CString};
use std::path::Path;
use std::ptr::{self, NonNull};
use std::sync::{Arc, Once};

use anyhow::{bail, Context as _, Result};
use llama_cpp_sys_2 as sys;

/// A token identifier of the vocabulary of the model.
pub type Token = i32;

extern "C" {
    fn localai_decisions_set_decision_order(batch: *mut sys::llama_batch_ext, idx: i32, order: i32) -> bool;
}

static BACKEND: Once = Once::new();

unsafe extern "C" fn silent_log(_level: sys::ggml_log_level, _text: *const c_char, _user_data: *mut c_void) {}

fn init_backend(verbose: bool) {
    BACKEND.call_once(|| unsafe {
        if verbose == false {
            sys::llama_log_set(Some(silent_log), ptr::null_mut());
        }
        sys::llama_backend_init();
    });
}

/// Where the weights of the model and the computation go.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Device {
    /// The processor only.
    Cpu,
    /// Every layer on the GPU that the build includes (Metal, CUDA, or Vulkan).
    Gpu,
}

/// A loaded GGUF model.
pub struct Model {
    raw: NonNull<sys::llama_model>,
}

// SAFETY: llama.cpp allows a model to be read from several threads; the package never changes it.
unsafe impl Send for Model {}
unsafe impl Sync for Model {}

impl Model {
    /// Loads a GGUF file.
    pub fn load(path: &Path, device: Device, verbose: bool) -> Result<Self> {
        init_backend(verbose);
        let path_cstring = CString::new(path.to_string_lossy().as_bytes())?;
        // A list that holds only the end mark selects no device, so the model stays on the processor.
        let mut no_device: [sys::ggml_backend_dev_t; 1] = [ptr::null_mut()];
        let raw = unsafe {
            let mut params = sys::llama_model_default_params();
            match device {
                Device::Cpu => {
                    params.n_gpu_layers = 0;
                    params.devices = no_device.as_mut_ptr();
                }
                Device::Gpu => {
                    params.n_gpu_layers = -1;
                }
            }
            sys::llama_model_load_from_file(path_cstring.as_ptr(), params)
        };
        let raw = NonNull::new(raw).with_context(|| format!("llama.cpp could not load the model file {}", path.display()))?;
        Ok(Self { raw })
    }

    fn vocab(&self) -> *const sys::llama_vocab {
        unsafe { sys::llama_model_get_vocab(self.raw.as_ptr()) }
    }

    /// Returns the metadata value of `key` as text, or `None` when the model does not have the key.
    pub fn meta(&self, key: &str) -> Option<String> {
        let key_cstring = CString::new(key).ok()?;
        read_string(|buf, len| unsafe { sys::llama_model_meta_val_str(self.raw.as_ptr(), key_cstring.as_ptr(), buf, len) })
    }

    /// Returns all metadata keys and values as text.
    pub fn meta_entries(&self) -> Vec<(String, String)> {
        let count = unsafe { sys::llama_model_meta_count(self.raw.as_ptr()) };
        let mut out = Vec::new();
        for i in 0..count {
            let key = read_string(|buf, len| unsafe { sys::llama_model_meta_key_by_index(self.raw.as_ptr(), i, buf, len) });
            let value = read_string(|buf, len| unsafe { sys::llama_model_meta_val_str_by_index(self.raw.as_ptr(), i, buf, len) });
            if let (Some(key), Some(value)) = (key, value) {
                out.push((key, value));
            }
        }
        out
    }

    /// Splits a text into tokens, as `common_tokenize` of llama.cpp.
    pub fn tokenize(&self, text: &str, add_special: bool, parse_special: bool) -> Vec<Token> {
        let bytes = text.as_bytes();
        let mut tokens: Vec<Token> = vec![0; bytes.len() + 2 * usize::from(add_special) + 1];
        let mut n = unsafe {
            sys::llama_tokenize(
                self.vocab(),
                bytes.as_ptr().cast(),
                bytes.len() as i32,
                tokens.as_mut_ptr(),
                tokens.len() as i32,
                add_special,
                parse_special,
            )
        };
        if n < 0 {
            tokens.resize((-n) as usize, 0);
            n = unsafe {
                sys::llama_tokenize(
                    self.vocab(),
                    bytes.as_ptr().cast(),
                    bytes.len() as i32,
                    tokens.as_mut_ptr(),
                    tokens.len() as i32,
                    add_special,
                    parse_special,
                )
            };
        }
        tokens.truncate(n.max(0) as usize);
        tokens
    }

    /// The number of tokens of the vocabulary.
    pub fn n_vocab(&self) -> usize {
        unsafe { sys::llama_vocab_n_tokens(self.vocab()) as usize }
    }

    /// The width of one row of the embeddings output.
    pub fn n_embd_out(&self) -> usize {
        unsafe { sys::llama_model_n_embd_out(self.raw.as_ptr()) as usize }
    }
}

impl Drop for Model {
    fn drop(&mut self) {
        unsafe { sys::llama_model_free(self.raw.as_ptr()) }
    }
}

/// The settings of a context.
#[derive(Clone, Copy, Debug)]
pub struct ContextSettings {
    /// The number of positions of all sequences together.
    pub n_ctx: u32,
    /// The largest number of tokens of one evaluation.
    pub n_batch: u32,
    /// The largest number of sequences of the context.
    pub n_seq_max: u32,
    /// The number of processor threads.
    pub n_threads: i32,
    /// True to read the embeddings output of each token instead of the logits.
    pub embeddings: bool,
}

/// A context: the memory of the evaluated tokens and the outputs of the last evaluation.
pub struct Context {
    raw: NonNull<sys::llama_context>,
    model: Arc<Model>,
}

// SAFETY: a context is used by one thread at a time; the engine keeps it behind a mutex.
unsafe impl Send for Context {}

impl Context {
    /// Creates a context, with the settings that the server of llama.cpp uses for a decision model.
    pub fn new(model: Arc<Model>, settings: ContextSettings) -> Result<Self> {
        let raw = unsafe {
            let mut params = sys::llama_context_default_params();
            params.n_ctx = settings.n_ctx;
            params.n_batch = settings.n_batch;
            // The embeddings of a prompt must come from one physical batch.
            params.n_ubatch = settings.n_batch;
            params.n_seq_max = settings.n_seq_max;
            params.n_threads = settings.n_threads;
            params.n_threads_batch = settings.n_threads;
            params.kv_unified = true;
            params.no_perf = true;
            if settings.embeddings {
                params.embeddings = true;
                params.pooling_type = sys::LLAMA_POOLING_TYPE_NONE;
            }
            sys::llama_init_from_model(model.raw.as_ptr(), params)
        };
        let raw = NonNull::new(raw).context("llama.cpp could not create a context")?;
        Ok(Self { raw, model })
    }

    /// Forgets every evaluated token.
    pub fn clear(&mut self) {
        unsafe {
            let memory = sys::llama_get_memory(self.raw.as_ptr());
            if memory.is_null() == false {
                sys::llama_memory_clear(memory, true);
            }
        }
    }

    /// Evaluates a batch.
    pub fn process(&mut self, batch: &Batch) -> Result<()> {
        let result = unsafe { sys::llama_process(self.raw.as_ptr(), sys::LLAMA_PROCESS_TYPE_DECODE, batch.raw.as_ptr()) };
        if result != 0 {
            bail!("llama.cpp could not evaluate the prompt (error {result})");
        }
        Ok(())
    }

    /// The logits of the output at index `i` of the last batch.
    pub fn logits(&self, i: i32) -> Result<&[f32]> {
        let data = unsafe { sys::llama_get_logits_ith(self.raw.as_ptr(), i) };
        if data.is_null() {
            bail!("llama.cpp has no logits for the batch index {i}");
        }
        Ok(unsafe { std::slice::from_raw_parts(data, self.model.n_vocab()) })
    }

    /// The embeddings output at index `i` of the last batch.
    pub fn embeddings(&self, i: i32) -> Result<&[f32]> {
        let data = unsafe { sys::llama_get_embeddings_ith(self.raw.as_ptr(), i) };
        if data.is_null() {
            bail!("llama.cpp has no embeddings for the batch index {i}");
        }
        Ok(unsafe { std::slice::from_raw_parts(data, self.model.n_embd_out()) })
    }

    /// Creates an empty batch for this context.
    pub fn batch(&self) -> Result<Batch> {
        let raw = unsafe { sys::llama_batch_ext_init(self.raw.as_ptr()) };
        let raw = NonNull::new(raw).context("llama.cpp could not create a batch")?;
        Ok(Batch { raw })
    }
}

impl Drop for Context {
    fn drop(&mut self) {
        unsafe { sys::llama_free(self.raw.as_ptr()) }
    }
}

/// An extended batch of llama.cpp: the tokens of one evaluation.
pub struct Batch {
    raw: NonNull<sys::llama_batch_ext>,
}

impl Batch {
    /// Adds a token and returns its batch index.
    pub fn add(&mut self, token: Token, seq_id: i32, pos: i32, output: bool, decision_order: i32) -> Result<i32> {
        let idx = unsafe { sys::llama_batch_ext_add_token(self.raw.as_ptr(), seq_id, token) };
        if idx < 0 {
            bail!("llama.cpp could not add a token to the batch (error {idx})");
        }
        unsafe {
            sys::llama_batch_ext_set_pos(self.raw.as_ptr(), idx, &pos);
            if output {
                sys::llama_batch_ext_set_output_logits(self.raw.as_ptr(), idx, true);
            }
            if decision_order != 0 && localai_decisions_set_decision_order(self.raw.as_ptr(), idx, decision_order) == false {
                bail!("llama.cpp could not set the decision order of a token");
            }
        }
        Ok(idx)
    }

    /// Removes every token.
    pub fn clear(&mut self) {
        unsafe { sys::llama_batch_ext_clear(self.raw.as_ptr()) }
    }
}

impl Drop for Batch {
    fn drop(&mut self) {
        unsafe { sys::llama_batch_ext_free(self.raw.as_ptr()) }
    }
}

/// Calls a llama.cpp function that writes a text into a buffer, with a larger buffer when it is too small.
fn read_string(mut call: impl FnMut(*mut c_char, usize) -> i32) -> Option<String> {
    let mut buffer: Vec<u8> = vec![0; 256];
    let n = call(buffer.as_mut_ptr().cast(), buffer.len());
    if n < 0 {
        return None;
    }
    if n as usize >= buffer.len() {
        buffer = vec![0; n as usize + 1];
        call(buffer.as_mut_ptr().cast(), buffer.len());
    }
    let text = CStr::from_bytes_until_nul(&buffer).ok()?;
    Some(text.to_string_lossy().into_owned())
}

/// True when the build includes a GPU backend.
pub fn has_gpu_backend() -> bool {
    cfg!(any(feature = "metal", feature = "cuda", feature = "vulkan"))
}
