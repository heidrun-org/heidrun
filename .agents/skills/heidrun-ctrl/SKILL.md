---
name: heidrun-ctrl
description: Control the Heidrun application from the command line heidrun_ctrl. Use it to list, add, update, or delete the macros of the developer, the reusable texts that Heidrun writes into a pane, the hard-coded macros of Heidrun included, and to list, add, update, or delete the launchers of a project, the command lines that Heidrun runs in their own tab. Use the workspaces group to list, open, rename, focus, or close workspaces through Herdr. A running Heidrun shows each change in its window within about one second.
compatibility: macOS with Heidrun installed and heidrun_ctrl available on the shell path.
---

# heidrun_ctrl

`heidrun_ctrl` is the command line that controls the Heidrun application. The groups `macros` and `launchers` have the commands `list`, `add`, `update`, and `delete`. The group `workspaces` has `list`, `open`, `rename`, `focus`, and `close`.

- A macro is a reusable text that the developer writes into a pane with one click. The commands create, read, change, and remove macros. They do not write a macro into a pane.
- A launcher is one item of the Launchers sidebar section: a command line that Heidrun runs in its own tab when the developer clicks its button "Run". The commands create, read, change, and remove launchers. They do not run a launcher. A launcher is not a macro.

The groups `macros` and `launchers` change files and work while Heidrun is closed. The group `workspaces` talks only to Herdr through the `herdr` executable. Start Heidrun first to see workspace changes in its window. No workspace command starts a server.

Before using a command, check that `heidrun_ctrl --help` works. The installed Heidrun application places `heidrun_ctrl` in `~/.local/bin` when the application starts. If the command is not found, ask the developer to install Heidrun and make `~/.local/bin` available on the shell path.

## The macros

### The three kinds of macro

| Kind | Where it is kept | What you can do |
| --- | --- | --- |
| `hard_coded` | In the source code of Heidrun. | List it only. `add`, `update`, and `delete` refuse it. |
| `personal` | The file `macros.json` in the folder of the variable `HEIDRUN_DIR`, or else in `~/.config/heidrun`. It belongs to the developer, for every project. | List, add, update, delete. |
| `project` | The key `prompts` of the file `.heidrun/config.json` of the project. The file is shared with the other developers of the project. | List, add, update, delete. |

A macro has the fields `id`, `label` (the title shown in the window), `description` (one short line under the title, it may be empty), and `text`. A text can hold the variables `{workspace}`, `{onglet}`, `{agent}`, `{branche}`, `{selection}`, and `{presse-papiers}`. Heidrun replaces them when the developer uses the macro, so write them as they are.

### The commands of the group macros

Give `--format json` when a program reads the output. The default format is Markdown.

1. **See the macros, and their ids.** Do this first: every other command needs an id.
   ```bash
   heidrun_ctrl macros list --format json
   ```
   The list has the hard-coded macros, then the personal macros, then the project macros. Each macro has the fields `id`, `label`, `description`, `text`, `kind`, and `file`. `--kind personal` lists one kind only. The command reads the project of the current folder, or of the folder of `--folder`.
2. **Add a macro.** The kind is `personal` unless `--kind project` is given. The command prints the new macro with its new id.
   ```bash
   heidrun_ctrl macros add --label "Run the tests" --text "Run the tests first." --format json
   ```
   Without `--label`, the title is the first 40 characters of the text. Without `--id`, the id is made from the title. A text on several lines, or a text with quotes, goes through the standard input with `--text -`. One new line at the end is removed.
   ```bash
   printf 'Review the branch.\nList the risks.' | heidrun_ctrl macros add --kind project --label Review --text - --format json
   ```
3. **Update a macro.** Give the id, and only the fields to change. The other fields stay as they are.
   ```bash
   heidrun_ctrl macros update <id> --text "Run the tests, then the linter." --format json
   ```
4. **Delete a macro.**
   ```bash
   heidrun_ctrl macros delete <id> --format json
   ```

When an id exists in two kinds, `update` and `delete` stop and ask for `--kind personal` or `--kind project`.

## The launchers

The launchers of a project are the key `launchers` of the file `.heidrun/config.json` of the project. There is no personal file of launchers and no hard-coded launcher, so the commands have no `--kind`. A launcher has the fields `id`, `label` (the name shown in the window), `command` (the command line), `description` (a text on several lines), `cwd` (a folder relative to the root of the project), and `agent`. A field that the launcher does not have is `null` in the JSON output. The field `agent` is present only for a launcher of the kind Coding agent, which the developer makes in the window: its `command` is generated from its `agent`.

1. **See the launchers, and their ids.** Do this first: every other command needs an id. The command reads the project of the current folder, or of the folder of `--folder`.
   ```bash
   heidrun_ctrl launchers list --format json
   ```
2. **Add a launcher.** The command prints the new launcher with its new id.
   ```bash
   heidrun_ctrl launchers add --label "Run the tests" --command "pnpm test" --cwd web --format json
   ```
   Without `--label`, the name is the first 20 characters of the command line. Without `--id`, the id is made from the name, then a dash and four characters. `--description` and `--cwd` are optional. A command line on several lines, or with quotes, goes through the standard input with `--command -`. One new line at the end is removed.
   ```bash
   printf 'cd web\npnpm test' | heidrun_ctrl launchers add --label "Web tests" --command - --format json
   ```
3. **Update a launcher.** Give the id, and only the fields to change. The other fields stay as they are. An empty `--description` or an empty `--cwd` removes the field, and an empty `--label` takes the first 20 characters of the command line.
   ```bash
   heidrun_ctrl launchers update <id> --command "pnpm run test:unit" --format json
   ```
4. **Delete a launcher.** It does not close the tab where the launcher runs.
   ```bash
   heidrun_ctrl launchers delete <id> --format json
   ```

The command `launchers add` makes only a launcher with a command line, never a launcher of the kind Coding agent. The command `launchers update` keeps the field `agent` of a launcher of the kind Coding agent as it is, and refuses `--command` for it, because its command line is made from its `agent`: change its name, description, or folder, or ask the developer to change it in the window. A file written before the rename of "action" to "launcher" can hold the old key `actions`: the commands read it, and write the key `launchers` in its place.

## The workspaces

Choose the right session before changing a workspace. `--session` overrides the inherited connection. Without `--session`, the commands use `HERDR_SOCKET_PATH` or `HERDR_SESSION` when set, otherwise the installed session `heidrun`. Main-checkout development uses `heidrun_development`; a temporary worktree uses `heidrun_` followed by the cleaned worktree name (at most its last 32 characters). Session names and workspace ids belong together. An id from another session does not identify the same workspace.

These commands require `herdr` on the shell path and a running Herdr session. They do not talk directly to Heidrun. Use the following examples with the session of the intended Heidrun window:

1. **List workspaces and copy an id.** JSON output is an array of workspace objects with all fields supplied by Herdr, including `workspace_id`, `label`, `active_tab_id`, and optional `tokens`.
   ```bash
   heidrun_ctrl workspaces list --session <session> --json
   ```
2. **Open a workspace.** `--cwd` is required. Relative folders are resolved from the current folder; `~` and `~/` are accepted. The folder must exist. `--label` is optional and defaults to the folder name. The workspace is selected and starts with the shell that Herdr creates. The command does not start a coding agent. JSON output is the opened workspace, including its id.
   ```bash
   heidrun_ctrl workspaces open --session <session> --cwd <folder> --label Project --json
   ```
3. **Rename a workspace.** `--label` is required and cannot be empty.
   ```bash
   heidrun_ctrl workspaces rename <id> --session <session> --label Renamed --json
   ```
4. **Focus a workspace.** This selects the existing workspace in the running window, including when Herdr already considers that workspace focused.
   ```bash
   heidrun_ctrl workspaces focus <id> --session <session> --json
   ```
5. **Close a workspace.** Closing stops every process in the workspace. A workspace containing a coding agent is refused unless `--force` is supplied. Inspect the workspace before using `--force`. JSON output is an object with the field `closed`, containing the closed workspace.
   ```bash
   heidrun_ctrl workspaces close <id> --session <session> --json
   ```

`open` publishes the fixed creation folder in the Herdr token `heidrun_workspace_folder`. Running Heidrun saves that folder once. `open` and `focus` publish a distinct `heidrun_focus_request` token so the window receives a selection request even when Herdr's focus is unchanged. These tokens do not move a saved workspace folder. Keep Heidrun running when opening a workspace so the folder is saved before Herdr metadata expires. If opening succeeds but publishing metadata fails, the error names the workspace id; inspect `workspaces list` instead of opening another workspace.

The format options are `--format markdown|json` and `--json`, as for the other groups. Workspace errors are always one JSON object on standard error with exit code 1. Success uses standard output and exit code 0. No `add` or `delete` command exists for workspaces.

## Errors

A command that fails exits with the code 1, prints one JSON object on one line on the standard error output, with the field `error`, and changes no file. The errors that you can fix:

- The macro is hard-coded: choose another macro, or add a personal macro with the text that you want.
- No macro has the id: run `macros list` again and copy the id.
- Herdr is not running: start the intended Heidrun window and check the session.
- No workspace has the id: run `workspaces list` in the same session and copy the id.
- No launcher has the id: run `launchers list` again and copy the id.
- The text is empty: a macro always has a text. The command line is empty: a launcher always has a command line.
- The launcher is of the kind Coding agent and `--command` is given: leave `--command` out.
- A file is not valid: the message gives its path and the mistake. `heidrun_ctrl` never overwrites such a file, so the developer can repair it.

## For a person

The default Markdown output is for a person, or for a renderer. `heidrun_ctrl macros list | glow` and `heidrun_ctrl launchers list | glow` show it with colors. There is no format with colors in `heidrun_ctrl`.
