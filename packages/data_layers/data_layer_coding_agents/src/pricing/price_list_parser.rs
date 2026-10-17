//! Reads the public price list of the project LiteLLM: a JSON file with one entry for each model.
//!
//! Only the entries of the providers `anthropic` and `openai` are kept, with the four prices that matter: the input token, the
//! input token read from the cache, the input token written to the cache, and the output token. The list gives US dollars for
//! one token. The package keeps US dollars for one million tokens, so a price is easy to read and to compare.

use crate::model::price_types::{ListedModelPrice, ModelPrice, PRICE_TOKEN_COUNT};
use serde_json::Value;

/// The address of the public price list.
pub const PRICE_LIST_ADDRESS: &str =
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/// The providers of the price list whose models are kept: the ones of Claude Code and of Codex.
const PROVIDERS: [&str; 2] = ["anthropic", "openai"];

/// The number of decimal digits that a price in US dollars for one million tokens keeps. It removes the error of the product
/// of a price for one token by one million.
const PRICE_DECIMAL_COUNT: f64 = 1_000_000_000.0;

/// Reads the price list. Returns the models that have an input price and an output price, sorted by name. A model without a
/// price for the input tokens read from the cache, or written to it, uses its input price for them. Returns `None` when
/// `text` is not a JSON object, or when it holds no model of the providers that are kept.
pub fn parse_price_list(text: &str) -> Option<Vec<ListedModelPrice>> {
    let list: Value = serde_json::from_str(text).ok()?;
    let mut prices = Vec::new();
    for (model, entry) in list.as_object()? {
        let provider = entry.get("litellm_provider").and_then(Value::as_str).unwrap_or("");
        if !PROVIDERS.contains(&provider) {
            continue;
        }
        let (Some(input), Some(output)) = (price_field(entry, "input_cost_per_token"), price_field(entry, "output_cost_per_token"))
        else {
            continue;
        };
        prices.push(ListedModelPrice {
            provider: provider.to_string(),
            model: model.clone(),
            price: ModelPrice {
                fresh_input: per_million(input),
                cached_input: per_million(price_field(entry, "cache_read_input_token_cost").unwrap_or(input)),
                cache_write_input: per_million(price_field(entry, "cache_creation_input_token_cost").unwrap_or(input)),
                output: per_million(output),
            },
        });
    }
    if prices.is_empty() {
        return None;
    }
    prices.sort_by(|first, second| first.model.cmp(&second.model));
    Some(prices)
}

/// The hash FNV-1a of 64 bits of the prices, written in hexadecimal. Two lists with the same models and the same prices have
/// the same hash, whatever the order of the entries and the fields of the file.
pub fn content_hash(prices: &[ListedModelPrice]) -> String {
    let mut text = String::new();
    for listed in prices {
        text.push_str(&format!(
            "{}|{}|{}|{}|{}|{}\n",
            listed.provider,
            listed.model,
            listed.price.fresh_input,
            listed.price.cached_input,
            listed.price.cache_write_input,
            listed.price.output
        ));
    }
    let hash = text.bytes().fold(0xcbf2_9ce4_8422_2325_u64, |hash, byte| (hash ^ u64::from(byte)).wrapping_mul(0x0000_0100_0000_01b3));
    format!("{hash:016x}")
}

/// The number of the field `name` of one entry of the price list, when it is a number that is not negative.
fn price_field(entry: &Value, name: &str) -> Option<f64> {
    entry.get(name).and_then(Value::as_f64).filter(|price| *price >= 0.0)
}

/// A price for one token in a price for one million tokens, rounded to nine decimal digits.
fn per_million(price: f64) -> f64 {
    (price * PRICE_TOKEN_COUNT * PRICE_DECIMAL_COUNT).round() / PRICE_DECIMAL_COUNT
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

    fn find<'a>(prices: &'a [ListedModelPrice], model: &str) -> &'a ListedModelPrice {
        prices.iter().find(|listed| listed.model == model).unwrap()
    }

    #[test]
    fn keeps_the_models_of_claude_code_and_of_codex_that_have_an_input_price_and_an_output_price_sorted_by_name() {
        let prices = parse_price_list(LIST).unwrap();
        let names: Vec<&str> = prices.iter().map(|listed| listed.model.as_str()).collect();
        assert_eq!(names, ["claude-haiku-4-5", "claude-opus-5", "gpt-6-sol"]);
        assert_eq!(find(&prices, "claude-opus-5").provider, "anthropic");
        assert_eq!(find(&prices, "gpt-6-sol").provider, "openai");
    }

    #[test]
    fn writes_the_prices_in_us_dollars_for_one_million_tokens_without_a_rounding_error() {
        let prices = parse_price_list(LIST).unwrap();
        assert_eq!(
            find(&prices, "claude-opus-5").price,
            ModelPrice { fresh_input: 5.0, cached_input: 0.5, cache_write_input: 6.25, output: 25.0 }
        );
        assert_eq!(find(&prices, "gpt-6-sol").price.cached_input, 0.2);
    }

    #[test]
    fn uses_the_input_price_for_a_cache_price_that_the_list_does_not_give() {
        let prices = parse_price_list(LIST).unwrap();
        let price = find(&prices, "claude-haiku-4-5").price;
        assert_eq!((price.cached_input, price.cache_write_input), (1.0, 1.0));
        assert_eq!(find(&prices, "gpt-6-sol").price.cache_write_input, 2.0);
    }

    #[test]
    fn refuses_a_text_that_is_not_a_price_list() {
        assert_eq!(parse_price_list("not json"), None);
        assert_eq!(parse_price_list("[]"), None);
        assert_eq!(parse_price_list(r#"{"x": {"litellm_provider": "bedrock"}}"#), None);
    }

    #[test]
    fn gives_the_same_hash_to_the_same_prices_and_another_hash_to_other_prices() {
        let prices = parse_price_list(LIST).unwrap();
        let reordered = LIST.replace("claude-opus-5", "claude-opus-5 ").replace("claude-opus-5 ", "claude-opus-5");
        assert_eq!(content_hash(&prices), content_hash(&parse_price_list(&reordered).unwrap()));
        let changed = LIST.replace("2.5e-05", "3e-05");
        assert_ne!(content_hash(&prices), content_hash(&parse_price_list(&changed).unwrap()));
        assert_eq!(content_hash(&prices).len(), 16);
    }
}
