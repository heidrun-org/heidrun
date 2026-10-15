# Directory Context: `/packages/auxiliary/mobile_website/src/assets`

## Purpose
The pictures that the screens of the mobile website import. Vite copies each picture into `dist/assets` with a hashed name, and the mobile server sends it with a long cache time.

## Key Exports & Entry Points
- `baby_goat.webp`: the baby goat of the welcome page, imported by `welcome_screen.ts`. It has a transparent background.

## Rules
- Every picture here is small, because the phone loads it over the network. The baby goat is 640 pixels wide and about 110 kilobytes.
- A picture type that is new needs its content type in `content_type_of` of the package `mobile_server`, and in the test table of its `router.rs`.

## Background
- The baby goat is a smaller copy of `data/images/baby_goat.png`, which stays the original. Make a new copy with `cwebp -q 85 -alpha_q 90 -resize 640 640 data/images/baby_goat.png -o baby_goat.webp` when the original changes.
