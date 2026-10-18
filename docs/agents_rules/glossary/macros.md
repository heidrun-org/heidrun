# Glossary of Heidrun: macros

- Created: 16 October 2026
- Last updated: 18 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md)
- Related issue: [issue 602](https://github.com/heidrun-org/heidrun/issues/602), [issue 649](https://github.com/heidrun-org/heidrun/issues/649)

This document gives one short definition for each word of the macros, and of the command line that controls them. The other words of Heidrun are in [index.md](index.md).

## The macros

### Macro

A reusable text that the developer writes into a pane with one click. A macro has an id, a title, a description, and a text. There are three kinds of macro: the hard-coded macro, the personal macro, and the project macro.

### Hard-coded macro

A macro that is written in the source code of Heidrun, in `packages/auxiliary/heidrun_ctrl/src/hard_coded_macros.rs`. The window and the command line `heidrun_ctrl` list it, and nothing can add, change, or delete it.

### Personal macro

A macro that the developer made, and that is kept for this computer, for every project, in the personal macro file.

### Personal macro file

The file `macros.json` in the folder of the variable `HEIDRUN_DIR`, or else in `~/.config/heidrun`. It is a JSON list of macros. The window and the command line `heidrun_ctrl` both read and write it.

### Project macro

A macro that the developer made, and that is kept in the key `prompts` of the file `.heidrun/config.json` of a project. The file is shared with the other developers of the project, and the key keeps the old name of the feature.

## The command line

### heidrun_ctrl

The command line that controls the Heidrun application, for a coding agent. Its `SKILL.md` teaches a coding agent the commands. It has two groups of commands, `macros` and `launchers`, and each group has the four commands list, add, update, and delete. It changes files, and a running Heidrun shows each change in its window within about one second.

## Rules

- Write "hard-coded macro", "personal macro", and "project macro". Do not write "default macro", "built-in macro", or "user macro".
- Write `heidrun_ctrl` in full. Do not write a shorter name for it.
- The word "macro" means only a text that is written into a pane. A launcher is not a macro.
