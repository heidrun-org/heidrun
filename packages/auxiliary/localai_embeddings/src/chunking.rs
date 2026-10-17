//! Structure-aware, token-limited document chunking.

use anyhow::{bail, Context, Result};
use clap::ValueEnum;
use serde::Serialize;
use std::ops::Range;
use tokenizers::Tokenizer;

/// The document structure used to choose chunk boundaries.
#[derive(Clone, Copy, Debug, Eq, PartialEq, ValueEnum)]
pub enum ChunkingMode {
    /// Choose paragraphs unless a file extension selects another mode.
    Auto,
    /// Treat blank-line-separated blocks as paragraphs.
    Text,
    /// Keep Markdown headings with their following content and preserve fenced blocks.
    Markdown,
    /// Keep lines together and pack adjacent lines up to the token limit.
    #[value(alias = "chat")]
    Lines,
    /// Keep blank-line-separated code blocks together, then split at lines if needed.
    Code,
}

/// One source span that fits the selected model's token limit.
#[derive(Clone, Debug, Serialize)]
pub struct TextChunk {
    /// The chunk's zero-based position in its document.
    pub index: usize,
    /// The inclusive byte offset where this chunk starts in the source document.
    pub start_byte: usize,
    /// The exclusive byte offset where this chunk ends in the source document.
    pub end_byte: usize,
    /// The number of tokenizer tokens, including model special tokens.
    pub token_count: usize,
    /// The source text in this chunk.
    pub text: String,
}

/// Splits a document at structural boundaries and never exceeds `max_tokens`.
pub fn chunk_document(
    text: &str,
    tokenizer: &Tokenizer,
    max_tokens: usize,
    mode: ChunkingMode,
) -> Result<Vec<TextChunk>> {
    chunk_document_with_overlap(text, tokenizer, max_tokens, mode, 0)
}

/// Splits a document into structure-aware chunks with an optional token overlap.
///
/// The overlap repeats the end of the previous chunk at the beginning of each
/// following chunk. A value of zero produces non-overlapping chunks.
pub fn chunk_document_with_overlap(
    text: &str,
    tokenizer: &Tokenizer,
    max_tokens: usize,
    mode: ChunkingMode,
    overlap_tokens: usize,
) -> Result<Vec<TextChunk>> {
    if text.trim().is_empty() {
        bail!("Input text cannot be empty")
    }
    if max_tokens < 3 {
        bail!("The model token limit must leave room for text and special tokens")
    }
    if overlap_tokens >= max_tokens - 2 {
        bail!("Overlap must be smaller than the model's content token limit")
    }
    let chunk_limit = max_tokens - overlap_tokens;

    let tokenizer = tokenizer_without_limits(tokenizer)?;
    let mut units = structural_units(text, mode);
    if units.is_empty() {
        units.push(0..text.len());
    }

    let mut pieces = Vec::new();
    for unit in units {
        split_unit(text, unit, &tokenizer, chunk_limit, mode, &mut pieces)?;
    }

    let mut ranges = Vec::new();
    let mut current: Option<Range<usize>> = None;
    for piece in pieces {
        let Some(existing) = current.as_ref() else {
            current = Some(piece);
            continue;
        };
        let candidate = existing.start..piece.end;
        if token_count(&tokenizer, &text[candidate.clone()])? <= chunk_limit {
            current = Some(candidate);
        } else {
            ranges.push(current.take().expect("current chunk exists"));
            current = Some(piece);
        }
    }
    if let Some(current) = current {
        ranges.push(current);
    }

    let mut chunks = Vec::with_capacity(ranges.len());
    for (index, range) in ranges.iter().cloned().enumerate() {
        let chunk_start = if index == 0 || overlap_tokens == 0 {
            range.start
        } else {
            overlap_start(
                text,
                ranges[index - 1].clone(),
                range.start,
                range.end,
                &tokenizer,
                overlap_tokens,
                max_tokens,
            )?
        };
        let output_range = chunk_start..range.end;
        let chunk_text = &text[output_range.clone()];
        chunks.push(TextChunk {
            index,
            start_byte: output_range.start,
            end_byte: output_range.end,
            token_count: token_count(&tokenizer, chunk_text)?,
            text: chunk_text.to_string(),
        });
    }
    Ok(chunks)
}

fn overlap_start(
    text: &str,
    previous_range: Range<usize>,
    current_start: usize,
    current_end: usize,
    tokenizer: &Tokenizer,
    overlap_tokens: usize,
    max_tokens: usize,
) -> Result<usize> {
    let previous_text = &text[previous_range.clone()];
    let encoding = tokenizer
        .encode(previous_text, false)
        .map_err(anyhow::Error::msg)
        .context("Could not tokenize the previous chunk to apply overlap")?;
    let offsets = encoding.get_offsets();
    let available = offsets.len().min(overlap_tokens);

    for count in (1..=available).rev() {
        let start = previous_range.start + offsets[offsets.len() - count].0;
        if token_count(tokenizer, &text[start..current_end])? <= max_tokens {
            return Ok(start);
        }
    }
    Ok(current_start)
}

fn tokenizer_without_limits(tokenizer: &Tokenizer) -> Result<Tokenizer> {
    let mut tokenizer = tokenizer.clone();
    tokenizer
        .with_truncation(None)
        .map_err(anyhow::Error::msg)
        .context("Could not disable tokenizer truncation while splitting a document")?;
    tokenizer.with_padding(None);
    Ok(tokenizer)
}

fn token_count(tokenizer: &Tokenizer, text: &str) -> Result<usize> {
    tokenizer
        .encode(text, true)
        .map(|encoding| encoding.get_ids().len())
        .map_err(anyhow::Error::msg)
        .context("Could not count tokens while splitting the document")
}

fn structural_units(text: &str, mode: ChunkingMode) -> Vec<Range<usize>> {
    match mode {
        ChunkingMode::Auto => blank_line_ranges(text),
        ChunkingMode::Lines => line_ranges(text),
        ChunkingMode::Text => blank_line_ranges(text),
        ChunkingMode::Code => blank_line_ranges(text),
        ChunkingMode::Markdown => markdown_ranges(text),
    }
}

fn line_ranges(text: &str) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let mut start = 0;
    for line in text.split_inclusive('\n') {
        let end = start + line.len();
        if !line.trim().is_empty() {
            ranges.push(start..end);
        }
        start = end;
    }
    ranges
}

fn blank_line_ranges(text: &str) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let mut block_start = None;
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        let end = offset + line.len();
        if line.trim().is_empty() {
            if let Some(start) = block_start.take() {
                ranges.push(start..offset);
            }
        } else if block_start.is_none() {
            block_start = Some(offset);
        }
        offset = end;
    }
    if let Some(start) = block_start {
        ranges.push(start..text.len());
    }
    ranges
}

fn markdown_ranges(text: &str) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let mut block_start = None;
    let mut offset = 0;
    let mut in_fence = false;

    for line in text.split_inclusive('\n') {
        let end = offset + line.len();
        let trimmed = line.trim_start();
        let is_fence = trimmed.starts_with("```") || trimmed.starts_with("~~~");
        let is_heading = !in_fence && is_markdown_heading(trimmed);
        let is_blank = !in_fence && line.trim().is_empty();

        if is_heading {
            if let Some(start) = block_start.take() {
                ranges.push(start..offset);
            }
            block_start = Some(offset);
        } else if is_blank {
            if let Some(start) = block_start {
                let block = &text[start..offset];
                if !block
                    .lines()
                    .all(|part| is_markdown_heading(part.trim_start()))
                {
                    ranges.push(start..offset);
                    block_start = None;
                }
            }
        } else if block_start.is_none() {
            block_start = Some(offset);
        }

        if is_fence {
            in_fence = !in_fence;
            if !in_fence {
                if let Some(start) = block_start.take() {
                    ranges.push(start..end);
                }
            }
        }
        offset = end;
    }

    if let Some(start) = block_start {
        ranges.push(start..text.len());
    }
    ranges
}

fn is_markdown_heading(line: &str) -> bool {
    let marks = line
        .chars()
        .take_while(|character| *character == '#')
        .count();
    (1..=6).contains(&marks) && line.chars().nth(marks).is_some_and(char::is_whitespace)
}

fn split_unit(
    text: &str,
    range: Range<usize>,
    tokenizer: &Tokenizer,
    max_tokens: usize,
    mode: ChunkingMode,
    output: &mut Vec<Range<usize>>,
) -> Result<()> {
    let candidate = &text[range.clone()];
    if token_count(tokenizer, candidate)? <= max_tokens {
        output.push(range);
        return Ok(());
    }

    let finer_units = match mode {
        ChunkingMode::Auto => sentence_ranges(candidate, range.start),
        ChunkingMode::Text => sentence_ranges(candidate, range.start),
        ChunkingMode::Markdown | ChunkingMode::Lines | ChunkingMode::Code => line_ranges(candidate)
            .into_iter()
            .map(|line| (line.start + range.start)..(line.end + range.start))
            .collect(),
    };
    if finer_units.len() > 1 {
        for unit in finer_units {
            split_unit(text, unit, tokenizer, max_tokens, mode, output)?;
        }
        return Ok(());
    }

    split_at_tokens(text, range, tokenizer, max_tokens, output)
}

fn sentence_ranges(text: &str, base: usize) -> Vec<Range<usize>> {
    let mut ranges = Vec::new();
    let mut start = 0;
    for (offset, character) in text.char_indices() {
        if matches!(character, '.' | '!' | '?' | '\n') {
            let end = offset + character.len_utf8();
            if !text[start..end].trim().is_empty() {
                ranges.push((base + start)..(base + end));
            }
            start = end;
        }
    }
    if !text[start..].trim().is_empty() {
        ranges.push((base + start)..(base + text.len()));
    }
    ranges
}

fn split_at_tokens(
    text: &str,
    range: Range<usize>,
    tokenizer: &Tokenizer,
    max_tokens: usize,
    output: &mut Vec<Range<usize>>,
) -> Result<()> {
    let segment = &text[range.clone()];
    let encoding = tokenizer
        .encode(segment, false)
        .map_err(anyhow::Error::msg)
        .context("Could not split an oversized document block")?;
    let offsets = encoding.get_offsets();
    let content_limit = max_tokens.saturating_sub(2);
    if offsets.is_empty() || content_limit == 0 {
        bail!("Could not split a document block within the model token limit")
    }

    let mut token_start = 0;
    while token_start < offsets.len() {
        let token_end = (token_start + content_limit).min(offsets.len());
        let start = range.start + offsets[token_start].0;
        let end = range.start + offsets[token_end - 1].1;
        if start >= end {
            bail!("The tokenizer returned an empty span while splitting a document")
        }
        let span = start..end;
        if token_count(tokenizer, &text[span.clone()])? > max_tokens {
            bail!("Could not split a document block within the model token limit")
        }
        output.push(span);
        token_start = token_end;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokenizers::models::wordlevel::WordLevel;
    use tokenizers::pre_tokenizers::whitespace::Whitespace;
    use tokenizers::processors::template::TemplateProcessing;

    fn tokenizer() -> Tokenizer {
        let vocab = [
            ("[UNK]".to_string(), 0),
            ("[CLS]".to_string(), 1),
            ("[SEP]".to_string(), 2),
        ]
        .into_iter()
        .collect();
        let model = WordLevel::builder()
            .vocab(vocab)
            .unk_token("[UNK]".to_string())
            .build()
            .unwrap();
        let mut tokenizer = Tokenizer::new(model);
        tokenizer.with_pre_tokenizer(Some(Whitespace));
        tokenizer.with_post_processor(Some(
            TemplateProcessing::builder()
                .try_single("[CLS] $A [SEP]")
                .unwrap()
                .special_tokens(vec![("[CLS]", 1), ("[SEP]", 2)])
                .build()
                .unwrap(),
        ));
        tokenizer
    }

    #[test]
    fn long_unicode_documents_keep_the_end_and_valid_source_offsets() {
        let text = format!("{} final_sentinel", "été café 東京 ".repeat(100));
        let chunks = chunk_document(&text, &tokenizer(), 16, ChunkingMode::Text).unwrap();
        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.token_count <= 16);
            assert_eq!(chunk.text, text[chunk.start_byte..chunk.end_byte]);
        }
        assert!(chunks.last().unwrap().text.contains("final_sentinel"));
        assert!(chunks
            .windows(2)
            .all(|pair| pair[0].end_byte <= pair[1].start_byte));
    }

    #[test]
    fn overlap_repeats_content_without_exceeding_the_limit() {
        let text = "hello ".repeat(100);
        let chunks =
            chunk_document_with_overlap(&text, &tokenizer(), 16, ChunkingMode::Text, 4).unwrap();
        assert!(chunks.iter().all(|chunk| chunk.token_count <= 16));
        assert!(chunks
            .windows(2)
            .all(|pair| pair[1].start_byte < pair[0].end_byte));
        assert!(
            chunk_document_with_overlap(&text, &tokenizer(), 16, ChunkingMode::Text, 14).is_err()
        );
    }

    #[test]
    fn markdown_keeps_headings_with_following_paragraphs() {
        let text = "# First\n\nhello world\n\n# Second\n\nother words\n";
        let chunks = chunk_document(text, &tokenizer(), 7, ChunkingMode::Markdown).unwrap();
        assert_eq!(chunks.len(), 2);
        assert!(chunks[0].text.contains("# First\n\nhello world"));
        assert!(chunks[1].text.contains("# Second\n\nother words"));
    }

    #[test]
    fn lines_remain_whole_when_they_fit() {
        let text = "one two\nthree four\nfive six\n";
        let chunks = chunk_document(text, &tokenizer(), 6, ChunkingMode::Lines).unwrap();
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].text, "one two\nthree four\n");
        assert_eq!(chunks[1].text, "five six\n");
    }
}
