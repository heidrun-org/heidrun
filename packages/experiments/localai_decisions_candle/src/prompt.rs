//! Builds the sequence of token identifiers that the model reads for a text and a list of decision tasks.
//!
//! The layout is the one of the Python package gliner2: for each task the tokens `( [P] name ( [L] label ... ) )`,
//! the tasks separated by `[SEP_STRUCT]`, then `[SEP_TEXT]`, then the lower-case words of the text. The model reads
//! the output at each `[L]` marker to score the label that follows the marker.

use crate::task::DecisionTask;
use crate::words::split_words;
use anyhow::{Context, Result};
use tokenizers::Tokenizer;

const OPEN: &str = "(";
const CLOSE: &str = ")";
const TASK_MARKER: &str = "[P]";
const LABEL_MARKER: &str = "[L]";
const DESCRIPTION_MARKER: &str = "[DESCRIPTION]";
const TASK_SEPARATOR: &str = "[SEP_STRUCT]";
const TEXT_SEPARATOR: &str = "[SEP_TEXT]";

/// The input of the model for one text and its tasks.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EncodedPrompt {
    /// The token identifiers, in reading order.
    pub input_ids: Vec<u32>,
    /// For each task, the position of the `[L]` marker of each label, in the order of the labels.
    pub label_positions: Vec<Vec<usize>>,
}

/// Builds the input of the model.
///
/// `tokenizer` must know the ten special tokens of GLiNER2, as the tokenizer file of the model does.
pub fn build_prompt(
    tokenizer: &Tokenizer,
    text: &str,
    tasks: &[DecisionTask],
) -> Result<EncodedPrompt> {
    let mut input_ids: Vec<u32> = Vec::new();
    let mut label_positions: Vec<Vec<usize>> = Vec::with_capacity(tasks.len());

    for (task_index, task) in tasks.iter().enumerate() {
        if task_index > 0 {
            input_ids.extend(encode_piece(tokenizer, TASK_SEPARATOR)?);
        }
        input_ids.extend(encode_piece(tokenizer, OPEN)?);
        input_ids.extend(encode_piece(tokenizer, TASK_MARKER)?);
        input_ids.extend(encode_piece(tokenizer, &task_header(task))?);
        input_ids.extend(encode_piece(tokenizer, OPEN)?);

        let mut positions = Vec::with_capacity(task.labels.len());
        for label in &task.labels {
            positions.push(input_ids.len());
            input_ids.extend(encode_piece(tokenizer, LABEL_MARKER)?);
            input_ids.extend(encode_piece(tokenizer, &label.name)?);
        }
        label_positions.push(positions);

        input_ids.extend(encode_piece(tokenizer, CLOSE)?);
        input_ids.extend(encode_piece(tokenizer, CLOSE)?);
    }

    input_ids.extend(encode_piece(tokenizer, TEXT_SEPARATOR)?);
    for word in split_words(&end_with_sentence_punctuation(text)) {
        input_ids.extend(encode_piece(tokenizer, &word)?);
    }

    Ok(EncodedPrompt {
        input_ids,
        label_positions,
    })
}

/// Returns the text of the task that the model reads after `[P]`: the name, the prompt, and the label descriptions.
fn task_header(task: &DecisionTask) -> String {
    let mut header = task.name.clone();
    if let Some(prompt) = task.prompt.as_deref().filter(|prompt| !prompt.is_empty()) {
        header = format!("{}: {prompt}", task.name);
    }
    for label in &task.labels {
        if let Some(description) = &label.description {
            header.push_str(&format!(
                " {DESCRIPTION_MARKER} {}: {description}",
                label.name
            ));
        }
    }
    header
}

/// The model always reads a text that ends with `.`, `!`, or `?`.
fn end_with_sentence_punctuation(text: &str) -> String {
    if text.is_empty() {
        return ".".to_string();
    }
    if text.ends_with(['.', '!', '?']) {
        return text.to_string();
    }
    format!("{text}.")
}

fn encode_piece(tokenizer: &Tokenizer, piece: &str) -> Result<Vec<u32>> {
    let encoding = tokenizer
        .encode(piece, false)
        .map_err(anyhow::Error::msg)
        .with_context(|| format!("Could not tokenize `{piece}`"))?;
    Ok(encoding.get_ids().to_vec())
}

#[cfg(test)]
mod tests {
    use super::{end_with_sentence_punctuation, task_header};
    use crate::task::DecisionTask;

    #[test]
    fn adds_a_full_stop_only_when_the_text_has_no_sentence_punctuation() {
        assert_eq!(end_with_sentence_punctuation(""), ".");
        assert_eq!(end_with_sentence_punctuation("Hello"), "Hello.");
        assert_eq!(end_with_sentence_punctuation("Hello!"), "Hello!");
        assert_eq!(end_with_sentence_punctuation("Hello?"), "Hello?");
        assert_eq!(end_with_sentence_punctuation("Hello. "), "Hello. .");
    }

    #[test]
    fn writes_the_prompt_and_the_label_descriptions_after_the_name() {
        let task = DecisionTask::new("intent", ["card_lost", "balance"])
            .with_prompt("What does the customer want?")
            .with_description("balance", "The customer wants the balance");
        assert_eq!(
            task_header(&task),
            "intent: What does the customer want? [DESCRIPTION] balance: The customer wants the balance"
        );
        assert_eq!(task_header(&DecisionTask::new("intent", ["a"])), "intent");
    }
}
