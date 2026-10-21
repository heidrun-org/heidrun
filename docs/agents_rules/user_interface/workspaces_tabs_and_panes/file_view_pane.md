# User interface of Heidrun: file view pane

- Created: 21 October 2026
- Last updated: 21 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md), [Panes](panes.md), [Pane headers](pane_headers.md), [Files](../sidebars/files.md)
- Related issue: [issue 714](https://github.com/heidrun-org/heidrun/issues/714)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the rules of the file view pane: a pane that shows one file, read only.

## File view pane

A file view pane shows one file in the place where a pane normally shows a terminal ([issue 714](https://github.com/heidrun-org/heidrun/issues/714)). The developer reads the file there and cannot change it. The first step has no editing, no save button, and no button that writes a file. The Files window still edits files.

## Opening a file

A click on a file in the File explorer sidebar section opens the file in a file view pane, and no longer in the Files window.

- When the selected pane is a terminal, running or idle, a new pane opens to the right of it, in the same tab, and shows the file. The terminal stays as it was. Heidrun never replaces, hides, or stops a terminal.
- When the selected pane is a file view pane, the file replaces the file of that pane. No new pane opens.
- When no pane is selected, or when Herdr fails, the Files window opens the file, and a toast shows the error of Herdr when there is one.
- The shortcut ⌘P and a file name in a terminal keep opening the Files window.
- The new pane becomes the selected pane.

## What the file view pane shows

- The header has the name of the file, the short path of the file, and the buttons "Pin the pane", "Split right", "Split down", Zen Mode, and "Close the pane". The title of the name is the absolute path of the file. A double click on the name does not start a rename, because the label of the pane holds the file. The header has no button for the composition bar and no macro menu, and the pane has no composition bar.
- A bar under the header has these controls, in this order: the switch "Preview" and "Code" (only for a Markdown file), the check box "Wrap lines", the button "Search" (only while code is shown), the button "⧉ Path", the button "Finder", and the button "VS Code". The texts are the texts of the Files window, in the locale file `filesModal.json`, except "Search", which is in `fileView.json`.
- The switch "Preview" and "Code" saves its choice in the setting `filesMdRead`, and the check box "Wrap lines" saves its choice in the setting `codeWrap`. The Files window uses the same two settings.
- A code file is shown in the code editor, in read only mode. The key ⌘F opens the search panel of the editor in the same way as the button "Search". The editor never takes the keyboard from the pane when the file opens.
- A Markdown file is shown as rendered text, and a link of the text opens in the browser. An image is shown as a picture. A file that cannot be read shows the error in the place of the file.
- The button "⧉ Path" copies the path inside the project, and the absolute path when the developer holds the key Option.
- The file is read when the pane opens, when the file of the pane changes, and when the developer changes the switch "Preview" and "Code". The first step does not read the file again when the file changes on the disk.

## How Heidrun keeps the file view pane

A pane of Heidrun is a pane of Herdr, and Herdr sets the layout of the panes. The file view pane is therefore a Herdr pane with a terminal that only waits, and Heidrun draws the file over that terminal.

- Heidrun splits the selected pane to the right with the Herdr request `pane.split`, in the workspace folder.
- Heidrun gives the new pane the label `Heidrun file view: <absolute path of the file>` with the Herdr request `pane.rename`. The label marks the pane as a file view pane. Herdr keeps the label, so the file view pane comes back after a restart of Heidrun.
- Heidrun runs the command `echo 'Below the file view of Heidrun'; sleep 99999999` in the new pane with the command `herdr pane run`. The command prints a line for a person who looks at the pane in Herdr, and then waits for about three years, so nobody types a command into the hidden terminal. The command has no shell comment, because the shell zsh reads a comment in a typed line only when its option `interactivecomments` is on.
- A pane whose label is only a name, for example `build`, is a terminal. Every place that shows the name of a pane reads it with `paneName`, which gives the name of the file for a file view pane.
- Closing the file view pane closes the Herdr pane and ends the waiting command.

## Where the code is

- `FileViewLabel` in `lib/file_view_label.ts` writes and reads the label.
- `FileViewPanes` in `stores/file_view_panes.ts` opens a file in a file view pane.
- `FileView.vue` is the body of the pane, and `PaneCard.vue` shows it in place of the terminal.
- `CodeEditor.vue` and `lib/editor.ts` have the read only option.
- The tests are `file_view_label.test.ts`, `file_view_panes.test.ts`, `FileView.test.ts`, `PaneCard.test.ts`, and `FilesPanel.test.ts`.

## Background

- The label, the split, the command, and the waiting terminal were tested with a real Herdr server in a separate session: the label kept spaces and a colon, and the command ran in the new pane. The test never used the session of Heidrun or of Heidrun Development.
- The decision to open a new pane next to a terminal, and never to replace a terminal, comes from the developer in [issue 714](https://github.com/heidrun-org/heidrun/issues/714).
