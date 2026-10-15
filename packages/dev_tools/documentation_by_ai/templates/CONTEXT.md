# Directory Context: `/packages/dev_tools/documentation_by_ai/templates`

## Purpose
Portable presentation resources for independent troubleshooting topics in the user documentation.

## Key Exports & Entry Points
- `troubleshooting_panels.ts`: the TroubleshootingPanels.configure Markdown hook, copied into the website theme on generation if absent.
- `troubleshooting.css`: matching light/dark theme styles using VitePress color variables.

## Rules
- These resources are not imported into or installed on the website during package creation.
- The renderer wraps independent level-three topics under Troubleshooting without altering ordinary numbered steps.
- The renderer contains no page-specific history rules.

## Background
- [Learned presentation rules](../prompts/learned_prompt.md).
