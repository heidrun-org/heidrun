# heidrun_ctrl

`heidrun_ctrl` is the command line that controls the Heidrun application. A coding agent reads its [SKILL.md](skills/heidrun-ctrl/SKILL.md) and uses the commands, in the same way as the developer uses the window. The [Agent Plugin](plugin.json) packages the current macro and launcher commands for use in other repositories.

## Install the Agent Plugin

The repository's [Agent Plugin catalog](../../../.agents/plugins/marketplace.json) points to this package. In Codex, add the Heidrun repository as a marketplace, then install the Agent Plugin:

```bash
codex plugin marketplace add heidrun-org/heidrun --ref dev_jerome
codex plugin add heidrun-control@heidrun
```

The skill requires the `heidrun_ctrl` command. The installed Heidrun application places the command in `~/.local/bin` when it starts. Make sure that folder is on the shell path before using the skill.

To install only the skill through the skills CLI, use its direct GitHub folder address. The [repository skill copy](../../../.agents/skills/heidrun-ctrl/SKILL.md) lets the skills CLI find the skill from the repository root and must stay in sync with the package skill. The direct address selects the package source on the `dev_jerome` branch:

```bash
npx skills add https://github.com/heidrun-org/heidrun/tree/dev_jerome/packages/auxiliary/heidrun_ctrl/skills/heidrun-ctrl
```

The skills.sh listing is based on installs made through the skills CLI. Its public listing may appear after people install the skill; the direct address works without waiting for a listing.

## Commands

There are two groups of commands, `macros` and `launchers`, and each group has the four commands list, add, update, and delete.

The group `macros`: a macro is a reusable text that the developer writes into a pane. The commands never write a macro into a pane.

```bash
pnpm --silent heidrun_ctrl macros list
pnpm --silent heidrun_ctrl macros add --label "Run the tests" --text "Run the tests first."
pnpm --silent heidrun_ctrl macros update <id> --text "Run the tests, then the linter."
pnpm --silent heidrun_ctrl macros delete <id>
```

The group `launchers`: a launcher is one item of the Launchers sidebar section, a command line that Heidrun runs in its own tab. The commands never run a launcher.

```bash
pnpm --silent heidrun_ctrl launchers list
pnpm --silent heidrun_ctrl launchers add --label "Run the tests" --command "pnpm test"
pnpm --silent heidrun_ctrl launchers update <id> --command "pnpm run test:unit" --cwd web
pnpm --silent heidrun_ctrl launchers delete <id>
```

The output is Markdown, or JSON with `--format json`. For colors, send the Markdown to [glow](https://github.com/charmbracelet/glow): `pnpm --silent heidrun_ctrl macros list | glow`.

The command line changes files, and the running Heidrun shows each change in its window within about one second:

- The personal macros are in the file `macros.json` in the folder of the variable `HEIDRUN_DIR`, else in `~/.config/heidrun`.
- The project macros are in the key `prompts` of the file `.heidrun/config.json` of the project.
- The hard-coded macros are in the source code of Heidrun. They are listed, and they cannot be changed.
- The launchers are in the key `launchers` of the file `.heidrun/config.json` of the project. A launcher of the kind Coding agent is listed and its field `agent` stays as it is, but the command line cannot add one.

Run `pnpm --silent heidrun_ctrl --help` for every option. Run `pnpm --filter heidrun_ctrl test` to test the package. The rules of the package are in [CONTEXT.md](CONTEXT.md).
