# Local AI embeddings

`localai_embeddings` computes embeddings on your computer with a Rust library and command line tool. It accepts ordinary text or source code as text. Input text stays on your computer. This version handles text only; code is accepted as text, but the default model was trained for natural language rather than code search.

## Requirements

- Rust and Cargo.
- A CPU for the default backend.
- Internet access on the first run to download the model files.

The default model is `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, which produces 384-dimensional vectors and supports English, French, and other languages. Its files occupy approximately 460 MiB in the standard Hugging Face cache, normally `~/.cache/huggingface/hub`. Hugging Face cache environment variables can change that location.

## Compute an embedding

From the repository root, pass text, a file, or a pipe:

```bash
pnpm --filter localai_embeddings cli --text "Bonjour, ceci est un exemple."
pnpm --filter localai_embeddings cli --file README.md
cat ./notes.txt | pnpm --filter localai_embeddings cli
```

The package command runs inside the package folder: `--file README.md` reads this package's README. Use an absolute path for a file elsewhere. With no text, file, or pipe, the command prompts for pasted text and waits for Control-D.

Files must contain UTF-8 text and are read into memory. Binary documents need text extraction before use.

The JSON output contains `model`, `backend`, `dimensions`, and `documents`. Each document contains its source name, one `global_vector`, and `chunks`. Each chunk contains its source byte offsets, token count, text, and vector. Use `--output result.json` to save the output.

The `pnpm` command uses an optimized release build. The first invocation compiles the program; later invocations reuse the compiled program. Add `--verbose` to show input reading, timings for each model-loading stage, and embedding timings on standard error:

```bash
pnpm --filter localai_embeddings cli --verbose --file README.md --output /private/tmp/localai-embeddings.json
```

Compare the global vectors of exactly two inputs:

```bash
pnpm --filter localai_embeddings cli --compare \
  --text "The cat sleeps on the chair." \
  --text "A cat is resting on a seat."
```

## Long documents and chunking

The command embeds the whole document by splitting the document into chunks that fit the selected model. The default model uses its Sentence Transformers limit of **128 tokens**, including special tokens. The model's underlying BERT architecture supports 512 positions, but that architecture limit is not the preferred sentence embedding length. Other supported models use their own Sentence Transformers setting when present, bounded by the architecture limit.

`--chunking auto` chooses Markdown for `.md` files, code for source files such as `.rs`, and lines for `.log` or `.jsonl` files. Other inputs use ordinary text. Override the choice with `--chunking text`, `markdown`, `code`, or `lines` (`chat` is an alias for `lines`).

Markdown uses headings, paragraphs, and fenced blocks; ordinary text uses paragraphs and sentences; code uses blocks and lines; chat uses lines. Adjacent blocks are packed together when they fit. Oversized blocks are split further, with tokenizer boundaries as the final fallback. The code mode does not parse the programming language's syntax.

Overlap defaults to **zero**. Request a maximum repeated tail of the previous chunk with:

```bash
pnpm --filter localai_embeddings cli --file README.md --overlap-tokens 16
```

Overlap reserves space inside each chunk's token limit and can be smaller than requested near structural boundaries. Every chunk receives a normalized vector. The global vector is a normalized mean of the chunk vectors, weighted by content token count. The global vector is an approximation for document comparison; chunk vectors retain more local detail. Overlapped text contributes to more than one chunk and therefore also influences the mean more than once.

Rust callers use `EmbeddingEngine::embed_document` for long documents. The lower-level `EmbeddingEngine::embed` handles short texts and rejects inputs above the model limit instead of silently discarding the end.

## Model cache and updates

By default, model loading uses cached files immediately without checking Hugging Face for newer versions. Files missing from the cache are downloaded automatically. The cache also remembers when an optional file does not exist, so later runs do not repeat that lookup.

Use `--check-model-updates` to ask Hugging Face to check the current model files and download newer versions when available:

```bash
pnpm --filter localai_embeddings cli --check-model-updates --verbose --file README.md
```

Rust callers select the same behavior with `EmbeddingConfig::check_model_updates`, which defaults to `false`.

## Select a model and backend

Choose another supported Hugging Face model with `--model <model-id>`. This version supports BERT sentence embedding models with `model.safetensors` weights and mean pooling. A present Sentence Transformers pooling configuration must specify mean pooling only. If that optional file is absent, the tool uses mean pooling. Unsupported architectures produce an error.

The default backend is `cpu`. The CPU worker count is selected automatically by Candle; on Apple Silicon, Candle normally selects the performance core count. Set `--threads 10` to request ten CPU workers. More workers do not guarantee more throughput, especially when some cores are slower or other processes are active.

`--backend metal` requires a macOS build with the `metal` feature. `--backend cuda` requires the `cuda` feature and a compatible NVIDIA GPU. Run these commands from the repository root:

```bash
pnpm --filter localai_embeddings exec cargo run --release --features metal -- --backend metal --file README.md
pnpm --filter localai_embeddings exec cargo run --release --features cuda -- --backend cuda --file README.md
```

The native command reports that `wasm` requires a separate browser build. An unavailable backend produces an error rather than silently selecting another backend.

## Benchmark English text and Rust source

`--benchmark <rounds>` runs one warm-up round, then measures the selected number of rounds. Model loading and JSON output are excluded. Chunking, tokenization, chunk inference, and global-vector computation are included. The output reports documents, chunk embeddings, source bytes, chunk tokens, and padded model positions per second. Chunk token counts include special tokens and any overlap; padded positions include the work added by batching chunks of different lengths.

For a fixed model and similar chunk lengths, source throughput is useful for estimating large-document runtime: source bytes divided by measured bytes per second, plus model loading. This estimate is approximate: token density differs between English and code, and attention cost grows faster than linearly with the length of an individual chunk. A fixed chunk limit makes whole-document cost roughly proportional to the number of chunks. A small truncated prefix is never reported as processing an entire large file.

Run separate examples from the repository root:

```bash
# Basic English text.
pnpm --filter localai_embeddings cli --benchmark 5 --text "The cat sleeps on the chair."

# Normal English text.
pnpm --filter localai_embeddings cli --benchmark 5 --text "Local embedding models turn English sentences into numerical vectors. Related sentences should have similar vectors even when they use different words. This lets an application search documents by meaning, compare notes, or group related messages. The computation stays on this computer after the model files have been downloaded."

# Rust source, using a file already in the package.
pnpm --filter localai_embeddings cli --benchmark 3 --file src/lib.rs
```

CPU measurements on 17 October 2026, with 8 automatic workers and the commands above:

| Input | Chunks per round | Chunk embeddings/second | Chunk tokens/second | Source bytes/second |
| --- | ---: | ---: | ---: | ---: |
| Basic English, 28 bytes | 1 | 6.75 | 68 | 189 |
| Normal English, 330 bytes | 1 | 5.71 | 383 | 1,886 |
| Rust library, 17,295 bytes | 51 | 17.39 | 1,820 | 5,897 |

The Rust input uses batches of up to eight chunks. The short English examples each use a single chunk, so their rates include the overhead of repeatedly starting small inference operations.

For the CPU comparisons below, use the same three inputs:

```bash
benchmark_inputs=(
  --text "The cat sleeps on the chair."
  --text "Local embedding models turn English sentences into numerical vectors. Related sentences should have similar vectors even when they use different words. This lets an application search documents by meaning, compare notes, or group related messages. The computation stays on this computer after the model files have been downloaded."
  --file src/lib.rs
)
```

### CPU with automatic worker count

```bash
pnpm --filter localai_embeddings cli --backend cpu --benchmark 3 "${benchmark_inputs[@]}"
```

Measured on 17 October 2026: the automatic selection used 8 workers. The three inputs contained 17,653 bytes and produced 53 chunks (5,414 chunk tokens) per round. Three measured rounds took 9.76 seconds: **16.28 chunk embeddings/second**, **1,663 chunk tokens/second**, and **5,424 source bytes/second**.

### CPU with ten workers

```bash
pnpm --filter localai_embeddings cli --backend cpu --threads 10 --benchmark 3 "${benchmark_inputs[@]}"
```

With the same inputs and ten workers, three measured rounds took 10.43 seconds: **15.25 chunk embeddings/second**, **1,558 chunk tokens/second**, and **5,079 source bytes/second**. Ten workers were slightly slower on this workload.

These are measurements on the development machine, not performance guarantees. Both use an optimized build, one warm-up round, zero overlap, and the same 128-token model limit. Rerun the commands after changes to the source, model, or hardware.

For the same workload on the Apple GPU:

```bash
pnpm --filter localai_embeddings exec cargo run --release --features metal -- --backend metal --benchmark 3 "${benchmark_inputs[@]}"
```

The same workload on Metal took 3.99 seconds for three measured rounds: **39.87 chunk embeddings/second**, **4,073 chunk tokens/second**, and **13,281 source bytes/second**, approximately 2.45 times the automatic CPU throughput. The GPU measurement ran with access to the actual Metal device.
