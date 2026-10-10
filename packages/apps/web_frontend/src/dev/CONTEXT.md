# Directory Context: `/packages/apps/web_frontend/src/dev`

## Purpose
Code that only runs in the development server, so that the web frontend shows its connected screens in a plain browser, without the Tauri window and without a running Herdr server.

## Key Exports & Entry Points
- `install_tauri_mock.ts`: imported first by `src/main.ts`; calls `TauriMock.install()`.
- `tauri_mock.ts`: `TauriMock`, a minimal replacement for the Tauri bridge. It answers a short list of Tauri commands and rejects every other command.
- `tauri_mock_fixture.ts`: `TauriMockFixture`, the fake Herdr session (two workspaces, three tabs, four panes, every agent status).
- Command to run this folder: `pnpm dev:web`, then open `http://localhost:1420`.

## Rules
- Nothing in the production build contains this folder: `TauriMock.install()` returns at once when `import.meta.env.DEV` is false.
- `TauriMock.install()` does nothing when a real Tauri bridge already exists, so the Tauri window never uses the mock.
- Nothing outside this folder imports from this folder, except the first import line of `src/main.ts`.
- A Tauri command that the mock does not list is rejected with an error. Add a command to the mock only when a screen needs it to render.
- The terminal panel stays without a mock: the commands `pty_spawn`, `pty_write`, `pty_resize`, and `pty_kill` are rejected.

## Background
- The mock exists to take screenshots before and after each step of the migration to Bootstrap: [issue 141](https://github.com/heidrun-org/heidrun/issues/141).
