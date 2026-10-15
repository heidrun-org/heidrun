# Directory Context: `/packages/auxiliary/mobile_server`

## Purpose
The mobile server of Heidrun Mobile. It serves the mobile website on the Tailscale address of the Mac only, checks the pairing key of every request, and hands each call of the phone to the desktop application. It knows nothing about coding agents and nothing about Tauri.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `MobileServer`, `MobileStatus`, `MobileConfig`, `load_config`, `save_config`, `new_token`, `MobileCallHandler`, and `CallFuture`.
- `src/handler.rs`: the trait `MobileCallHandler`, which the desktop application implements.
- `src/router.rs`: the three routes: the page, the manifest, and the calls of the phone, with the closed list of methods.
- `src/access.rs`: the checks of a request: the header Host, the header Origin, the pairing key, and the lock after ten bad keys.
- `src/server.rs`: the life of the server: it listens, follows the Tailscale address, and stops.
- `src/tailscale.rs`: the Tailscale address of the Mac.
- `src/config.rs`: the file `mobile.json`, and the creation of a pairing key.
- Command to test this folder: `pnpm --filter mobile_server test`

## Rules
- This package imports nothing from Tauri and nothing from another package of the workspace. The desktop application gives the server what it needs through the trait `MobileCallHandler`.
- The server listens only on an address of the range 100.64.0.0/10, which is the Tailscale range. The variable `HEIDRUN_MOBILE_BIND` may set a Tailscale address or a loopback address for a test on the Mac, and never `0.0.0.0`.
- Every route of the closed list of methods needs the pairing key, and a method that is not in the list never reaches the handler. A new method goes in `METHODS` in `src/router.rs`, and in no other place.
- The page that the server serves is the file `index.html` of the package `mobile_website`, held inside the program with `include_str!`. This package never restates the page.
- The pairing key is checked on every request, so a new key cuts off the connections that are still open, and the right key is never locked out.
- `MobileServer::start` returns a future and listens only when the caller spawns it, because this package does not own an async runtime.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one. Cargo reads this file only when it runs inside this folder.
- The texts that the phone shows are still in French, as the page of today. They change with the English texts of the mobile website.

## Background
- The package was created by step 1 of [issue #525](https://github.com/heidrun-org/heidrun/issues/525), the plan of [issue #524](https://github.com/heidrun-org/heidrun/issues/524). It holds the code that was in `packages/apps/desktop_tauri/src/mobile.rs` before, with no change of behavior.
