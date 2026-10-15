# mobile_server

The mobile server of [Heidrun](../../../README.md): a Rust library that serves the built mobile website on the Tailscale address of the Mac, checks the pairing key of every request, and hands each call on `/api` to the desktop application. The application `desktop_tauri` starts it.

## Run it

The server has no command line of its own. It runs inside Heidrun, when the section "Mobile access" of the Settings window is on. To start Heidrun with the server on this Mac only, with no Tailscale:

```bash
HEIDRUN_MOBILE_BIND=127.0.0.1 pnpm dev -- -- --no-splash-screen
```

The server then listens on `http://127.0.0.1:47823`. It serves the copy of the website that was built when Heidrun started, with no reload.

## Work on the website while the server runs

To see a change of the website at once, without starting Heidrun again, use the development server of the package `mobile_website`, with the made-up coding agents or with the running Heidrun. The two commands are in the file [README.md](../mobile_website/README.md) of that package.

## Test

```bash
pnpm --filter mobile_server test   # builds mobile_website, then runs cargo test
```

The rules of this package are in [CONTEXT.md](CONTEXT.md).
