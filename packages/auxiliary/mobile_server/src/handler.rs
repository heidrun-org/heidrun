//! The trait that the desktop application implements: the only way for a call of the phone to reach the desktop.

use serde_json::Value;
use std::future::Future;
use std::pin::Pin;

/// The answer of the desktop application to one call of the phone. `Err` carries a text for the phone.
pub type CallFuture = Pin<Box<dyn Future<Output = Result<Value, String>> + Send>>;

/// Answers the calls that the phone sends. The mobile server checks the pairing key and the method name before it
/// calls `handle_call`, so the handler only sees the methods of the closed list.
pub trait MobileCallHandler: Send + Sync + 'static {
    /// Answers one call of the phone, with the same data and the same guards as the desktop window.
    fn handle_call(&self, method: String, params: Value) -> CallFuture;
}
