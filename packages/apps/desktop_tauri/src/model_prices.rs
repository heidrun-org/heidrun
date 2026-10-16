//! Model prices: what one token of each model of Claude Code and of Codex costs, to turn the tokens of a chat into money.
//!
//! Neither coding agent writes the cost in money in its files. Heidrun multiplies the tokens of each kind by the public price
//! of the model. The prices come from the public price list of the project LiteLLM, a JSON file with one entry for each
//! model. Only the entries of the providers `anthropic` and `openai` are kept, with the four prices that matter: the input
//! token, the input token read from the cache, the input token written to the cache, and the output token.
//!
//! The table is kept on the disk, in `model_prices.json` in the folder of the data of Heidrun. The first call of `current`
//! reads that file. When the file is missing or older than one day, the call also starts a fetch of the price list in the
//! background, at most once an hour. When the fetch fails, the table that was kept stays: Heidrun never loses its prices.
//!
//! The cost is an estimate. It assumes that every request was paid by token at the public price. A developer on a fixed
//! subscription pays something else.

use data_layer_coding_agents::{TokenCounts, TokensByModel};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// The address of the public price list.
const PRICE_LIST_ADDRESS: &str =
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/// The name of the file of the table, in the folder of the data of Heidrun.
const PRICES_FILE: &str = "model_prices.json";

/// The providers of the price list whose models are kept: the ones of Claude Code and of Codex.
const PROVIDERS: [&str; 2] = ["anthropic", "openai"];

/// How old the table can be before the program fetches the price list again, in milliseconds: one day.
const MAX_AGE_MILLISECONDS: i64 = 24 * 3_600_000;

/// The shortest time between two fetches, in milliseconds: one hour. A fetch that failed is not tried again at once.
const RETRY_AFTER_MILLISECONDS: i64 = 3_600_000;

/// How long a fetch of the price list can last, in seconds.
const FETCH_TIMEOUT_SECONDS: u64 = 30;

/// The prices of one model, in US dollars for one token.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
pub struct ModelPrice {
    /// One input token that was neither read from the cache nor written to it.
    pub input: f64,
    /// One input token that was read from the cache.
    pub cached_input: f64,
    /// One input token that was written to the cache.
    pub cache_write_input: f64,
    /// One output token.
    pub output: f64,
}

/// The prices of the models, and the moment when they were fetched.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub struct PriceTable {
    /// When the price list was fetched, in milliseconds since 1970. Zero for a table that was never fetched.
    pub fetched_at: i64,
    /// The prices, by the name of the model.
    pub prices: BTreeMap<String, ModelPrice>,
}

impl ModelPrice {
    /// The cost of `tokens` at these prices, in US dollars.
    fn cost(&self, tokens: &TokenCounts) -> f64 {
        tokens.fresh_input as f64 * self.input
            + tokens.cached_input as f64 * self.cached_input
            + tokens.cache_write_input as f64 * self.cache_write_input
            + tokens.output as f64 * self.output
    }
}

impl PriceTable {
    /// Reads the price list of LiteLLM. Returns `None` when `text` is not a JSON object, or when it holds no model of the
    /// providers that are kept.
    pub fn parse(text: &str, fetched_at: i64) -> Option<PriceTable> {
        let list: Value = serde_json::from_str(text).ok()?;
        let mut prices = BTreeMap::new();
        for (model, entry) in list.as_object()? {
            let provider = entry.get("litellm_provider").and_then(Value::as_str).unwrap_or("");
            if !PROVIDERS.contains(&provider) {
                continue;
            }
            let (Some(input), Some(output)) = (price_field(entry, "input_cost_per_token"), price_field(entry, "output_cost_per_token"))
            else {
                continue;
            };
            let price = ModelPrice {
                input,
                cached_input: price_field(entry, "cache_read_input_token_cost").unwrap_or(input),
                cache_write_input: price_field(entry, "cache_creation_input_token_cost").unwrap_or(input),
                output,
            };
            prices.insert(model.clone(), price);
        }
        if prices.is_empty() {
            return None;
        }
        Some(PriceTable { fetched_at, prices })
    }

    /// The prices of `model`: the entry with this exact name, else the entry without the date that ends the name
    /// (`claude-haiku-4-5-20251001` finds `claude-haiku-4-5`). Returns `None` for a model that has no price.
    pub fn price_of(&self, model: &str) -> Option<&ModelPrice> {
        self.prices.get(model).or_else(|| self.prices.get(without_date(model)?))
    }

    /// The cost of the tokens of a chat, in US dollars. Returns `None` when the chat used no token, and when one model that
    /// the chat used has no price: a cost without the tokens of that model would be too small, so none is shown.
    pub fn cost(&self, tokens: &TokensByModel) -> Option<f64> {
        let mut total = 0.0;
        let mut has_tokens = false;
        for (model, counts) in tokens.iter().filter(|(_, counts)| !counts.is_empty()) {
            total += self.price_of(model)?.cost(counts);
            has_tokens = true;
        }
        has_tokens.then_some(total)
    }
}

/// The number of the field `name` of one entry of the price list, when it is a number that is not negative.
fn price_field(entry: &Value, name: &str) -> Option<f64> {
    entry.get(name).and_then(Value::as_f64).filter(|price| *price >= 0.0)
}

/// The name of a model without the date `-YYYYMMDD` that ends it, or `None` when the name does not end with a date.
fn without_date(model: &str) -> Option<&str> {
    let (name, date) = model.rsplit_once('-')?;
    (date.len() == 8 && date.bytes().all(|byte| byte.is_ascii_digit())).then_some(name)
}

// ---- The table of the application --------------------------------------------------------------------------------

/// The table of the application. It is read from the disk on the first call of `current`.
static TABLE: Mutex<Option<Arc<PriceTable>>> = Mutex::new(None);

/// True while a fetch of the price list runs.
static IS_FETCHING: AtomicBool = AtomicBool::new(false);

/// When the last fetch started, in milliseconds since 1970. Zero before the first fetch.
static LAST_FETCH_AT: AtomicI64 = AtomicI64::new(0);

/// The table that the application uses now. It is empty while Heidrun has no price: the tokens of a chat then show without a
/// cost. When the table is missing or older than one day, the call starts a fetch in the background: the next call gets the
/// new table.
pub fn current() -> Arc<PriceTable> {
    let table = {
        let mut guard = TABLE.lock().unwrap_or_else(|e| e.into_inner());
        guard.get_or_insert_with(|| Arc::new(read_file().unwrap_or_default())).clone()
    };
    let now = now_milliseconds();
    let is_old = now - table.fetched_at > MAX_AGE_MILLISECONDS;
    if is_old && now - LAST_FETCH_AT.load(Ordering::SeqCst) > RETRY_AFTER_MILLISECONDS {
        fetch_in_background();
    }
    table
}

/// The file of the table.
fn prices_path() -> PathBuf {
    crate::chats::data_dir().join(PRICES_FILE)
}

/// The table that the file holds, or `None` when the file is missing or not valid.
fn read_file() -> Option<PriceTable> {
    serde_json::from_str(&std::fs::read_to_string(prices_path()).ok()?).ok()
}

/// Writes the table to its file. The file is written aside then renamed: a crash never leaves half a file.
fn write_file(table: &PriceTable) {
    let path = prices_path();
    let Ok(text) = serde_json::to_string(table) else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let temporary = path.with_extension("json.tmp");
    if std::fs::write(&temporary, text).is_ok() {
        let _ = std::fs::rename(&temporary, &path);
    }
}

fn now_milliseconds() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// Starts a fetch of the price list, unless one runs. A fetch that fails changes nothing.
fn fetch_in_background() {
    if IS_FETCHING.swap(true, Ordering::SeqCst) {
        return;
    }
    LAST_FETCH_AT.store(now_milliseconds(), Ordering::SeqCst);
    tauri::async_runtime::spawn(async {
        if let Some(table) = fetch_table().await {
            write_file(&table);
            *TABLE.lock().unwrap_or_else(|e| e.into_inner()) = Some(Arc::new(table));
        }
        IS_FETCHING.store(false, Ordering::SeqCst);
    });
}

/// Fetches the price list, or `None` when the source does not answer or answers something that is not a price list.
async fn fetch_table() -> Option<PriceTable> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(FETCH_TIMEOUT_SECONDS))
        .user_agent("Heidrun")
        .build()
        .ok()?;
    let text = client.get(PRICE_LIST_ADDRESS).send().await.ok()?.error_for_status().ok()?.text().await.ok()?;
    PriceTable::parse(&text, now_milliseconds())
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIST: &str = r#"{
        "sample_spec": {"litellm_provider": "one of the providers", "input_cost_per_token": 0.0},
        "claude-opus-5": {"litellm_provider": "anthropic", "input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05,
            "cache_read_input_token_cost": 5e-07, "cache_creation_input_token_cost": 6.25e-06},
        "claude-haiku-4-5": {"litellm_provider": "anthropic", "input_cost_per_token": 1e-06, "output_cost_per_token": 5e-06},
        "gpt-6-sol": {"litellm_provider": "openai", "input_cost_per_token": 2e-06, "output_cost_per_token": 1e-05,
            "cache_read_input_token_cost": 2e-07},
        "bedrock-model": {"litellm_provider": "bedrock", "input_cost_per_token": 1e-06, "output_cost_per_token": 1e-06},
        "image-model": {"litellm_provider": "openai", "input_cost_per_image": 0.04},
        "negative-model": {"litellm_provider": "openai", "input_cost_per_token": -1.0, "output_cost_per_token": 1.0}
    }"#;

    fn table() -> PriceTable {
        PriceTable::parse(LIST, 7).unwrap()
    }

    fn tokens(model: &str, counts: TokenCounts) -> TokensByModel {
        BTreeMap::from([(model.to_string(), counts)])
    }

    #[test]
    fn keeps_the_models_of_claude_code_and_of_codex_that_have_an_input_price_and_an_output_price() {
        let table = table();
        assert_eq!(table.fetched_at, 7);
        assert_eq!(table.prices.keys().collect::<Vec<_>>(), vec!["claude-haiku-4-5", "claude-opus-5", "gpt-6-sol"]);
        assert_eq!(
            table.prices["claude-opus-5"],
            ModelPrice { input: 5e-06, cached_input: 5e-07, cache_write_input: 6.25e-06, output: 2.5e-05 }
        );
    }

    #[test]
    fn uses_the_input_price_for_a_cache_price_that_the_list_does_not_give() {
        let price = table().prices["claude-haiku-4-5"];
        assert_eq!((price.cached_input, price.cache_write_input), (1e-06, 1e-06));
        assert_eq!(table().prices["gpt-6-sol"].cache_write_input, 2e-06);
    }

    #[test]
    fn refuses_a_text_that_is_not_a_price_list() {
        assert_eq!(PriceTable::parse("not json", 0), None);
        assert_eq!(PriceTable::parse("[]", 0), None);
        assert_eq!(PriceTable::parse(r#"{"x": {"litellm_provider": "bedrock"}}"#, 0), None);
    }

    #[test]
    fn finds_a_model_with_or_without_the_date_at_the_end_of_its_name() {
        let table = table();
        assert!(table.price_of("claude-haiku-4-5").is_some());
        assert!(table.price_of("claude-haiku-4-5-20251001").is_some());
        assert!(table.price_of("claude-haiku-4-6-20251001").is_none());
        assert!(table.price_of("codex-auto-review").is_none());
        assert!(table.price_of("").is_none());
    }

    #[test]
    fn multiplies_the_tokens_of_each_kind_by_its_price() {
        let counts = TokenCounts { fresh_input: 1_000_000, cached_input: 2_000_000, cache_write_input: 100_000, output: 10_000 };
        let cost = table().cost(&tokens("claude-opus-5", counts)).unwrap();
        // 1 000 000 × 5e-06 + 2 000 000 × 5e-07 + 100 000 × 6.25e-06 + 10 000 × 2.5e-05
        assert!((cost - (5.0 + 1.0 + 0.625 + 0.25)).abs() < 1e-9, "{cost}");
    }

    #[test]
    fn adds_the_cost_of_each_model_of_a_chat() {
        let mut used = tokens("claude-opus-5", TokenCounts { output: 1_000_000, ..Default::default() });
        used.insert("gpt-6-sol".to_string(), TokenCounts { fresh_input: 1_000_000, ..Default::default() });
        assert!((table().cost(&used).unwrap() - 27.0).abs() < 1e-9);
    }

    #[test]
    fn gives_no_cost_when_a_model_has_no_price_or_when_no_token_was_used() {
        let table = table();
        let counts = TokenCounts { output: 5, ..Default::default() };
        let mut used = tokens("claude-opus-5", counts);
        used.insert("codex-auto-review".to_string(), counts);
        assert_eq!(table.cost(&used), None);
        assert_eq!(table.cost(&tokens("", counts)), None);
        assert_eq!(table.cost(&TokensByModel::new()), None);
        assert_eq!(table.cost(&tokens("claude-opus-5", TokenCounts::default())), None);
    }
}
