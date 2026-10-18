# Directory Context: `/packages/auxiliary/heidrun_ctrl`

## Purpose
A Rust library and one command line tool, `heidrun_ctrl`, that control the Heidrun application for a coding agent, and the `SKILL.md` that teaches a coding agent to use it. It has two groups of commands, `macros` and `launchers`, and each group has the four commands list, add, update, and delete. The command line changes files, and the application watches them. It never talks to the running application, and it never runs a launcher.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. It exports `hard_coded_macros`, `personal_macros_path`, `read_personal_macros`, `write_personal_macros`, `read_project_macros`, `read_project_launchers`, `find_project_root`, `project_config_path`, `list_macros`, `add_macro`, `update_macro`, `delete_macro`, `list_launchers`, `add_launcher`, `update_launcher`, `delete_launcher`, `label_from_command`, the types `Macro`, `MacroKind`, `ListedMacro`, `MacroPlaces`, `NewMacro`, `MacroChanges`, `Launcher`, `NewLauncher`, and `LauncherChanges`, and the output functions `list_text`, `changed_text`, `deleted_text`, `launcher_list_text`, `launcher_changed_text`, `launcher_deleted_text`, `error_text`, and `Format`.
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
- The launchers are the key `launchers` of the file `.heidrun/config.json`: there is only the project, so the commands have no option `--kind`. The orders on the launchers change that key only, and keep every other key, in its order, and every other field of a launcher. The old key `actions` is read, and a change writes the key `launchers` in its place; a file with both keys is an error.
- A launcher of the kind Coding agent (it has the field `agent`) stays intact: `launchers update` never changes the field `agent`, and refuses `--command` for it, because its command line is made from that field. `launchers add` makes only a launcher with a command line. `launchers delete` does not close the tab where the launcher runs, because the command line never talks to the application.
- The name and the id of a new launcher follow the window: the name is the first 20 characters of the command line on one line, and the id is the name in lower case with dashes, then a dash and four characters (`stores/project.ts` in `web_frontend`). The file `src/project_config_file.rs` reads and writes the whole file; the keys are in `src/project_macros.rs` and `src/project_launchers.rs`.
- A file that is not valid is an error, and the command line never overwrites it. A write goes to a file next to the target, then renames it, so no program reads half a file.
- An id is unique among all the kinds. A macro without an id in the key `prompts` has the id `projet-<index>`, as in the window.
- Every command prints to the standard output and exits with the code 0, or prints one error on the standard error output and exits with the code 1. The formats are `markdown` and `json` only: a renderer such as glow makes the colors.
- The package knows nothing about Tauri and imports no other package of the repository. `desktop_tauri` imports this package. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.

## Background
- The package comes from [issue #602](https://github.com/heidrun-org/heidrun/issues/602). The group `launchers` comes from [issue #649](https://github.com/heidrun-org/heidrun/issues/649).
- The `SKILL.md` follows the layout of [heidrun_data](../../data_layers/heidrun_data/CONTEXT.md), from [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
