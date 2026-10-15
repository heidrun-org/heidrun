# Directory Context: `/packages/auxiliary/mobile_website/dev`

## Purpose
The development server of the mobile website: it serves the page with Vite, and answers the calls of the page on `/api` with a fake computer, or sends them to the mobile server of the running desktop application.

## Key Exports & Entry Points
- `dev_server_plugin.ts`: the class `DevServerPlugin`, the Vite plugin that `vite.config.ts` loads. It works only for `vite` (`apply: 'serve'`), never for `vite build`.
- `dev_api.ts`: the class `DevApi`, a fake computer with four coding agents, the closed list of methods, and the pairing key check of the mobile server.
- Command to run this folder: `pnpm --filter mobile_website dev`, or `MOBILE_API_TARGET=http://127.0.0.1:47823 pnpm --filter mobile_website dev` to use the real desktop application.

## Rules
- Nothing in `src` imports from this folder, and nothing of this folder reaches the built website in `dist`.
- `DevApi` answers the same methods with the same shapes as the mobile server: when a call of the page changes, change `DevApi` in the same commit.
- The development server sends no `Content-Security-Policy` header. The tests of `tests/rendering_safety.test.ts` and the mobile server check the strict policy.
- The proxy to the real application rewrites the headers `Host` and `Origin`, because the mobile server refuses an address that is not its own.

## Background
- The reason for this folder is that a change of the page used to need a new build of the mobile server and a restart of the whole application, see [issue #525](https://github.com/heidrun-org/heidrun/issues/525).
