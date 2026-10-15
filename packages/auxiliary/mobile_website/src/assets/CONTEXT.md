# Directory Context: `/packages/auxiliary/mobile_website/src/assets`

## Purpose
The pictures that the screens of the mobile website import. Vite copies each picture into `dist/assets` with a hashed name, and the mobile server sends it with a long cache time.

## Key Exports & Entry Points
- `heidrun_splash_screen.jpg`: the goat of the welcome page, imported by `welcome_screen.ts`.

## Rules
- Every picture here is small, because the phone loads it over the network. The goat is 640 pixels wide.
- A picture type that is new needs its content type in `content_type_of` of the package `mobile_server`, and in the test table of its `router.rs`.

## Background
- The goat is a smaller copy of `packages/apps/web_frontend/src/assets/heidrun_splash_screen.jpg`, which stays the original. Make a new copy with `sips -Z 640` when the original changes.
