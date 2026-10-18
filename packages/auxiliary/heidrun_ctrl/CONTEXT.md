# Directory Context: `/packages/auxiliary/heidrun_ctrl`

## Purpose
A Rust library and the `heidrun_ctrl` command line for controlling Heidrun macros and launchers, plus an Agent Plugin that distributes its skill. Each command group supports list, add, update, and delete. The command line changes files that Heidrun watches; it never talks to the running application or runs a launcher.

## Key Exports & Entry Points
- `src/lib.rs`: the only public library interface. It exports the macro and launcher types, storage functions, list/add/update/delete operations, and output formatting.
- `src/main.rs`: the `heidrun_ctrl` executable. `src/command_line.rs` parses arguments and holds the help text.
- `plugin.json`: the Agent Plugin manifest. Its skill is in `skills/heidrun-ctrl/`, and a test compares its `SKILL.md` with the command help and runs its examples.
- `tests/`: executable tests with temporary data and a temporary project. Library tests sit beside the source.
- Command to run this folder: `pnpm --silent heidrun_ctrl --help`
- Command to test this folder: `pnpm --filter heidrun_ctrl test`

## Rules
- The three kinds of macro are `hard_coded`, `personal`, and `project`: the words are in the glossary, in [macros.md](../../../docs/agents_rules/glossary/macros.md).
- Hard-coded macros live only in `src/hard_coded_macros.rs`. The application reads them through `macros_hard_coded`; no command changes them.
- Personal macros live in `HEIDRUN_DIR/macros.json`, or `~/.config/heidrun/macros.json`. The desktop application uses this library to read and write them.
- Project macros live in the `prompts` key of `.heidrun/config.json`; changes keep the other keys, their order, and unknown macro fields.
- Launchers live in the `launchers` key of `.heidrun/config.json`; changes keep other keys, their order, and unknown launcher fields. The old `actions` key is read and replaced on write; a file with both keys is an error.
- A launcher of the kind Coding agent keeps its `agent` field; `launchers update` refuses `--command` for it. `launchers add` makes only command line launchers, and `launchers delete` does not close a tab.
- A new launcher's default name is the first 20 characters of its command line on one line. Its id is the lowercase name with dashes, then a dash and four characters, as in `stores/project.ts` of `web_frontend`.
- The command line never overwrites an invalid file. A write uses a neighboring file and renames it into place.
- An id is unique among all the kinds. A macro without an id in the key `prompts` has the id `projet-<index>`, as in the window.
- Commands write success to standard output with exit code 0, or one error to standard error with exit code 1. Output formats are `markdown` and `json`; a separate renderer adds colors.
- The package knows nothing about Tauri and imports no other package of the repository. `desktop_tauri` imports this package. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.
- The Agent Plugin and the skill stay in this package. The skill name is `heidrun-ctrl`, while the command line keeps the name `heidrun_ctrl`.
- The repository copy in `.agents/skills/heidrun-ctrl/` matches this package's skill so that a coding agent working in the Heidrun repository sees the same instructions.

## Background
- The package comes from [issue #602](https://github.com/heidrun-org/heidrun/issues/602). The group `launchers` comes from [issue #649](https://github.com/heidrun-org/heidrun/issues/649).
- The `SKILL.md` follows the layout of [heidrun_data](../../data_layers/heidrun_data/CONTEXT.md), from [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
- The Agent Plugin comes from [issue #679](https://github.com/heidrun-org/heidrun/issues/679).
