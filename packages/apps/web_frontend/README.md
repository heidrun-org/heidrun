# web_frontend

The user interface of [Heidrun](../../../README.md), written with Vue 3, TypeScript, and Vite. The window of [`desktop_tauri`](../desktop_tauri) displays it.

## What it contains

- `src/components`: the left sidebar, the tab bar, the panes, the inspector, the right sidebar, and the windows.
- `src/stores`: the state of the application.
- `src/lib`: shared logic, including `shortcuts.json`, the list of keyboard shortcuts.
- `src/i18n`: the translations.
- `src/dev`: a fake Tauri bridge with a fake Herdr session. It only runs in the development server, and only in a plain browser, so that `pnpm dev:web` shows the connected screens.
- `src/bootstrap_parts.scss`: the Bootstrap parts that the interface uses, all inside one CSS layer, so that a rule of the interface always wins over a Bootstrap rule. It also holds the few Bootstrap utility classes that the interface uses. The base look of every button, the rule `.btn` of `src/styles.css`, is made of the Bootstrap button variables `--bs-btn-*`, and a button that has the class `btn` leaves the global rule `button`. See [issue 141](https://github.com/heidrun-org/heidrun/issues/141).

## Commands

Run these commands from the root of the repository.

```sh
pnpm dev:web     # start the interface alone in a browser, with Vite and a fake Herdr session
pnpm build:web   # check the types and build the interface
```
