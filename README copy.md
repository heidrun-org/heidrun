# Heidrun

A macOS graphical interface for [Herdr](https://herdr.dev): the agents and terminals of your Herdr session, in one work window.

- **Sidebar**: workspaces, panes, then the "To handle" queue (blocked or finished agents) at the bottom, so the list does not shift.
- **Real terminals**: each pane is displayed with `herdr terminal attach`, so the rendering is identical to Herdr (Claude Code TUI, Codex, colors…).
- **Prompt templates**: an icon in each pane header opens a menu of templates; a click writes the template into the terminal of the pane.
- **Inspector**: Allow / Deny, agent context, "Ask an agent to fix", pattern watching.
- **Status bar**: Claude quotas (5 h, week) and Codex.
- **⌘K palette** for all actions.
- Terminal font of your choice (Geist Mono, SF Mono, JetBrains Mono, Fira Code, Menlo, Monaco), set in the Settings window (gear button in the top bar).

## Shortcuts

In the app: **⌘/** (or the **?** button at the top) shows this list, with a filter.

<!-- shortcuts:start -->
<!-- Generated from packages/apps/web_frontend/src/lib/shortcuts.json: pnpm docs:shortcuts -->

| Shortcut | Action |
| --- | --- |
| **Windows** | |
| ⌘K | Command palette |
| ⌘/ | This list of shortcuts |
| ⌘P | Open a project file (search by name) |
| ⇧⌘F | Search the output of all terminals |
| ⇧⌘H | History: agent jobs, time and cost per project, CSV export |
| ⇧⌘P | Pin the selected text in a note |
| Esc | Close the open window |
| **Terminals and agents** | |
| ⌘T | New terminal (new tab) |
| ⇧⌘T | New agent (Claude, Codex, project agents) |
| ⌘D / ⇧⌘D | Split the pane to the right / to the bottom |
| ⌘W ⌘W | Close the selected pane (twice, to avoid accidents) |
| **Navigation** | |
| ⌥⌘← / ⌥⌘→ | Previous / next tab |
| ⌥⌘↑ / ⌥⌘↓ | Previous / next workspace |
| ⌘1 … ⌘9 | Go to workspace 1 to 9 (sidebar order) |
| ⇧⌥⌘← / ⇧⌥⌘→ | Move the tab left / right |
| ⇧⌥⌘↑ / ⇧⌥⌘↓ | Move the workspace up / down |
| **Input** | |
| ⇧↵ / ⌥↵ | New line in the terminal |
| ⌘↵ | Launch (New agent window) |
| ↑ / ↓ then ↵ | Choose a result (palette, search) then confirm |
| **File explorer and editor** | |
| ⇧⌘F | Search the whole project (explorer open) |
| ⌘S | Save the file |
| ⌘F / ⌘⌥F | Search / replace in the file |
| ⌘D | Select the next occurrence (multiple cursors) |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌘W | Close the tab (confirmation if not saved) |
| Right click | New file or folder, rename / move, Trash |
| **Display** | |
| ⌘B / ⌥⌘B | Hide the left sidebar / the right panel |
| ⌘+ / ⌘− / ⌘0 | Increase / decrease / reset the font (the code in the Git and Preview windows) |
| **Mouse** | |
| ⌘-click | On #12 / !34: preview of the issue or merge request; on a URL or a commit: open it |
| ⌘-click | On src/app.ts:42 quoted in a terminal: the file at that line, in the explorer |
| Hover | Action buttons: ↗ Open, ⧉ Preview, ▷ Launch, ▷ Run, ▷ View <agent> |
| Wheel | Scroll the pane history |
| ⌥ + wheel | Send ↑ / ↓ (last commands or prompts) |
| ⌥ + drag | Select text, even in "Mouse for the app" mode |
| Double-click | Rename a workspace, a tab or a pane |
| Drag and drop | Reorder workspaces and tabs |
| <img src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/pin.svg" alt="pin" width="14"> | Keep an agent alongside, visible whatever the tab |
| <img src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/grid-3x3-gap.svg" alt="grid-3x3-gap" width="14"> | Tiles of a Claude session: what each sub-agent is doing |
| Double-click on a border | Return to the default width |

<!-- shortcuts:end -->

**Gauges**: green up to 60%, orange from 60 to 80%, red above (context, 5 h session, week). The last known values stay displayed between two replies.

**Mouse wheel**: scrolls the pane history (go back up in an agent's conversation). **⌥ + wheel** sends ↑/↓ instead, to browse the last commands or prompts.

**Copying text**: by default, dragging selects and **⌘C** copies (⌘V pastes). In the "A" menu of the top bar, the "Mouse for the app" option sends the wheel and the clicks to Herdr and the agents; in this mode, **⌥ + drag** still selects.

**Pinned notes**: select text in a terminal, then "Pin" (or ⇧⌘P). The note appears in the **Notes** tab of the right panel, with its origin; you can rename it (double-click), copy it or send it to an agent. The ⤢ button (or a double-click on the text) opens it in a central window that you can move by its title, resize by the bottom-right corner and edit; its size is remembered. Notes stay on this Mac, never in the repo: a terminal output can contain secrets.

**Scripts**: the **Scripts** tab of the right panel shows the scripts of the current workspace, in two sections that can be folded: **Custom Scripts**, the commands that you create with the plus button on the line of the heading (`make dev`, `npm install`, `ngrok http 3000`…); the window that opens asks for an optional name and for the command line, and a script without a name takes the first 20 characters of its command line as its name, and **Existing Scripts**, the scripts that already exist in the project. One click on a custom script opens a Herdr tab with its name and runs the command; the button shows "running" while it runs, and a second click brings you back to its tab. Custom scripts are saved under the key `actions` in `.heidrun/config.json` at the root of the repo, to be versioned with the code. The file is validated with a Zod schema (`packages/apps/web_frontend/src/lib/project_config.ts`) each time it is loaded or saved; an unknown or wrong field shows an error that names the field, and nothing is written:

```json
{
  "version": 1,
  "actions": [
    { "id": "dev", "label": "make dev", "command": "make dev" },
    { "id": "tunnel", "label": "ngrok", "command": "ngrok http 3000" },
    { "id": "front", "label": "front", "command": "npm run dev", "cwd": "web" }
  ]
}
```

The `package.json` scripts, the `Makefile` targets, the `Procfile` and a few Flutter, Cargo or Symfony commands are listed in **Existing Scripts**. Recently run commands appear in **Recent**, between the two sections; the history stays on this Mac. Notes can be reordered by drag and drop.

**Colored references**: in the terminals, issues (`#12`), merge requests and pull requests (`!34`, `MR !34`, `PR #5`, `group/app#7`) and commits (`abc1234`) are colored; **⌘-click** on an issue, an MR or a PR opens it in an app window (description and comments rendered as Markdown, Centered / Full width, ⌘+/− for the size, "Open on GitLab/GitHub ↗"); on hover, "↗ Open" opens it in the browser and "⧉ Preview" in the app. Commits open on GitLab or GitHub, based on the `git remote` of the pane folder (URLs also open with ⌘-click). The text sent by the agent is not modified: the color is drawn on top. Optional settings in `.heidrun/config.json`:

```json
"references": {
  "forge": "gitlab",
  "repo": "https://gitlab.example.com/group/app",
  "tickets": { "url": "https://acme.atlassian.net/browse/{key}", "prefixes": ["ABC", "OPS"] },
  "enabled": true
}
```

`forge` forces GitHub or GitLab (an unknown host is treated as a self-hosted GitLab), `repo` replaces the remote, `tickets` enables tickets of the `ABC-123` type (disabled without a URL).

**Hover actions**: in a terminal, hovering a reference shows "↗ Open"; a Claude Code command quoted by the agent (`/finish-task`, `/compact`…) shows "▷ Launch"; and an item of a numbered list ("1. Open an issue…") shows "▷ Do item 1", which sends the instruction to the agent. A command proposed by Claude in shell mode (`! docker builder prune -af && …`) shows "▷ Run": it is put back on a single line if it spans several (line break, `\`, `&&`, `|`), then sent into the Claude input area with Enter. It also works for a command quoted in a sentence ("Then run ! scripts/check.sh."), if it starts with a path or a known tool (`git`, `npm`, `docker`…). ⌘-click on the text does the same. Only commands that really exist are offered (built-in, `~/.claude/commands`, the project `.claude/commands`, skills and plugins), never a path like `/tmp`.

**Claude agents**: the list displayed under the input area (`● main`, `○ jerome-645 …`) is clickable: "▷ View jerome-645" sends Claude ↓ down to the line then Enter, as if you went there with the arrow keys. Clicking `main` brings you back to the main conversation.

**Right panel**: at the top, the **Session** of the selected pane (workspace · tab, state, context, cost, Remote Control); below, **All agents**: quotas of the Claude and Codex account, shared by all sessions, and the **Activity** feed (workspace · tab, then the agent; click to go there).

**Finished** items (Activity feed, finished "To handle" cards) disappear by themselves after 15 min by default; the delay is set in the "A" menu (5 min, 15 min, 1 h, never). Blocked agents stay displayed.

**Answering the menus of a blocked agent**: when Claude (or Codex) displays a numbered menu ("1. Yes / 2. Yes, and don't ask again… / 3. No"), its options appear as buttons on the "To handle" card and in the right panel, with the command or file concerned. One click sends the option number. If the same menu is still there a moment later, the app uses the arrow keys and Enter; it never acts on a new dialog without you seeing it.

**Safeguards**: before sending a command with one click ("▷ Run" on a `!`, actions, template with Shift+click, palette, "Yes" answer to a permission menu), the app compares it to a list of dangerous patterns (`rm -rf`, `prune -af`, `push --force`, `reset --hard`, `DROP TABLE`, `DELETE` without `WHERE`, MR merge, actions on production…). On a match, a window shows the full command and asks for confirmation; "Cancel" is selected by default. Project rules in `.heidrun/config.json`:

```json
"guards": {
  "confirm": ["deploy", "make release"],
  "block": ["make prod-reset"]
}
```

`block` prevents sending from the app. If the file is unreadable, all commands ask for confirmation.

**Git tab** (right panel): for the selected workspace, branch, ahead / behind the remote, modified files, last commit, CI state of the branch, and the list of open **MRs (GitLab) or PRs (GitHub)** with their state (ready, CI running, to approve, conflict…). One click opens the MR; "Ask for a review" sends it to the agent of the workspace. The host is deduced from the remote (`references.forge` to force it). The app uses the `glab` and `gh` already logged in on the Mac, read-only: no token is stored. In the sidebar, `↑2` signals commits not pushed yet.

**Prompt templates**: the template icon in a pane header opens a menu with the title and the description of each template, yours and those of the project. A click writes the text into the terminal of that pane, without pressing Enter; Shift+click writes it and presses Enter. "Edit templates…" opens a window to create (New), change (Save, Discard) or delete a template, on this Mac or in the project. They are also in the ⌘K palette (Prompts section). Variables replaced on insertion: `{workspace}`, `{tab}`, `{agent}`, `{branch}`, `{selection}` (text selected in a terminal), `{clipboard}`. Project templates in `.heidrun/config.json`:

```json
"prompts": [{ "id": "review", "label": "MR review", "text": "Review the MR of {branch}" }]
```

**New agent** (⇧⌘T, button in the tab bar, ⌘K palette): choose Claude Code or Codex, a project agent (`.claude/agents/*.md`, with its description and model) or one from `~/.claude/agents`, or a free agent; a model (`opus`, `sonnet`…); a starting prompt, possibly taken from a template. The app creates a tab named after the agent, runs `claude --agent … --model …` and sends the prompt as soon as the agent is ready (if Claude first asks to trust the folder, it waits for your answer). If the prompt could not be sent, it is written into the terminal of the selected pane.

**Global search** (⇧⌘F): searches what all terminals have displayed (the last 3,000 lines of each pane), ignoring case and accents. Results are grouped by workspace · tab, most recent first, with the line before and after. Filters: this workspace, agents only, regular expression (`.*`). ↵ or a click opens the pane and selects the text if it is still on screen.

**Open alongside**: the <img src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/pin.svg" alt="pin" width="14"> button in a pane header, on a "To handle" card or in the ⌘K palette keeps the agent in a column to the right of the current tab, whatever its workspace: the first one splits the screen in two, the following ones stack in the column (4 at most). Each cell is a real terminal: a click gives it the keyboard (and makes it the pane that receives the ⌘K palette insertions), ↗ opens its tab, × removes it from the column without stopping the agent. The column is resized by its border and is remembered; an agent of the displayed tab does not appear in it (it is already in the grid).


**History** (⇧⌘H, or the "Today … History ↗" line of the right panel): each job of an agent appears live while it runs ("running"), then is saved at the end on this Mac (`~/.config/heidrun/history.jsonl`, never in a repo) with its workspace, its tab, the branch, the prompt that started it, its active time (without the waits for your decision) and its cost. At the top, summary cards follow the filters: agent cost (with day, 7 d, 30 d and the difference with the previous period), agent time, estimated human time (1 h of agent ≈ 4 h of developer by default), your estimated time (prompts written, decisions), the leverage between the two, the time agents waited for you and the rework rate (jobs followed within the hour by a correction prompt). The assumptions are set with "⚙ Assumptions". On the left: totals per workspace or **per feature** (branch, with the issue or MR taken from its name), **productive hours** (work and waiting per hour of the day), and **monthly budgets** per workspace (notification at 80% then at 100%). The window opens on today and filters by period (today to 1 year), workspace, agent or text, gives totals per workspace and a chart per day, and exports the selection as CSV (in Downloads, readable by Excel). A click on a job opens its pane if it still exists.

**Consumption per workspace** (in the History window): cost of each workspace over the current 5 h window, with its share of the total, a small chart per quarter of an hour and, on hover, the detail per agent. The app records the cost increase of each Claude session (status line) and attaches it to the workspace of the pane; the share of the 5 h quota is an estimate proportional to the cost. Only spending seen while the app is running is counted.

**Tiles** (<img src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/grid-3x3-gap.svg" alt="grid-3x3-gap" width="14"> in the header of a Claude pane): one cell per agent of the session (main and sub-agents), with its last lines, read from the Claude logs (`~/.claude/projects/…`), so without touching the terminal. Refreshed every 2 to 3 s; a green dot marks an active agent. A click on a cell displays this agent in the terminal.

**Project files** (folder icon next to "Folder" in the panel, or ⌘P): the tree of the project of the pane, as in VS Code, with the git state of each file (modified, new, deleted; a dot on folders that contain some) and the files of `.gitignore` hidden ("Ignored files" to see them). ⌘P searches a file by its name ("comp/term" finds `src/components/TerminalView.vue`). The file is displayed colored, Markdown rendered or as code, images as a preview, with tabs (⌘W to close one), breadcrumb, "Path" (⌥: absolute path), Finder, VS Code and "→ Agent", which writes `@path` in the terminal of the selected pane. Select lines: "Explain" or "Fix these lines" prepares the prompt. In the terminals, `src/app.ts:42` quoted by an agent opens the file at the line (hover or ⌘-click).

**Editing a file**: "✎ Edit" in the explorer opens a real editor (CodeMirror: highlighting, multiple cursors, ⌘F / ⌘⌥F search-replace, ⌘D next occurrence, ⌘Z). **⌘S** saves; a dot in the tab signals an unsaved change, and closing the tab or the window asks for confirmation. "Diff" shows your changes, "Diff before ⌘S" shows them before each save. If an agent modifies the file while you edit it, nothing is overwritten: if you made no change the file is reloaded, otherwise a banner offers to see the difference, to reload or to overwrite with your version. Saving is atomic, keeps the permissions of the file, and refuses `.git`, symbolic links and files that are not UTF-8.

**Searching the project** ("Search" tab of the explorer, or ⇧⌘F when it is open): text or regular expression (`.*`), case sensitive or not (`Aa`), in all the files of the project except `.gitignore`; results grouped by file, a click opens the file at the line. **Create, rename, delete**: "+ File", "+ Folder", or right-click on a file or folder (new file here, rename / move by changing the path, copy the path, move to the Trash — never a permanent deletion). **Git diff**: the changes of the open file since the last commit.

**Mobile access (iPhone, iPad)** — phone button at the top, or ⌘K "Mobile access": from the phone, see what needs handling, answer permission menus, send a prompt, deny or interrupt, read the end of an agent's output. Disabled by default.

1. Install **Tailscale** on the Mac and on the iPhone / iPad (same account: Google, Apple, Microsoft or GitHub).
2. Enable mobile access in Heidrun (macOS may ask to allow incoming connections: Allow).
3. Scan the QR code with the camera, open the link in Safari, then Share → "Add to Home Screen".

Security: the server listens only on the Tailscale address of the Mac (100.x), never on the Internet or the Wi-Fi; each request carries the pairing key (64 characters, in `~/.config/heidrun/mobile.json`, readable by you only); "Revoke" changes the key and immediately cuts off the paired devices. Only five actions exist (state, reading, answer to a menu, prompt, deny / interrupt); a dangerous command is shown in full on the phone and asks for confirmation, and what the project blocks stays blocked. Heidrun must be open on the Mac.


**Notifications** ("A" menu): reminder when an agent stays blocked (5 min by default), agent context above 80%, Claude quota above 80% then 95%, summary of the day at the chosen time (finished jobs per workspace), quiet hours without notification (e.g. 20:00 → 08:00, alerts postponed until after).

**Agent questions**: when an agent ends its reply with a question ("Do you want me to tackle #44?"), the app spots it, even if the tab is not displayed. A purple **QUESTION** card appears in "To handle", with the question, and a notification "… asks you a question" replaces "finished". The card stays until you answer or until you close it. **Blocked** agents (permission menu) are in red.

A "To handle" card closed with × stays closed, even after an app restart, until the next state change of the agent.

**Resizing**: drag the border of the left bar or of the right panel; the central area adjusts. Double-click on the border to return to the default width. The widths are remembered.

**Renaming**: double-click on a workspace, a tab, or a pane (in the "Panes" list or in its header). For a pane, an empty name makes the name automatic (agent or terminal title). The names are saved in Herdr.

**Reordering**: drag and drop the workspaces in the left bar and the tabs in the tab bar. The order is saved in Herdr.

Closing a tab: the × that appears when hovering the tab (two clicks). Closing a pane: the × of its header, or ⌘W twice.
- macOS notifications when an agent becomes blocked or finishes.

Everything goes through the Herdr server: closing the app stops nothing, and you find the same agents again from the iPhone over SSH.

## Prerequisites

```sh
herdr --version          # Herdr 0.9 or later
rustc --version          # Rust stable (rustup)
node --version           # Node 20 or later
xcode-select --install   # Apple build tools, if needed
```

## Run in development

```sh
cd ~/Projects/Heidrun
pnpm install
pnpm dev
```

There is no need to open `herdr` in a terminal: if the server is not running, the app starts it in the background (option "Start Herdr automatically"). It stays active when you close the app, until `herdr server stop` or until the Mac restarts.

## Build the app

```sh
pnpm build
open packages/apps/desktop_tauri/target/release/bundle/macos/
```

Drag `Heidrun.app` into `/Applications`.

## Context and quotas

### Claude Code

Claude Code passes the context and the quotas (5 h, week) to its status line. Heidrun hooks into it: click **"Enable Claude tracking"** (right panel of a Claude agent, or bottom bar). The app:

- copies `scripts/claude-statusline.sh` into `~/.config/heidrun/`;
- keeps your current status line in `~/.config/heidrun/claude-statusline-next`, which continues to be displayed as is in the terminal;
- points `statusLine.command` of `~/.claude/settings.json` to the script (backup: `settings.json.heidrun-backup`).

Claude Code reloads its settings by itself; the figures arrive at the next reply. To gain a line in the terminal, untick **"Also show the status line in the terminal"**: the script no longer prints anything, but keeps sending the figures to the app. "Disable Claude tracking" restores your original status line. `jq` is required (included in macOS 15, otherwise `brew install jq`). Quotas exist only with a Pro or Max subscription.

### Remote Control (Claude Code)

In the right panel of a Claude agent, the **Remote Control** block shows whether the session is connected (**RC** badge in the pane list) and offers **Enable Remote Control**, which sends `/remote-control` to the agent. Once connected, **Show the URL and QR code** opens a window with the link of the session (copy, open in the browser) and a QR code to scan with the phone, generated locally by the app. The box "Enable for all new Claude sessions" writes `remoteControlAtStartup: true` in `~/.claude/settings.json`. The state is read from the `/rc active` indicator that Claude Code displays under the input area; it does not appear if the terminal is too narrow. Pro, Max, Team or Enterprise subscription required.

### Codex

Nothing to configure: Heidrun reads the logs `~/.codex/sessions/**/rollout-*.jsonl` (last `token_count` event). To link a log to the right pane, install the Herdr integration:

```sh
herdr integration install codex
```

This format is not an official OpenAI API: if a Codex update changes it, the Codex gauge simply disappears, without breaking the app.

## Architecture

```
packages/apps/desktop_tauri/src/
  herdr.rs   client of the socket ~/.config/herdr/herdr.sock (line-by-line JSON),
             event subscriptions, automatic reconnection
  pty.rs     pseudo-terminals that run `herdr terminal attach <terminal_id>`
  usage.rs   reading of the Codex logs
  lib.rs     Tauri commands exposed to the front end
packages/apps/web_frontend/src/
  stores/session.ts   state: Herdr snapshot, selection, notifications, actions
  components/         TopBar, Sidebar, TabBar, PaneGrid, PaneCard, TerminalView,
                      InputBar, Inspector, StatusBar, CommandPalette
```

The front end loads `session.snapshot` at startup, then treats each Herdr event as a refresh signal (this is the method recommended by the API docs). A fallback refresh happens every 5 s.

For a named session, start the app with `HERDR_SESSION=<name>`.

## Next steps

The first 14 issues are done; #15 to #17 (explorer, editing, search and file management) too.

Issue templates for what comes next: `.gitlab/issue_templates/` (Feature, Bug).

## Known limitations

- **One server only**: the local machine. Connecting to a VPS will come later.
- **Approval buttons**: "Always" sends the `2` key of the Claude Code menu. For other agents, only Allow (Enter) and Deny (Esc) are offered.
- **Resizing**: displaying a pane in the app adapts its size to the window. If the same pane is open in the Herdr TUI, the display there may adjust too.
