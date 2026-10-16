# Directory Context: `/packages/auxiliary/mobile_server`

## Purpose
The mobile server of Heidrun Mobile. It serves the mobile website on the loopback address only. An ngrok tunnel, made by the program `ngrok`, gives that address a fixed public HTTPS address. The server checks the host name of the tunnel and the pairing key of every request, and hands each call of the phone to the desktop application. It knows nothing about coding agents and nothing about Tauri.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `MobileServer`, `MobileStatus`, `MobileError`, `MobileErrorKind`, `MobileConfig`, `load_config`, `save_config`, `new_token`, `MobileCallHandler`, and `CallFuture`.
- `src/handler.rs`: the trait `MobileCallHandler`, which the desktop application implements.
- `src/router.rs`: the route `/api` with the closed list of methods, and the files of the mobile website for every other address.
- `src/embedded.rs` and `build.rs`: the files of the folder `dist` of `mobile_website`, held inside the program, and the `Content-Type` of each file.
- `src/access.rs`: the checks of a request: the header Host, the header Origin, the pairing key, and the lock after ten bad keys.
- `src/server.rs`: the life of the server: it listens, keeps the tunnel open, shows its address, and stops.
- `src/tunnel.rs`: finds and starts the program `ngrok`, and reads its messages and the address of the tunnel. It also holds the fake `ngrok` program of the tests.
- `src/config.rs`: the file `mobile.json`, and the creation of a pairing key.
- `src/push.rs`: the key of the server and the phones in the file `mobile_push.json` (readable by this user only), and `send_all`, which wakes each phone with a request that has no body.
- Command to test this folder: `pnpm --filter mobile_server test`. The command builds `mobile_website` first. The test `live_...` opens a real tunnel with a signed-in `ngrok`, so it runs only by hand: `cargo test live_ -- --ignored --nocapture`.

## Rules
- This package imports nothing from Tauri and nothing from another package. The only thing that it reads from another package is the folder `dist` of `mobile_website`, at build time.
- The server listens only on `127.0.0.1`, never on `0.0.0.0` and never on an address of the network, and no variable changes this.
- The only host name that passes is the host name of the tunnel, and the header Origin must be `https://` followed by it. The loopback address and every other name are refused, even with the right key. Before the tunnel has an address, every request is refused.
- The host name comes only from the record `started tunnel` of the log of `ngrok`: an `https` host name with no port and no path. An address in any other record or line never counts.
- The address is published as soon as `ngrok` announces it, because the address of the account is fixed and every name server already knows it.
- `ngrok` is started with `--inspect=false`, so its local web interface never remembers a request, and the pairing key in it.
- The codes `ERR_NGROK_4018` and `ERR_NGROK_334` in the messages of `ngrok` give the errors `ngrokNotSignedIn` and `ngrokAddressInUse`. After `ngrokNotSignedIn`, the next try waits three times longer.
- `stop` and a new run kill the program `ngrok` at once, with no async runtime. A task of an older run changes nothing, because every change checks the number of its run.
- The program is started as `ngrok http 127.0.0.1:<port> --inspect=false --log=stdout --log-format=json`. The variable `HEIDRUN_NGROK` gives its path, and without it the usual folders are searched, because an application that the Finder starts has no `PATH`.
- Every route of the closed list of methods needs the pairing key, and a method outside the list never reaches the handler. A new method goes in `METHODS` in `src/router.rs`. The methods `pushKey`, `subscribe`, and `unsubscribe` never reach the handler.
- A new key (`replace_token`, or a new run) cuts off open connections at once, and the right key is never locked out. `replace_token` keeps the tunnel and its address.
- The server serves only the embedded files, so no address reaches the disk. The header `Content-Security-Policy` allows only files of the server itself, and a test refuses `unsafe-inline` and `unsafe-eval`. A test lists the `Content-Type` of every file of `dist` on its own.
- `MobileServer::start` returns a future and listens only when the caller spawns it, because this package owns no async runtime.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one.
- The texts that the server sends to the phone are in English. The status errors are codes: the Settings window writes the sentence.

## Background
- The package comes from [issue #525](https://github.com/heidrun-org/heidrun/issues/525), the plan of [issue #524](https://github.com/heidrun-org/heidrun/issues/524).
- The tunnel replaced the first way to reach the server in [issue #542](https://github.com/heidrun-org/heidrun/issues/542), which answers the open choice of [issue #541](https://github.com/heidrun-org/heidrun/issues/541).
- The choice of ngrok, for a fixed address and a QR code that is scanned once, is in [issue #549](https://github.com/heidrun-org/heidrun/issues/549).
