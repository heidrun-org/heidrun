# Directory Context: `/packages/apps/web_frontend/src/design`

## Purpose
Checks shared visual rules and applies named colour teams throughout the application from Settings.

## Key Exports & Entry Points
- `design_rules.ts`: `DesignRules`, source checks and contrast calculations used by the normal frontend tests.
- `theme_palette.ts`: `ThemePalette`, the named application-wide colour teams applied by the theme store and saved locally.
- `design_review_samples.vue`: the shared control samples used by the standalone development review.
- `control_styles.test.ts`: checks every application button and text field for a shared treatment.
- Command: `pnpm --filter web_frontend test`.

## Rules
- The palette and button implementation belong to `../styles.css`; this folder never duplicates their values.
- The status dots retain the rules and tests of issue 739.
- Exceptions name the exact source and the reason in the shared design rules document.

## Background
- https://github.com/heidrun-org/heidrun/issues/749
