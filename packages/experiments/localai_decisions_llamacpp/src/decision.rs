//! The decision part of the server of llama.cpp v0.6.0 (`tools/server/server-decision.cpp`), written
//! again in Rust for the types `openjev`, `lev`, `kev`, `nimble`, and `clef`: the setup from the metadata
//! of the model, the reading of the questions, the prompt of each question, and the answer.
//!
//! Keep this file in the order of `server-decision.cpp`, so that a change of llama.cpp is easy to follow.

use std::collections::BTreeMap;

use anyhow::{anyhow, bail, Result};
use serde_json::{json, Map, Value};

use crate::llama::{Model, Token};
use crate::template::SystemOneTemplate;

/// lev reads noul from a rating scale: 0 = certainly no, 8 = certainly yes.
const LEV_N_RATINGS: usize = 9;

/// The kind of a decision model, from the metadata key `<architecture>.decision.type`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DecisionType {
    /// Logits of one label token per option, read at the last prompt token.
    OpenJev,
    /// Same as OpenJev, noul is read from a rating scale.
    Lev,
    /// Dot product of the hidden states of the last token and of one end token per option.
    Kev,
    /// Same as OpenJev, the prompt lists all the questions of the request.
    Nimble,
    /// All questions in one prompt, the score of option i is read from the embeddings output at row i.
    Clef,
}

impl DecisionType {
    /// Reads the name that the model file gives.
    pub fn from_name(name: &str) -> Result<Self> {
        match name {
            "openjev" => Ok(Self::OpenJev),
            "lev" => Ok(Self::Lev),
            "kev" => Ok(Self::Kev),
            "nimble" => Ok(Self::Nimble),
            "clef" => Ok(Self::Clef),
            "laya" => bail!("The decision type `laya` is a ModernBERT model, not a model based on Qwen3.5; this package does not support it"),
            other => bail!("The decision type `{other}` is not supported by this package; it supports openjev, lev, kev, nimble, and clef (llama.cpp v0.6.0)"),
        }
    }

    /// The name in the model file.
    pub fn name(self) -> &'static str {
        match self {
            Self::OpenJev => "openjev",
            Self::Lev => "lev",
            Self::Kev => "kev",
            Self::Nimble => "nimble",
            Self::Clef => "clef",
        }
    }

    /// True when the model reads the embeddings output instead of the logits.
    pub fn reads_embeddings(self) -> bool {
        matches!(self, Self::Kev | Self::Clef)
    }
}

/// The type of a question of the System One API.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum QuestionType {
    /// One option of a list.
    Choice,
    /// One level of an ordered list of 2 to 10 levels.
    Score,
    /// Yes or no.
    Noul,
}

impl QuestionType {
    /// The name in the API.
    pub fn name(self) -> &'static str {
        match self {
            Self::Choice => "choice",
            Self::Score => "score",
            Self::Noul => "noul",
        }
    }
}

/// One possible answer of a question.
#[derive(Clone, Debug)]
pub struct DecisionOption {
    /// The key of the option: the key of a choice, the level index of a score, or `true` and `false`.
    pub key: String,
    /// The description, `null` when the request gives none.
    pub description: Value,
}

/// One question of a request, with its options in the order of the model outputs.
#[derive(Clone, Debug)]
pub struct Question {
    /// The identifier of the question in the request.
    pub id: String,
    /// The type of the question.
    pub question_type: QuestionType,
    /// The question itself: a text, an object, or an array.
    pub instructions: Value,
    /// The options.
    pub options: Vec<DecisionOption>,
}

/// The values of a model that the prompts and the answers need.
pub struct DecisionSetup {
    /// The type of the model.
    pub decision_type: DecisionType,
    template: SystemOneTemplate,
    temperatures: BTreeMap<String, f32>,
    n_options_max: usize,
    noul_true_first: bool,
    choice_sorted: bool,
    labels: Vec<Token>,
    label_texts: Vec<String>,
    token_marker: Option<Token>,
}

/// One prompt to evaluate, and where to read its result.
#[derive(Clone, Debug, Default)]
pub struct PromptTask {
    /// The tokens of the prompt.
    pub tokens: Vec<Token>,
    /// OpenJev, lev, nimble: the label tokens whose logits are read at the last token.
    pub labels: Vec<Token>,
    /// Kev: the positions of the end token of each option.
    pub markers: Vec<usize>,
    /// Kev: the position of the hidden state of the question.
    pub pointer: Option<usize>,
    /// Clef: the decision order of each token, empty for the other types.
    pub order: Vec<i32>,
    /// Clef: the number of scores, one for each option of all questions.
    pub n_scores: usize,
}

impl DecisionSetup {
    /// Reads the `<architecture>.decision.*` metadata and the `systemone` template of a model.
    pub fn new(model: &Model) -> Result<Self> {
        let architecture = model.meta("general.architecture").unwrap_or_default();
        let prefix = format!("{architecture}.decision.");
        let type_name = model
            .meta(&format!("{prefix}type"))
            .ok_or_else(|| anyhow!("The model is not a decision model: it has no metadata key `{prefix}type`"))?;
        let decision_type = DecisionType::from_name(&type_name)?;

        // The template is read by its metadata key, as llama_model_chat_template(model, "systemone") does.
        let source = model
            .meta("tokenizer.chat_template.systemone")
            .ok_or_else(|| anyhow!("The decision model has no \"systemone\" template"))?;
        let template = SystemOneTemplate::new(&source)?;

        let prefix_temp = format!("{prefix}temperature.");
        let mut temperatures = BTreeMap::new();
        for (key, value) in model.meta_entries() {
            let Some(name) = key.strip_prefix(&prefix_temp) else {
                continue;
            };
            let temperature: f32 = value.trim().parse().unwrap_or(0.0);
            if temperature <= 0.0 {
                bail!("Invalid decision temperature: {key} = {value}");
            }
            temperatures.insert(name.to_string(), temperature);
        }

        let mut setup = Self {
            decision_type,
            template,
            temperatures,
            n_options_max: 0,
            noul_true_first: false,
            choice_sorted: false,
            labels: Vec::new(),
            label_texts: Vec::new(),
            token_marker: None,
        };

        match decision_type {
            DecisionType::OpenJev => {
                // One letter per option, each must be a single token.
                for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".chars() {
                    let tokens = model.tokenize(&c.to_string(), false, false);
                    if tokens.len() != 1 {
                        bail!("The decision label '{c}' is not a single token");
                    }
                    setup.labels.push(tokens[0]);
                }
                setup.n_options_max = setup.labels.len();
                setup.noul_true_first = true;
            }
            DecisionType::Lev | DecisionType::Nimble => {
                // Label codes are A..Z then AA..ZZ, only the ones that are a single token are used.
                let mut codes: Vec<String> = ('A'..='Z').map(String::from).collect();
                for a in 'A'..='Z' {
                    for b in 'A'..='Z' {
                        codes.push(format!("{a}{b}"));
                    }
                }
                for code in codes {
                    let tokens = model.tokenize(&code, false, false);
                    if tokens.len() == 1 && setup.labels.len() < 255 {
                        setup.labels.push(tokens[0]);
                        setup.label_texts.push(code);
                    }
                }
                setup.n_options_max = setup.labels.len();
            }
            DecisionType::Kev => {
                // The hidden state of an option is read at the token that ends it.
                let tokens = model.tokenize("<|box_end|>", false, true);
                if tokens.len() != 1 {
                    bail!("The decision model has no <|box_end|> token");
                }
                setup.token_marker = Some(tokens[0]);
                setup.n_options_max = 255;
            }
            DecisionType::Clef => {
                setup.n_options_max = 255;
                setup.noul_true_first = true;
                setup.choice_sorted = true;
            }
        }
        Ok(setup)
    }

    /// Reads the questions of a request, as `parse_questions` does.
    pub fn parse_questions(&self, body: &Value) -> Result<Vec<Question>> {
        if body.get("state").map_or(true, Value::is_null) {
            bail!("\"state\" must be provided");
        }
        let Some(questions_value) = body.get("questions").and_then(Value::as_object).filter(|q| q.is_empty() == false) else {
            bail!("\"questions\" must be a non-empty object");
        };
        if let Some(images) = body.get("images") {
            if images.is_null() == false && images.as_array().map_or(true, |a| a.is_empty() == false) {
                bail!("\"images\" is not supported: this package reads text only");
            }
        }

        let mut questions = Vec::new();
        for (id, q) in questions_value {
            let err = |message: &str| anyhow!("questions.{id}: {message}");
            let Some(q) = q.as_object() else {
                return Err(err("must be an object"));
            };
            let instructions = q.get("instructions").cloned().unwrap_or(Value::Null);
            if instructions.is_null() {
                return Err(err("\"instructions\" must be provided"));
            }
            let type_name = q.get("type").and_then(Value::as_str).unwrap_or_default();
            let criteria = q.get("criteria").cloned().unwrap_or(Value::Null);

            let mut options = Vec::new();
            let question_type = match type_name {
                "choice" => {
                    let Some(criteria) = criteria.as_object().filter(|c| c.is_empty() == false) else {
                        return Err(err("\"criteria\" must be a non-empty object"));
                    };
                    for (key, description) in criteria {
                        options.push(DecisionOption {
                            key: key.clone(),
                            description: description.clone(),
                        });
                    }
                    if self.choice_sorted {
                        options.sort_by(|a, b| a.key.cmp(&b.key));
                    }
                    QuestionType::Choice
                }
                "score" => {
                    let Some(levels) = criteria.as_array().filter(|c| c.len() >= 2 && c.len() <= 10) else {
                        return Err(err("\"criteria\" must be an array of 2 to 10 levels"));
                    };
                    for (i, description) in levels.iter().enumerate() {
                        options.push(DecisionOption {
                            key: i.to_string(),
                            description: description.clone(),
                        });
                    }
                    QuestionType::Score
                }
                "noul" => {
                    if criteria.is_null() == false && criteria.is_object() == false {
                        return Err(err("\"criteria\" must be an object"));
                    }
                    for key in ["false", "true"] {
                        options.push(DecisionOption {
                            key: key.to_string(),
                            description: criteria.get(key).cloned().unwrap_or(Value::Null),
                        });
                    }
                    if self.noul_true_first {
                        options.swap(0, 1);
                    }
                    QuestionType::Noul
                }
                _ => return Err(err("\"type\" must be one of: choice, score, noul")),
            };

            if options.len() > self.n_options_max {
                return Err(err(&format!(
                    "too many options ({}), this model supports at most {}",
                    options.len(),
                    self.n_options_max
                )));
            }
            questions.push(Question {
                id: id.clone(),
                question_type,
                instructions,
                options,
            });
        }
        Ok(questions)
    }

    /// The number of prompts of a question; lev shows the options of a choice in 2 orders, to cancel the
    /// preference for the first label.
    pub fn n_variants(&self, question: &Question) -> usize {
        if self.decision_type == DecisionType::Lev && question.question_type == QuestionType::Choice && question.options.len() > 1 {
            return 2;
        }
        1
    }

    fn n_outputs(&self, question: &Question) -> usize {
        if self.decision_type == DecisionType::Lev && question.question_type == QuestionType::Noul {
            return LEV_N_RATINGS;
        }
        question.options.len()
    }

    fn render_options(&self, question: &Question, variant: usize) -> Value {
        let n = question.options.len();
        // The second variant shows the options in the reverse order.
        let mut options = Vec::new();
        for i in 0..n {
            let option = &question.options[if variant == 0 { i } else { n - 1 - i }];
            let mut value = Map::new();
            value.insert("key".into(), Value::String(option.key.clone()));
            value.insert("description".into(), option.description.clone());
            if self.decision_type == DecisionType::Kev {
                value.insert("key".into(), Value::String(kev_text(&Value::String(option.key.clone()))));
                if option.description.is_null() == false {
                    value.insert("description".into(), Value::String(kev_text(&option.description)));
                }
            }
            if self.label_texts.is_empty() == false {
                value.insert("label".into(), Value::String(self.label_texts[i].clone()));
            }
            options.push(Value::Object(value));
        }
        Value::Array(options)
    }

    /// Renders the prompt of one variant of one question.
    pub fn render(&self, state: &Value, questions: &[Question], question: &Question, variant: usize) -> Result<String> {
        // The template is given raw JSON values, it serializes the ones that are not strings.
        let mut input = json!({
            "id": question.id,
            "type": question.question_type.name(),
            "instructions": question.instructions,
            "state": state,
            "options": self.render_options(question, variant),
        });

        // The nimble prompt lists all the questions of the request.
        if self.decision_type == DecisionType::Nimble {
            let list: Vec<Value> = questions
                .iter()
                .map(|q| {
                    json!({
                        "id": q.id,
                        "type": q.question_type.name(),
                        "instructions": q.instructions,
                        "options": self.render_options(q, 0),
                    })
                })
                .collect();
            input["questions"] = Value::Array(list);
        }

        // lev was trained with sorted keys.
        if self.decision_type == DecisionType::Lev {
            input = sort_keys(&input);
        }

        // The kev template only takes text.
        if self.decision_type == DecisionType::Kev {
            input["state"] = Value::String(kev_text(state));
            input["instructions"] = Value::String(kev_text(&question.instructions));
        }

        input["images"] = json!([]);
        self.template.render(&input)
    }

    /// Builds the prompt of one variant of one question, as `fill_task` does.
    pub fn fill_task(&self, model: &Model, state: &Value, questions: &[Question], question: &Question, variant: usize) -> Result<PromptTask> {
        let prompt = self.render(state, questions, question, variant)?;
        let mut task = PromptTask::default();

        if matches!(self.decision_type, DecisionType::OpenJev | DecisionType::Lev | DecisionType::Nimble) {
            // lev reads the ratings of a noul question at its first labels, not at the digits.
            task.labels = self.labels[..self.n_outputs(question)].to_vec();
        }

        task.tokens = model.tokenize(&prompt, false, true);
        if let Some(marker) = self.token_marker {
            // An option is read at its end token, the question at the last token.
            task.markers = task.tokens.iter().enumerate().filter(|(_, t)| **t == marker).map(|(i, _)| i).collect();
            if task.markers.len() != question.options.len() {
                bail!("Unexpected layout of the decision prompt");
            }
            task.pointer = Some(task.tokens.len() - 1);
        }
        Ok(task)
    }

    /// Builds the one prompt of all the questions (clef), as `fill_task_joint` does.
    pub fn fill_task_joint(&self, model: &Model, state: &Value, questions: &[Question]) -> Result<PromptTask> {
        let list: Vec<Value> = questions
            .iter()
            .map(|q| {
                let options: Vec<Value> = q
                    .options
                    .iter()
                    .map(|o| {
                        json!({
                            "key": o.key,
                            "description": o.description,
                        })
                    })
                    .collect();
                json!({
                    "id": q.id,
                    "type": q.question_type.name(),
                    "instructions": q.instructions,
                    "options": options,
                })
            })
            .collect();

        // The template is given raw JSON values with sorted keys, and no marker in the input.
        let input = json!({
            "state": state,
            "questions": list,
        });
        let mut input = replace_text(&sort_keys(&input), CLEF_MARKER, "<<clef ");
        input["images"] = json!([]);
        input["sep"] = Value::String(CLEF_SEP.into());
        input["mark_question"] = Value::String(CLEF_MARK_QUESTION.into());
        input["mark_option"] = Value::String(CLEF_MARK_OPTION.into());
        let prompt = self.template.render(&input)?;

        let mut task = PromptTask::default();
        let mut i_question = 0;
        // The model was trained with the pieces tokenized one by one.
        for piece in prompt.split(CLEF_SEP) {
            let mut piece = piece;
            let mut order = ORDER_NONE;
            if let Some(rest) = piece.strip_prefix(CLEF_MARK_QUESTION) {
                piece = rest;
                let Some(question) = questions.get(i_question) else {
                    bail!("Unexpected layout of the decision prompt");
                };
                i_question += 1;
                order = match question.question_type {
                    QuestionType::Noul => ORDER_QUESTION_NOUL,
                    QuestionType::Choice => ORDER_QUESTION_CHOICE,
                    QuestionType::Score => ORDER_QUESTION_SCORE,
                };
            } else if let Some(rest) = piece.strip_prefix(CLEF_MARK_OPTION) {
                piece = rest;
                order = ORDER_OPTION;
                task.n_scores += 1;
            }
            let piece_tokens = model.tokenize(piece, false, true);
            if order != ORDER_NONE && piece_tokens.is_empty() {
                bail!("The instructions and the options of a question must not be empty");
            }
            task.tokens.extend_from_slice(&piece_tokens);
            task.order.resize(task.tokens.len(), order);
        }

        let n_options: usize = questions.iter().map(|q| q.options.len()).sum();
        if i_question != questions.len() || task.n_scores != n_options {
            bail!("Unexpected layout of the decision prompt");
        }
        Ok(task)
    }

    fn temperature(&self, question: &Question) -> f32 {
        let n = question.options.len();
        let type_name = question.question_type.name();
        // The temperature can depend on the number of options, the buckets are the ones used to fit it.
        let bucket = if self.decision_type == DecisionType::Lev {
            if n <= 8 {
                "small"
            } else if n <= 26 {
                "mid"
            } else {
                "large"
            }
        } else if n <= 2 {
            "2"
        } else if n <= 5 {
            "3_5"
        } else if n <= 10 {
            "6_10"
        } else {
            "11"
        };
        for name in [format!("{type_name}.{bucket}"), type_name.to_string()] {
            if let Some(temperature) = self.temperatures.get(&name) {
                return *temperature;
            }
        }
        1.0
    }

    /// Turns the raw outputs of each variant into the answer of the API, as `format_answer` does.
    pub fn format_answer(&self, question: &Question, scores: &[Vec<f32>]) -> Result<Value> {
        let n = self.n_outputs(question);
        if scores.len() != self.n_variants(question) {
            bail!("The decision result does not match the number of variants");
        }

        // Softmax over the outputs of each variant, then the average of the variants.
        let temperature = self.temperature(question) as f64;
        let mut probs = vec![0.0f64; n];
        for (v, s) in scores.iter().enumerate() {
            if s.len() != n {
                bail!("The decision result does not match the number of options");
            }
            // A joint head returns NaN if it could not use the decision order.
            if s.iter().any(|x| x.is_nan()) {
                bail!("The model could not evaluate the decision");
            }
            let score_max = s.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
            let p: Vec<f64> = s.iter().map(|x| (((x - score_max) as f64) / temperature).exp()).collect();
            let sum: f64 = p.iter().sum();
            for i in 0..n {
                // The second variant is in the reverse order.
                probs[if v == 0 { i } else { n - 1 - i }] += p[i] / sum / scores.len() as f64;
            }
        }

        let mut answer = Map::new();
        answer.insert("type".into(), json!(question.question_type.name()));

        if question.question_type == QuestionType::Noul {
            if self.decision_type == DecisionType::Lev {
                let expected: f64 = (0..n).map(|i| probs[i] * i as f64 / (n - 1) as f64).sum();
                answer.insert("noul".into(), json!(expected));
                return Ok(Value::Object(answer));
            }
            for (i, option) in question.options.iter().enumerate() {
                if option.key == "true" {
                    answer.insert("noul".into(), json!(probs[i]));
                }
            }
            return Ok(Value::Object(answer));
        }

        let mut probabilities = Map::new();
        for (i, option) in question.options.iter().enumerate() {
            probabilities.insert(option.key.clone(), json!(probs[i]));
        }

        if question.question_type == QuestionType::Choice {
            let best = index_of_max(&probs);
            answer.insert("choice".into(), json!(question.options[best].key));
            answer.insert("probabilities".into(), Value::Object(probabilities));
            answer.insert("confidence".into(), json!(confidence_choice(&probs)));
        } else {
            let expected: f64 = (0..n).map(|i| i as f64 * probs[i]).sum();
            let mut legend = Map::new();
            for option in &question.options {
                legend.insert(option.key.clone(), option.description.clone());
            }
            answer.insert("score".into(), json!(expected));
            answer.insert("legend".into(), Value::Object(legend));
            answer.insert("probabilities".into(), Value::Object(probabilities));
            answer.insert("confidence".into(), json!(confidence_score(&probs)));
        }
        Ok(Value::Object(answer))
    }
}

// The decision order of a token, the values of `enum llama_decision_order` of src/llama-ext.h.
const ORDER_NONE: i32 = 0;
const ORDER_QUESTION_NOUL: i32 = 1;
const ORDER_QUESTION_CHOICE: i32 = 2;
const ORDER_QUESTION_SCORE: i32 = 3;
const ORDER_OPTION: i32 = 4;

// Given to the clef template: text between the pieces of the prompt, and at the start of the span of a
// question or of an option.
const CLEF_MARKER: &str = "<<clef:";
const CLEF_SEP: &str = "<<clef:sep>>";
const CLEF_MARK_QUESTION: &str = "<<clef:question>>";
const CLEF_MARK_OPTION: &str = "<<clef:option>>";

/// Replaces a text in all strings of a JSON value.
pub fn replace_text(value: &Value, search: &str, replace: &str) -> Value {
    match value {
        Value::String(text) => Value::String(text.replace(search, replace)),
        Value::Array(items) => Value::Array(items.iter().map(|item| replace_text(item, search, replace)).collect()),
        Value::Object(map) => Value::Object(map.iter().map(|(k, v)| (k.clone(), replace_text(v, search, replace))).collect()),
        other => other.clone(),
    }
}

/// Sorts the keys of all objects of a JSON value, by bytes, as `std::map<std::string, json>` does.
pub fn sort_keys(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(sort_keys).collect()),
        Value::Object(map) => {
            let sorted: BTreeMap<&String, Value> = map.iter().map(|(k, v)| (k, sort_keys(v))).collect();
            Value::Object(sorted.into_iter().map(|(k, v)| (k.clone(), v)).collect())
        }
        other => other.clone(),
    }
}

/// Kev flattens a JSON value into text, the keys of an object are kept as labels (kev/api.py: render).
pub fn kev_render(value: &Value, indent: usize) -> String {
    let pad = " ".repeat(2 * indent);
    match value {
        Value::Null => String::new(),
        Value::String(text) => text.clone(),
        Value::Bool(b) => if *b { "True" } else { "False" }.to_string(),
        Value::Array(items) => {
            let mut out = String::new();
            for item in items {
                let text = kev_render(item, indent + 1);
                if out.is_empty() == false {
                    out.push('\n');
                }
                out.push_str(&pad);
                out.push_str("- ");
                out.push_str(text.trim_start_matches([' ', '\t', '\n', '\r']));
            }
            out
        }
        Value::Object(map) => {
            let mut out = String::new();
            for (key, item) in map {
                let is_nested = item.is_object() || item.is_array();
                if out.is_empty() == false {
                    out.push('\n');
                }
                out.push_str(&pad);
                out.push_str(key);
                out.push_str(if is_nested { ":\n" } else { ": " });
                out.push_str(&kev_render(item, if is_nested { indent + 1 } else { 0 }));
            }
            out
        }
        Value::Number(number) => number.to_string(),
    }
}

/// Special tokens written in a text must not be parsed as such: `<|name|>` becomes `<¦name¦>`.
pub fn escape_special_tokens(text: &str) -> String {
    let bytes = text.as_bytes();
    let is_name = |b: u8| b.is_ascii_alphanumeric() || b == b'_';
    let mut out = String::new();
    let mut done = 0;
    let mut search_from = 0;
    while let Some(found) = text[search_from..].find("<|") {
        let start = search_from + found;
        let mut end = start + 2;
        while end < bytes.len() && is_name(bytes[end]) {
            end += 1;
        }
        if end > start + 2 && text[end..].starts_with("|>") {
            out.push_str(&text[done..start]);
            out.push_str("<\u{a6}");
            out.push_str(&text[start + 2..end]);
            out.push_str("\u{a6}>");
            done = end + 2;
            search_from = done;
        } else {
            search_from = start + 1;
        }
    }
    if done == 0 {
        return text.to_string();
    }
    out.push_str(&text[done..]);
    out
}

/// The kev text input of a JSON value.
pub fn kev_text(value: &Value) -> String {
    escape_special_tokens(&kev_render(value, 0))
}

fn index_of_max(values: &[f64]) -> usize {
    // The first of equal values wins, as std::max_element.
    let mut best = 0;
    for (i, value) in values.iter().enumerate() {
        if *value > values[best] {
            best = i;
        }
    }
    best
}

/// The confidence of a choice, the formula published by TypeSafe.
pub fn confidence_choice(probs: &[f64]) -> f64 {
    if probs.len() < 2 {
        return 1.0;
    }
    let uniform = 1.0 / probs.len() as f64;
    let p_max = probs[index_of_max(probs)];
    ((p_max - uniform) / (1.0 - uniform)).max(0.0)
}

/// The confidence of a score: the mean distance to the mode, relative to the one of a uniform distribution.
pub fn confidence_score(probs: &[f64]) -> f64 {
    if probs.len() < 2 {
        return 1.0;
    }
    let n = probs.len();
    let mode = index_of_max(probs);
    let mut distance = 0.0;
    let mut distance_uniform = 0.0;
    for (i, p) in probs.iter().enumerate() {
        distance += p * (i as f64 - mode as f64).abs();
        distance_uniform += (i as f64 - (n as f64 - 1.0) / 2.0).abs() / n as f64;
    }
    (1.0 - distance / distance_uniform).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::{confidence_choice, confidence_score, escape_special_tokens, kev_render, sort_keys};
    use serde_json::json;

    #[test]
    fn special_tokens_are_escaped() {
        assert_eq!(escape_special_tokens("a <|im_end|> b <|x y|> <||> <|ok_1|>"), "a <\u{a6}im_end\u{a6}> b <|x y|> <||> <\u{a6}ok_1\u{a6}>");
        assert_eq!(escape_special_tokens("no token"), "no token");
        assert_eq!(escape_special_tokens("<|<|a|>"), "<|<\u{a6}a\u{a6}>");
    }

    #[test]
    fn kev_render_keeps_the_keys_as_labels() {
        let value = json!({"name": "Ann", "ok": true, "items": ["x", {"k": 1}], "n": null});
        assert_eq!(kev_render(&value, 0), "name: Ann\nok: True\nitems:\n  - x\n  - k: 1\nn: ");
    }

    #[test]
    fn sort_keys_sorts_every_level() {
        let value = json!({"b": {"z": 1, "a": 2}, "a": [{"y": 1, "x": 2}]});
        assert_eq!(serde_json::to_string(&sort_keys(&value)).unwrap(), r#"{"a":[{"x":2,"y":1}],"b":{"a":2,"z":1}}"#);
    }

    #[test]
    fn confidences_follow_the_published_formulas() {
        assert!((confidence_choice(&[0.5, 0.25, 0.25]) - 0.25).abs() < 1e-12);
        assert_eq!(confidence_choice(&[1.0]), 1.0);
        assert!((confidence_score(&[0.0, 1.0, 0.0]) - 1.0).abs() < 1e-12);
        assert_eq!(confidence_score(&[0.25, 0.25, 0.25, 0.25]), 0.0);
    }
}
