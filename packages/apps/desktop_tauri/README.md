# desktop_tauri

The macOS application of [Heidrun](../../../README.md): the Rust backend and the Tauri 2 shell that hosts the user interface.

## What it does

- Talks to the Herdr server of its own named session, `heidrun`, and starts the server in the background if it is not running. A development build that runs from a worktree uses the session `heidrun_` followed by the name of the worktree, because Herdr allows one attach client for each terminal. The environment variables `HERDR_SESSION` and `HERDR_SOCKET_PATH` choose another session.
- Stops its session when the user quits, unless the setting "Keep agents running after quit" is on. The default Herdr session of a terminal is never stopped.
- Runs the terminals of the panes with `portable-pty`.
- Reads the git state, the project files, the job history, and the Claude and Codex usage.
- Serves the mobile access (iPhone and iPad over Tailscale) with `axum`.

## Commands

Run these commands from the root of the repository.

```sh
pnpm dev     # start the application in development
pnpm build   # build Heidrun.app in packages/apps/desktop_tauri/target/release/bundle/macos/
```

## Related packages

- [`web_frontend`](../web_frontend): the user interface displayed in the window of this application.
