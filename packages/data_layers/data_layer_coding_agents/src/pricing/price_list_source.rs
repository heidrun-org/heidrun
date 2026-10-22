//! Where the public price list comes from: a web address, or a file. A test gives a file or a fake source, so no test reaches the
//! network.

use std::path::PathBuf;
use std::time::Duration;

/// How long a fetch of the price list can last, in seconds.
const FETCH_TIMEOUT_SECONDS: u64 = 30;

/// The most bytes of a price list that a fetch reads. The list of LiteLLM holds about two megabytes.
const FETCH_BYTE_LIMIT: u64 = 64 * 1024 * 1024;

/// A source of the text of the price list.
pub trait PriceListSource {
    /// The address, or the path of the file, that the text comes from. The database keeps it with each version of the prices.
    fn address(&self) -> String;

    /// Reads the text of the price list.
    ///
    /// # Errors
    /// An error when the source does not answer, or cannot be read.
    fn read(&self) -> Result<String, String>;
}

/// The price list at a web address.
pub struct WebPriceListSource {
    /// The web address, which starts with `http://` or `https://`.
    address: String,
}

impl WebPriceListSource {
    /// The source at `address`.
    pub fn new(address: &str) -> Self {
        WebPriceListSource { address: address.to_string() }
    }
}

impl PriceListSource for WebPriceListSource {
    fn address(&self) -> String {
        self.address.clone()
    }

    fn read(&self) -> Result<String, String> {
        let agent: ureq::Agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(FETCH_TIMEOUT_SECONDS)))
            .user_agent("Heidrun")
            .build()
            .into();
        let mut response =
            agent.get(&self.address).call().map_err(|error| format!("The price list {} cannot be fetched: {error}", self.address))?;
        response
            .body_mut()
            .with_config()
            .limit(FETCH_BYTE_LIMIT)
            .read_to_string()
            .map_err(|error| format!("The price list {} cannot be read: {error}", self.address))
    }
}

/// The price list in a file.
pub struct FilePriceListSource {
    /// The path of the file.
    path: PathBuf,
}

impl FilePriceListSource {
    /// The source in the file at `path`.
    pub fn new(path: PathBuf) -> Self {
        FilePriceListSource { path }
    }
}

impl PriceListSource for FilePriceListSource {
    fn address(&self) -> String {
        self.path.display().to_string()
    }

    fn read(&self) -> Result<String, String> {
        std::fs::read_to_string(&self.path)
            .map_err(|error| format!("The price list file {} cannot be read: {error}", self.path.display()))
    }
}

/// The source of an address: a web address when it starts with `http://` or `https://`, else the path of a file.
pub fn price_list_source_of(address: &str) -> Box<dyn PriceListSource> {
    if address.starts_with("http://") || address.starts_with("https://") {
        Box::new(WebPriceListSource::new(address))
    } else {
        Box::new(FilePriceListSource::new(PathBuf::from(address)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_a_file_and_names_its_path_as_the_address() {
        let path = std::env::temp_dir().join(format!("data_layer_coding_agents_price_source_{}.json", std::process::id()));
        std::fs::write(&path, "{}").unwrap();
        let source = price_list_source_of(&path.display().to_string());
        assert_eq!(source.address(), path.display().to_string());
        assert_eq!(source.read(), Ok("{}".to_string()));
        std::fs::remove_file(&path).unwrap();
        assert!(source.read().unwrap_err().contains("cannot be read"));
    }

    #[test]
    fn takes_an_address_that_starts_with_https_for_a_web_address() {
        let source = price_list_source_of("https://example.invalid/prices.json");
        assert_eq!(source.address(), "https://example.invalid/prices.json");
    }
}
