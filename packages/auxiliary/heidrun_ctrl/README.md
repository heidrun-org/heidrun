# heidrun_ctrl

`heidrun_ctrl` is the command line that controls the Heidrun application. A coding agent reads its [SKILL.md](skills/heidrun_ctrl/SKILL.md) and uses the commands, in the same way as the developer uses the window.

The first group of commands is `macros`. A macro is a reusable text that the developer writes into a pane. The commands list, add, update, and delete the macros, and they never write a macro into a pane.

```bash
pnpm --silent heidrun_ctrl macros list
pnpm --silent heidrun_ctrl macros add --label "Run the tests" --text "Run the tests first."
pnpm --silent heidrun_ctrl macros update <id> --text "Run the tests, then the linter."
pnpm --silent heidrun_ctrl macros delete <id>
```

The output is Markdown, or JSON with `--format json`. For colors, send the Markdown to [glow](https://github.com/charmbracelet/glow): `pnpm --silent heidrun_ctrl macros list | glow`.

The command line changes files, and the running Heidrun shows each change in its window within about one second:

- The personal macros are in the file `macros.json` in the folder of the variable `HEIDRUN_DIR`, else in `~/.config/heidrun`.
- The project macros are in the key `prompts` of the file `.heidrun/config.json` of the project.
- The hard-coded macros are in the source code of Heidrun. They are listed, and they cannot be changed.

Run `pnpm --silent heidrun_ctrl --help` for every option. Run `pnpm --filter heidrun_ctrl test` to test the package. The rules of the package are in [CONTEXT.md](CONTEXT.md).
