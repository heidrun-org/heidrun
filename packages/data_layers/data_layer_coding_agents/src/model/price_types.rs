//! The data shapes of the model prices: the prices of one model, and the version of a price list.
//!
//! The prices are estimates at the public price of each model, as the price list of the project LiteLLM gives it. They are not
//! the payment of a subscription, and not an invoice. Every price is in US dollars for one million tokens.

/// The unit of every price of the package, written in the table `model_price_versions`.
pub const PRICE_UNIT: &str = "US dollars for one million tokens";

/// The number of tokens that a price counts.
pub const PRICE_TOKEN_COUNT: f64 = 1_000_000.0;

/// The prices of one model, in US dollars for one million tokens.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ModelPrice {
    /// One million input tokens that were neither read from the cache nor written to it.
    pub fresh_input: f64,
    /// One million input tokens that were read from the cache.
    pub cached_input: f64,
    /// One million input tokens that were written to the cache.
    pub cache_write_input: f64,
    /// One million output tokens.
    pub output: f64,
}

impl ModelPrice {
    /// The cost in US dollars of these tokens at these prices. The four numbers never count the same token twice.
    pub fn cost(&self, fresh_input: u64, cached_input: u64, cache_write_input: u64, output: u64) -> f64 {
        (fresh_input as f64 * self.fresh_input
            + cached_input as f64 * self.cached_input
            + cache_write_input as f64 * self.cache_write_input
            + output as f64 * self.output)
            / PRICE_TOKEN_COUNT
    }
}

/// The price of one model in a price list, with the provider that the list gives to the model.
#[derive(Debug, Clone, PartialEq)]
pub struct ListedModelPrice {
    /// The provider of the model in the price list, for example `anthropic` or `openai`.
    pub provider: String,
    /// The name of the model in the price list.
    pub model: String,
    /// The prices of the model.
    pub price: ModelPrice,
}

/// One version of the price list: the prices that one fetch of the price list gave, when no earlier version has the same
/// prices.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PriceVersion {
    /// The number of the version. The first version is 1, and each version has the number after the one before.
    pub version: i64,
    /// When the prices of this version were fetched the first time, in the format ISO 8601.
    pub retrieved_at: String,
    /// When the price list was fetched the last time and still gave the prices of this version, in the format ISO 8601.
    pub checked_at: String,
    /// The address, or the path of the file, where the price list was fetched.
    pub source: String,
    /// The unit of the prices of this version. It is always `PRICE_UNIT`.
    pub unit: String,
    /// The hash of the prices of this version. Two fetches with the same hash give the same version.
    pub content_hash: String,
    /// The number of models of this version.
    pub model_count: usize,
}

/// What a refresh of the prices did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PriceRefresh {
    /// The latest version was checked less than a day ago, so nothing was fetched.
    Fresh {
        /// The number of the latest version.
        version: i64,
    },
    /// The price list was fetched and gave the prices of the latest version.
    Unchanged {
        /// The number of the latest version.
        version: i64,
    },
    /// The price list was fetched and gave other prices, which are now the latest version.
    NewVersion {
        /// The number of the new version.
        version: i64,
        /// The number of models of the new version.
        model_count: usize,
    },
}
