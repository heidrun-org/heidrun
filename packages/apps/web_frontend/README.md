# web_frontend

The user interface of [Heidrun](../../../README.md), written with Vue 3, TypeScript, and Vite. The window of [`desktop_tauri`](../desktop_tauri) displays it.

## What it contains

- `src/components`: the sidebar, the panes, the inspector, the right panel, and the windows.
- `src/stores`: the state of the application.
- `src/lib`: shared logic, including `shortcuts.json`, the list of keyboard shortcuts.
- `src/i18n`: the translations.

## Commands

Run these commands from the root of the repository.

```sh
pnpm dev:web     # start the interface alone in a browser, with Vite
pnpm build:web   # check the types and build the interface
```
