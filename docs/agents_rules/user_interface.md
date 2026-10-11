# User interface of Heidrun

This document says where each part of the window goes and how each part works. The words are defined in [glossary.md](glossary.md). The layout below is the decided target layout. Parts of the current window do not follow it yet.

## Layout

```
┌───────────┬─────────────────────────────────────┬───────────┐
│           │ [heidrun ▾] [tab 1] [tab 2] [+]     │           │
│   left    ├─────────────────────────────────────┤   right   │
│  sidebar  │                                     │  sidebar  │
│           │  viewport: the panes of the         │           │
│           │  selected tab                       │           │
├───────────┴─────────────────────────────────────┴───────────┤
│ status bar: [section] [section] [section]                   │
└─────────────────────────────────────────────────────────────┘
```

## Rules of the layout

- The viewport gets the most width, because the developer reads and writes text there.
- A part that the developer uses rarely does not take space all the time. A part that the developer uses often is always visible.

## Workspace

- One workspace is selected at a time.
- The workspace button sits at the left end of the tab bar. It shows the name of the selected workspace. A click on the button opens the list of workspaces.
- A developer switches workspace rarely, so the workspace button takes little space.
- A small colored dot on the workspace button shows that an agent in another workspace is blocked or has finished.
- Two other ways to switch workspace: the command search with ⌘K, and the shortcut Option+Command+Up arrow or Option+Command+Down arrow.

## Tabs

- The tab bar sits on top of the viewport. It shows the tabs of the selected workspace, one entry for each tab.
- A click on a tab selects the tab. The viewport then shows the panes of that tab.
- The plus button at the end of the tab bar creates a new tab.
- A developer switches tab often, so the tabs are always visible.
- The shortcut Option+Command+Left arrow or Option+Command+Right arrow selects the previous or the next tab.

## Panes

- A tab with one pane shows one terminal over the whole viewport.
- A tab with several panes shares the viewport between its panes.

## Sidebars

- The right sidebar has a navigation bar. Each button of the navigation bar shows one view of the right sidebar.
- The sidebars hold no tabs. The word "tab" belongs to the tab bar only.

## Status bar

- The status bar sits at the bottom of the window, over the whole width.
- Each status bar section shows one piece of information, for example the usage of Claude, the usage of Codex, the Git branch, the number of agents that are blocked, working, or done, and the connection to Herdr.
- A click on a status bar section opens its information card above the section.

## Not decided yet

- What the left sidebar holds, now that the tabs are on top of the viewport.
- Whether a sidebar can shrink to a narrow strip of icons, as the vertical tabs of Chrome and the Activity Bar of VS Code do.
