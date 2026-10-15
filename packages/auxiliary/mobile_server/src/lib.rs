//! The mobile server of Heidrun: it serves the mobile website on the Tailscale address of the Mac only, checks the
//! pairing key of every request, and hands each call of the phone to the desktop application through the trait
//! `MobileCallHandler`. The server knows nothing about coding agents, and nothing about Tauri.

mod access;
mod config;
mod embedded;
mod handler;
mod router;
mod server;
mod tailscale;

pub use config::{load_config, new_token, save_config, MobileConfig};
pub use handler::{CallFuture, MobileCallHandler};
pub use server::{MobileServer, MobileStatus};
