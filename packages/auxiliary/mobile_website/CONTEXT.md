# Directory Context: `/packages/auxiliary/mobile_website`

## Purpose
The mobile website of Heidrun Mobile: the page that the phone opens to keep the coding agents working when the developer is away from the desk. The mobile server serves it from the Mac, and the page talks only to the mobile server.

## Key Exports & Entry Points
- `index.html`: the whole page, with its style and its script. The package `mobile_server` holds this file inside its program with `include_str!`, so a change of this file needs a new build of the desktop application.

## Rules
- This package imports nothing from `web_frontend`, and nothing from `desktop_tauri`.
- The page calls only the closed list of methods of the mobile server, with the header `x-herdr-token`.
- The page holds the pairing key in the address after `#`, which a browser never sends to a server.

## Background
- The page moved here from `packages/apps/desktop_tauri/mobile` with no change, in step 1 of [issue #525](https://github.com/heidrun-org/heidrun/issues/525). Step 2 replaces it with a package built with Vite. The plan is in [issue #524](https://github.com/heidrun-org/heidrun/issues/524).
