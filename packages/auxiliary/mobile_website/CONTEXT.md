# Directory Context: `/packages/auxiliary/mobile_website`

## Purpose
The mobile website of Heidrun Mobile: the page that the phone opens to keep the coding agents working when the developer is away from the desk. The mobile server serves the built page from the Mac, and the page talks only to the mobile server.

## Key Exports & Entry Points
- `index.html`: the entry of Vite. It names `src/main.ts` and `public/manifest.webmanifest`.
- `src/mobile_app.ts`: the class `MobileApp`. It holds the open screen, refreshes the data, and handles the taps.
- `src/mobile_api.ts`: the pairing key of the phone, and the calls to the mobile server.
- `src/screens/`: one class for each screen. See its own CONTEXT.md.
- `src/components/`: the parts that several screens share. See its own CONTEXT.md.
- `tests/`: the Vitest tests, which run the whole page against a fake Mac.
- `dist/`: the built website. Git ignores it. The package `mobile_server` holds this folder inside its program at build time.
- Command to build this folder: `pnpm --filter mobile_website build`
- Command to test this folder: `pnpm --filter mobile_website test`

## Rules
- This package has no `src/index.ts` and no `exports` entry. No package imports it. The package `mobile_server` reads only the folder `dist`.
- This package imports nothing from `web_frontend`, and nothing from `desktop_tauri`.
- The page has no framework, no inline script, no inline style, and no event attribute in its HTML. The header `Content-Security-Policy` of the mobile server allows only files of its own address, and a test checks every screen.
- Every text that comes from the Mac or from a coding agent goes through `HtmlEscape.escape` before it enters a template. A test with hostile text checks it.
- The page calls only the closed list of methods of the mobile server (`state`, `read`, `answer`, `prompt`, `keys`), with the header `x-herdr-token`.
- The pairing key comes in the address after `#t=`, which a browser never sends to a server. The phone keeps it in `localStorage` under the name `hd-token`, so a phone that is already paired stays paired.
- The texts of the page are in English. A text says "coding agent", never "agent" alone.
- A change of this package needs a new build of the package `mobile_server`. The scripts `test` and `tauri dev` and `tauri build` build this package first.

## Background
- The page moved here from `packages/apps/desktop_tauri/mobile` in step 1 of [issue #525](https://github.com/heidrun-org/heidrun/issues/525). Step 2 replaced the single file with this Vite and TypeScript package, with the layout of three screens and a bottom bar. The plan is in [issue #524](https://github.com/heidrun-org/heidrun/issues/524).
- The calls of the first page are kept as they were, so the desktop application needs no change.
