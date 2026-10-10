# desktop-tauri

The macOS application of [Heidrun](../../README.md): the Rust backend and the Tauri 2 shell that hosts the user interface.

## What it does

- Talks to the Herdr server and starts it in the background if it is not running.
- Runs the terminals of the panes with `portable-pty`.
- Reads the git state, the project files, the job history, and the Claude and Codex usage.
- Serves the mobile access (iPhone and iPad over Tailscale) with `axum`.

## Commands

Run these commands from the root of the repository.

```sh
pnpm dev     # start the application in development
pnpm build   # build Heidrun.app in packages/desktop-tauri/target/release/bundle/macos/
```

## Related packages

- [`web-frontend`](../web-frontend): the user interface displayed in the window of this application.
