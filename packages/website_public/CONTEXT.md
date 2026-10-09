# Directory Context: `/packages/website_public`

## Purpose
The public website of Heidrun: a homepage and the user documentation, built with VitePress and published on GitHub Pages with the script `deploy_github_pages`.

## Key Exports & Entry Points
- `docs/`: the Markdown source of the website. `docs/index.md` is the homepage. `docs/documentation/` holds the documentation pages.
- `docs/.vitepress/config.ts`: the VitePress configuration (title, navigation, sidebar, `base`).
- Command to run this folder: `pnpm --filter website_public dev`

## Rules
- The `base` option in `docs/.vitepress/config.ts` equals the GitHub Pages path of the repository (`/heidrun/`).
- Nothing in this folder imports from another package of the workspace.

## Background
- The package was created by [issue #69](https://github.com/heidrun-org/heidrun/issues/69).
