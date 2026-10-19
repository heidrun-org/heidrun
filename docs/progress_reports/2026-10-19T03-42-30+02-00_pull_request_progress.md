# Progress report: Friday, 16 October to Monday, 19 October 2026

- Created: 19 October 2026
- Last updated: 19 October 2026
- Status: Progress report of major pull-request changes
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 715](https://github.com/heidrun-org/heidrun/issues/715)

**Generated:** 19 October 2026 at 03:42:30 Europe/Paris (UTC+02:00; `2026-10-19T01:42:30Z`).

**Reporting period:** 16 October 2026 at 00:00 Europe/Paris (`2026-10-15T22:00:00Z`) through 19 October 2026 at 03:42:30 Europe/Paris (`2026-10-19T01:42:30Z`).

**Pull requests:** GitHub showed 73 pull requests authored by `jeromeetienne` in this period; all 73 were merged at the time of the check.

This report groups the major changes by feature and leaves out routine fixes and smaller documentation changes.

## Data history and statistics

You built out Heidrun's data history and analytics. The `heidrun_data` command line tool gained commands to initialize, update, and query stored history, followed by schema and read commands ([#565](https://github.com/heidrun-org/heidrun/pull/565), [#566](https://github.com/heidrun-org/heidrun/pull/566)). The Past chats sidebar section and Statistics window now get their data through the data layer packages ([#630](https://github.com/heidrun-org/heidrun/pull/630)). Public operations of those packages are recorded with start and completion events, secret redaction, log rotation, and replay support ([#632](https://github.com/heidrun-org/heidrun/pull/632)).

The coding agents data layer now stores token usage by minute and model price, with estimated costs available in SQL ([#624](https://github.com/heidrun-org/heidrun/pull/624)). The Statistics window gained multi-workspace and AI-cost choices ([#563](https://github.com/heidrun-org/heidrun/pull/563)), a choice between Git activity measures ([#625](https://github.com/heidrun-org/heidrun/pull/625)), a clearer full-screen layout with a remembered chart filter ([#633](https://github.com/heidrun-org/heidrun/pull/633)), and remembered selections with an activity chart that fits its highest bar ([#710](https://github.com/heidrun-org/heidrun/pull/710)).

## Local AI and easier input

You added a local embeddings package for text and source code. It splits documents into structural chunks, reuses cached model files, and supports optional hardware acceleration ([#634](https://github.com/heidrun-org/heidrun/pull/634)).

The composition bar lets a person drop or choose images, add text, and send both to the focused pane ([#665](https://github.com/heidrun-org/heidrun/pull/665)). It also supports optional push-to-talk transcription with a local Whisper model; recorded sound stays on the computer ([#668](https://github.com/heidrun-org/heidrun/pull/668)).

## Heidrun Mobile

Heidrun Mobile gained access through a fixed-address tunnel and QR code ([#550](https://github.com/heidrun-org/heidrun/pull/550)), followed by launchers, microphone and macro controls, guarded plain terminals, and notifications ([#599](https://github.com/heidrun-org/heidrun/pull/599)).

## Coding agent support and tools

You added Antigravity alongside Claude Code and Codex, including the ability to start it in a tab and show quota information when available ([#697](https://github.com/heidrun-org/heidrun/pull/697)). Heidrun can detect installed coding agents and enable them in Settings ([#699](https://github.com/heidrun-org/heidrun/pull/699)).

The `heidrun_ctrl` command line tool now manages personal macros and project launchers ([#604](https://github.com/heidrun-org/heidrun/pull/604), [#659](https://github.com/heidrun-org/heidrun/pull/659)). Heidrun's control and data tools are packaged as Agent Plugins ([#686](https://github.com/heidrun-org/heidrun/pull/686), [#696](https://github.com/heidrun-org/heidrun/pull/696)), and bundled skills and commands can be installed for coding agents ([#677](https://github.com/heidrun-org/heidrun/pull/677)). Reusable skills now cover issue fixes, bug triage, Git cleanup, and `CONTEXT.md` guidance ([#674](https://github.com/heidrun-org/heidrun/pull/674), [#667](https://github.com/heidrun-org/heidrun/pull/667), [#675](https://github.com/heidrun-org/heidrun/pull/675), [#678](https://github.com/heidrun-org/heidrun/pull/678)). The bundled command line tools are also prepared when a new worktree is created ([#695](https://github.com/heidrun-org/heidrun/pull/695)).

## Workspaces and focused work

Heidrun Development now has its own application identity, data folder, Herdr session, and mobile port, so it can run alongside installed Heidrun ([#644](https://github.com/heidrun-org/heidrun/pull/644); later identity changes in [#693](https://github.com/heidrun-org/heidrun/pull/693) and [#704](https://github.com/heidrun-org/heidrun/pull/704)). The workspace menu can browse a repository's Git worktrees and open or select the matching workspace ([#689](https://github.com/heidrun-org/heidrun/pull/689)). Zen Mode shows only the focused pane while keeping workspace and tab navigation available ([#713](https://github.com/heidrun-org/heidrun/pull/713)).

## Activity, controls, and discovery

An experiment animates Git activity by folder over time, with time controls and playback ([#628](https://github.com/heidrun-org/heidrun/pull/628)). Settings gained a section for viewing and changing project and built-in guards ([#606](https://github.com/heidrun-org/heidrun/pull/606)), and Find new skills can search skills.sh, a local folder, or GitHub and GitLab ([#614](https://github.com/heidrun-org/heidrun/pull/614)). Codex now responds correctly to Heidrun's light theme ([#651](https://github.com/heidrun-org/heidrun/pull/651)).

The main direction across this work is a stronger foundation for coding-agent history and usage, alongside more ways to work from Heidrun Mobile and manage coding agents, workspaces, and input directly in the application.
