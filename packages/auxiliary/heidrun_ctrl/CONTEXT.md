# Directory Context: `/packages/auxiliary/heidrun_ctrl`

## Purpose
A Rust library and one command line tool, `heidrun_ctrl`, that control the Heidrun application for a coding agent, and the `SKILL.md` that teaches a coding agent to use it. The first group of commands is `macros`: list, add, update, and delete. The command line changes files, and the application watches them. It never talks to the running application.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `hard_coded_macros`, `personal_macros_path`, `read_personal_macros`, `write_personal_macros`, `read_project_macros`, `find_project_root`, `project_config_path`, `list_macros`, `add_macro`, `update_macro`, `delete_macro`, the types `Macro`, `MacroKind`, `ListedMacro`, `MacroPlaces`, `NewMacro`, and `MacroChanges`, and the output functions `list_text`, `changed_text`, `deleted_text`, `error_text`, and `Format`.
- `src/main.rs`: the command line, and the executable `heidrun_ctrl`. The module `src/command_line.rs` reads its arguments and holds the text of the help.
- `skills/heidrun_ctrl/`: the skill that teaches a coding agent the commands. A test compares `SKILL.md` with the help and runs its examples.
- `tests/`: the tests of the executable, with a temporary `HEIDRUN_DIR` and a temporary project. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent heidrun_ctrl --help`
- Command to test this folder: `pnpm --filter heidrun_ctrl test`

## Rules
- The three kinds of macro are `hard_coded`, `personal`, and `project`: the words are in the glossary, in [macros.md](../../../docs/agents_rules/glossary/macros.md).
- The hard-coded macros are written in `src/hard_coded_macros.rs`, and nowhere else. The desktop application reads them through the Tauri command `macros_hard_coded`, and a hard-coded macro is never added, changed, or deleted.
- The personal macros are the file `macros.json` in the folder of the variable `HEIDRUN_DIR`, else in `~/.config/heidrun`: a JSON list of macros with the fields `id`, `label`, `description`, and `text`. The desktop application reads and writes the file through this library, so the format has one place.
- The project macros are the key `prompts` of the file `.heidrun/config.json`. The command line changes that key only, and keeps every other key, in its order, and every other field of a macro.
- A file that is not valid is an error, and the command line never overwrites it. A write goes to a file next to the target, then renames it, so no program reads half a file.
- An id is unique among all the kinds. A macro without an id in the key `prompts` has the id `projet-<index>`, as in the window.
- Every command prints to the standard output and exits with the code 0, or prints one error on the standard error output and exits with the code 1. The formats are `markdown` and `json` only: a renderer such as glow makes the colors.
- The package knows nothing about Tauri and imports no other package of the repository. `desktop_tauri` imports this package. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.

## Background
- The package comes from [issue #602](https://github.com/heidrun-org/heidrun/issues/602).
- The `SKILL.md` follows the layout of [heidrun_data](../../data_layers/heidrun_data/CONTEXT.md), from [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
