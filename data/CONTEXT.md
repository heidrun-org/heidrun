# Directory Context: `/data`

## Purpose
The data files that several packages of the repository share: the identity texts of Heidrun and the key images.

## Key Exports & Entry Points
- `identity.json`: the title, the motto, and the description of Heidrun, with the motto and the description in English and in French. This file is the only place where these three texts are written by hand.
- `images/`: the key images of Heidrun. See [docs/marketing/README.md](../docs/marketing/README.md).

## Rules
- The application, the website, and the README get the title, the motto, and the description from `identity.json`. No other file holds a hand-written copy.
- The application reads `identity.json` through `packages/apps/web_frontend/src/i18n/index.ts`. The website reads it through `packages/auxiliary/website_public/docs/.vitepress/config.ts`. The README receives it from the command `pnpm docs:identity`.
- A test fails when the README differs from the output of `pnpm docs:identity`.

## Background
- The single source of truth for the three texts comes from [issue #246](https://github.com/heidrun-org/heidrun/issues/246).
