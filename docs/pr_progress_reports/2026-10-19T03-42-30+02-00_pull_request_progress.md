# Progress report: Friday, 16 October to Monday, 19 October 2026

- Created: 19 October 2026
- Last updated: 19 October 2026
- Status: Progress report of major pull-request changes
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 715](https://github.com/heidrun-org/heidrun/issues/715)

**Generated:** 19 October 2026 at 03:42:30 Europe/Paris (UTC+02:00; `2026-10-19T01:42:30Z`).

**Reporting period:** 16 October 2026 at 00:00 Europe/Paris (`2026-10-15T22:00:00Z`) through 19 October 2026 at 03:42:30 Europe/Paris (`2026-10-19T01:42:30Z`).

**Pull requests:** Within the reporting period, 73 pull requests were identified for the `jeromeetienne` account, and all had been merged at the time of the check.

This report groups the major changes by feature and leaves out routine fixes and smaller documentation changes.

## Data history and statistics

Heidrun's data history and analytics were expanded. Commands for initializing, updating, and querying stored history were added to the `heidrun_data` command line tool, followed by schema and read commands ([#565](https://github.com/heidrun-org/heidrun/pull/565), [#566](https://github.com/heidrun-org/heidrun/pull/566)). Data for the Past chats sidebar section and Statistics window was routed through the data layer packages ([#630](https://github.com/heidrun-org/heidrun/pull/630)). Start and completion events, secret redaction, log rotation, and replay support were added to operation recording for those packages ([#632](https://github.com/heidrun-org/heidrun/pull/632)).

Token usage by minute and model prices were added to the coding agents data layer, and estimated costs were made available through SQL ([#624](https://github.com/heidrun-org/heidrun/pull/624)). Choices for multiple workspaces and AI cost were added to the Statistics window ([#563](https://github.com/heidrun-org/heidrun/pull/563)), along with a choice of Git activity measure ([#625](https://github.com/heidrun-org/heidrun/pull/625)), a clearer full-screen layout with a remembered chart filter ([#633](https://github.com/heidrun-org/heidrun/pull/633)), and remembered selections with an activity chart that fits its highest bar ([#710](https://github.com/heidrun-org/heidrun/pull/710)).

## Local AI and easier input

A local embeddings package for text and source code was added. Documents are split into structural chunks, cached model files are reused, and optional hardware acceleration is supported ([#634](https://github.com/heidrun-org/heidrun/pull/634)).

Support for dropping or choosing images, adding text, and sending the combined message to the focused pane was added to the composition bar ([#665](https://github.com/heidrun-org/heidrun/pull/665)). Optional push-to-talk transcription with a local Whisper model was added; recorded sound stays on the computer ([#668](https://github.com/heidrun-org/heidrun/pull/668)).

## Heidrun Mobile

Access to Heidrun Mobile through a fixed-address tunnel and QR code was added ([#550](https://github.com/heidrun-org/heidrun/pull/550)), followed by launchers, microphone and macro controls, guarded plain terminals, and notifications ([#599](https://github.com/heidrun-org/heidrun/pull/599)).

## Coding agent support and tools

Antigravity was added alongside Claude Code and Codex, including support for starting it in a tab and showing quota information when available ([#697](https://github.com/heidrun-org/heidrun/pull/697)). Detection of installed coding agents and controls for enabling them in Settings were added ([#699](https://github.com/heidrun-org/heidrun/pull/699)).

Management of personal macros and project launchers was added to the `heidrun_ctrl` command line tool ([#604](https://github.com/heidrun-org/heidrun/pull/604), [#659](https://github.com/heidrun-org/heidrun/pull/659)). Agent Plugins were created for Heidrun's control and data tools ([#686](https://github.com/heidrun-org/heidrun/pull/686), [#696](https://github.com/heidrun-org/heidrun/pull/696)), and installation of bundled skills and commands for coding agents was added ([#677](https://github.com/heidrun-org/heidrun/pull/677)). Reusable skills were added for issue fixes, bug triage, Git cleanup, and `CONTEXT.md` guidance ([#674](https://github.com/heidrun-org/heidrun/pull/674), [#667](https://github.com/heidrun-org/heidrun/pull/667), [#675](https://github.com/heidrun-org/heidrun/pull/675), [#678](https://github.com/heidrun-org/heidrun/pull/678)). The bundled command line tools are also prepared when a new worktree is created ([#695](https://github.com/heidrun-org/heidrun/pull/695)).

## Workspaces and focused work

A separate application identity, data folder, Herdr session, and mobile port were added for Heidrun Development, allowing it to run alongside installed Heidrun ([#644](https://github.com/heidrun-org/heidrun/pull/644); later identity changes in [#693](https://github.com/heidrun-org/heidrun/pull/693) and [#704](https://github.com/heidrun-org/heidrun/pull/704)). Browsing a repository's Git worktrees and opening or selecting the matching workspace were added to the workspace menu ([#689](https://github.com/heidrun-org/heidrun/pull/689)). Zen Mode was added to show only the focused pane while keeping workspace and tab navigation available ([#713](https://github.com/heidrun-org/heidrun/pull/713)).

## Activity, controls, and discovery

An experiment for animating Git activity by folder over time was added, with time controls and playback ([#628](https://github.com/heidrun-org/heidrun/pull/628)). A section for viewing and changing project and built-in guards was added to Settings ([#606](https://github.com/heidrun-org/heidrun/pull/606)), and search across skills.sh, a local folder, GitHub, and GitLab was added to Find new skills ([#614](https://github.com/heidrun-org/heidrun/pull/614)). Codex support for Heidrun's light theme was corrected ([#651](https://github.com/heidrun-org/heidrun/pull/651)).

A stronger foundation for coding-agent history and usage was established, alongside more ways to work from Heidrun Mobile and manage coding agents, workspaces, and input directly in the application.
