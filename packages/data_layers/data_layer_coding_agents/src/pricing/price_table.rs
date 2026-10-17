//! The prices of the models in memory, and the estimated cost of tokens.
//!
//! The table holds one version of the price list. The cost is an estimate: it assumes that every request was paid by token at
//! the public price of its model. A developer on a fixed subscription pays something else. The view `token_usage_with_cost`
//! of the SQLite file calculates the same cost with the same rule; a test of the package compares the two.

use crate::model::price_types::{ModelPrice, PriceVersion};
use crate::model::types::ModelTokens;
use std::collections::BTreeMap;

/// The prices of the models for one version of the price list.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PriceTable {
    /// The version of the price list that these prices come from, or `None` for a table without a price.
    pub version: Option<PriceVersion>,
    /// The prices, by the name of the model.
    pub prices: BTreeMap<String, ModelPrice>,
}

impl PriceTable {
    /// The prices of `model`: the entry with this exact name, else the entry without the date that ends the name
    /// (`claude-haiku-4-5-20251001` finds `claude-haiku-4-5`). Returns `None` for a model that has no price.
    pub fn price_of(&self, model: &str) -> Option<&ModelPrice> {
        self.prices.get(model).or_else(|| self.prices.get(without_date(model)?))
    }

    /// The cost in US dollars of these tokens of `model`. Returns `None` when the model has no price: an unknown cost is never
    /// zero.
    pub fn cost_of(&self, model: &str, fresh_input: u64, cached_input: u64, cache_write_input: u64, output: u64) -> Option<f64> {
        Some(self.price_of(model)?.cost(fresh_input, cached_input, cache_write_input, output))
    }

    /// The cost of the tokens of a chat, in US dollars. Returns `None` when the chat used no token, and when one model that
    /// the chat used has no price: a cost without the tokens of that model would be too small, so none is given.
    pub fn cost(&self, tokens: &[ModelTokens]) -> Option<f64> {
        let mut total = 0.0;
        let mut has_tokens = false;
        for used in tokens.iter().filter(|used| used.fresh_input + used.cached_input + used.cache_write_input + used.output > 0) {
            total += self.cost_of(&used.model, used.fresh_input, used.cached_input, used.cache_write_input, used.output)?;
            has_tokens = true;
        }
        has_tokens.then_some(total)
    }
}

/// The name of a model without the date `-YYYYMMDD` that ends it, or `None` when the name does not end with a date.
pub fn without_date(model: &str) -> Option<&str> {
    let (name, date) = model.rsplit_once('-')?;
    (date.len() == 8 && date.bytes().all(|byte| byte.is_ascii_digit())).then_some(name)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table() -> PriceTable {
        PriceTable {
            version: None,
            prices: BTreeMap::from([
                (
                    "claude-opus-5".to_string(),
                    ModelPrice { fresh_input: 5.0, cached_input: 0.5, cache_write_input: 6.25, output: 25.0 },
                ),
                (
                    "claude-haiku-4-5".to_string(),
                    ModelPrice { fresh_input: 1.0, cached_input: 1.0, cache_write_input: 1.0, output: 5.0 },
                ),
                (
                    "gpt-6-sol".to_string(),
                    ModelPrice { fresh_input: 2.0, cached_input: 0.2, cache_write_input: 2.0, output: 10.0 },
                ),
            ]),
        }
    }

    fn tokens(model: &str, fresh_input: u64, cached_input: u64, cache_write_input: u64, output: u64) -> ModelTokens {
        ModelTokens { model: model.to_string(), fresh_input, cached_input, cache_write_input, output }
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
        let cost = table().cost(&[tokens("claude-opus-5", 1_000_000, 2_000_000, 100_000, 10_000)]).unwrap();
        // 1 000 000 × 5 + 2 000 000 × 0.5 + 100 000 × 6.25 + 10 000 × 25, all divided by 1 000 000
        assert!((cost - (5.0 + 1.0 + 0.625 + 0.25)).abs() < 1e-9, "{cost}");
    }

    #[test]
    fn adds_the_cost_of_each_model_of_a_chat() {
        let used = [tokens("claude-opus-5", 0, 0, 0, 1_000_000), tokens("gpt-6-sol", 1_000_000, 0, 0, 0)];
        assert!((table().cost(&used).unwrap() - 27.0).abs() < 1e-9);
    }

    #[test]
    fn gives_no_cost_when_a_model_has_no_price_or_when_no_token_was_used() {
        let table = table();
        assert_eq!(table.cost(&[tokens("claude-opus-5", 0, 0, 0, 5), tokens("codex-auto-review", 0, 0, 0, 5)]), None);
        assert_eq!(table.cost(&[tokens("", 0, 0, 0, 5)]), None);
        assert_eq!(table.cost(&[]), None);
        assert_eq!(table.cost(&[tokens("claude-opus-5", 0, 0, 0, 0)]), None);
        assert_eq!(table.cost_of("codex-auto-review", 1, 1, 1, 1), None);
    }
}
