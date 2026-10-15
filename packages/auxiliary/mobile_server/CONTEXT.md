# Directory Context: `/packages/auxiliary/mobile_server`

## Purpose
The mobile server of Heidrun Mobile. It serves the mobile website on the Tailscale address of the Mac only, checks the pairing key of every request, and hands each call of the phone to the desktop application. It knows nothing about coding agents and nothing about Tauri.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `MobileServer`, `MobileStatus`, `MobileConfig`, `load_config`, `save_config`, `new_token`, `MobileCallHandler`, and `CallFuture`.
- `src/handler.rs`: the trait `MobileCallHandler`, which the desktop application implements.
- `src/router.rs`: the route `/api` for the calls of the phone, with the closed list of methods, and the files of the mobile website for every other address.
- `src/embedded.rs`: the files of the mobile website, and the `Content-Type` of each file.
- `build.rs`: puts the folder `dist` of the package `mobile_website` inside the program.
- `src/access.rs`: the checks of a request: the header Host, the header Origin, the pairing key, and the lock after ten bad keys.
- `src/server.rs`: the life of the server: it listens, follows the Tailscale address, and stops.
- `src/tailscale.rs`: the Tailscale address of the Mac.
- `src/config.rs`: the file `mobile.json`, and the creation of a pairing key.
- Command to test this folder: `pnpm --filter mobile_server test`. The command builds the package `mobile_website` first.

## Rules
- This package imports nothing from Tauri and nothing from another package of the workspace. The only thing that it reads from another package is the folder `dist` of `mobile_website`, at build time. The desktop application gives the server what it needs through the trait `MobileCallHandler`.
- The server listens only on an address of the range 100.64.0.0/10, which is the Tailscale range. The variable `HEIDRUN_MOBILE_BIND` may set a Tailscale address or a loopback address for a test on the Mac, and never `0.0.0.0`.
- Every route of the closed list of methods needs the pairing key, and a method that is not in the list never reaches the handler. A new method goes in `METHODS` in `src/router.rs`, and in no other place.
- The files that the server serves are the files of the folder `dist` of the package `mobile_website`, held inside the program by `build.rs`. This package never restates the page. A build without that folder fails with a message that says to run `pnpm --filter mobile_website build`.
- A request for a file finds only a path of the embedded table, so no address reaches the disk. The header `Content-Security-Policy` allows only files of the server itself (`script-src 'self'; style-src 'self'`), and a test refuses `unsafe-inline` and `unsafe-eval`.
- Every file of `dist` is served with a `Content-Type` that a test lists on its own. A file of a new kind stops the test until its type is added.
- The pairing key is checked on every request, so a new key cuts off the connections that are still open, and the right key is never locked out.
- `MobileServer::start` returns a future and listens only when the caller spawns it, because this package does not own an async runtime.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one. Cargo reads this file only when it runs inside this folder.
- The texts that the server sends to the phone are in English, like the texts of the mobile website.

## Background
- The package was created by step 1 of [issue #525](https://github.com/heidrun-org/heidrun/issues/525), the plan of [issue #524](https://github.com/heidrun-org/heidrun/issues/524). It holds the code that was in `packages/apps/desktop_tauri/src/mobile.rs` before, with no change of behavior. Step 2 replaced the one embedded file with the embedded folder `dist`, and changed the texts to English.
