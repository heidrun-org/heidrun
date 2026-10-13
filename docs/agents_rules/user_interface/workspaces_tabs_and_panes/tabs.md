# User interface of Heidrun: tabs

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)
- Related issue: [issue 328](https://github.com/heidrun-org/heidrun/issues/328)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Tabs

- The tab bar sits at the top of the viewport, inside its border. It shows the tabs of the selected workspace, one entry for each tab. It has no workspace selector: the workspace status bar section has it.
- A click anywhere on a tab, padding included, selects the tab. The viewport then shows the panes of that tab. The close button of the tab is the only exception: a click on it closes the tab.
- The plus button at the end of the tab bar creates a new tab at once, and opens no window. The pane of the new tab runs the default command of a new tab, the option `newTabCommand` of the settings: "terminal" (a shell, the default), "claude" (Claude Code), or "codex" (Codex). With "claude" or "codex", the pane starts a free agent: no specific role, the default model, no starting prompt, and the tab is named after the command. A shift click on the plus button starts the previous pane of the window "New pane" again, when there is one, and starts the default command otherwise ([issue 328](https://github.com/heidrun-org/heidrun/issues/328)). The shortcut Command+T does the same as a plain click on the plus button: it creates a new tab and starts the default command of a new tab ([issue 340](https://github.com/heidrun-org/heidrun/issues/340)).
- The Settings window has a section "New tab", the second section of its sidebar (icon `plus-lg`). The section holds the choice "Default command of a new tab": a Bootstrap 6 button group of three radio inputs (`btn-group` with `btn-check btn-outline theme-secondary` labels), "Terminal", "Claude Code", and "Codex", and one line of help under them ([issue 328](https://github.com/heidrun-org/heidrun/issues/328)).
- The developer reorders the tabs by pressing a tab, moving the mouse, and releasing the button where the tab goes. The same holds for the list of workspaces and for the list of notes. The reorder uses the pointer events of the page, and never the drag and drop of the browser: the window of Heidrun receives the image files that the developer drops from Finder, so the native window takes every drag and drop, and the page gets no drag event of the browser. A press that moves less than 5 pixels is a click. The key Escape cancels the move.
- A developer switches tab often, so the tabs are always visible.
- A workspace has few tabs, twenty tabs is extremely rare. So each tab is large, with generous horizontal padding.
- Each tab shows a small icon between its status dot and its name: the Claude icon, the OpenAI icon for Codex, or the terminal icon. A pane with an agent always beats a terminal. Among the panes with an agent, the pane that decides the color of the status dot gives the icon (blocked, then working, then done, then idle). When two panes have the same status, the selected pane wins, then the focused pane, then the first pane.
- The shortcut Option+Command+Left arrow or Option+Command+Right arrow selects the previous or the next tab.

