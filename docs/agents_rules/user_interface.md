# User interface of Heidrun

This document says where each part of the window goes and how each part works. The words are defined in [glossary.md](glossary.md). The layout below is the decided target layout. Parts of the current window do not follow it yet.

## Layout

```
┌───────────┬─────────────────────────────────────┬───────────┐
│           │ [heidrun ▾] [tab 1] [tab 2] [+]     │           │
│   left    ├─────────────────────┬───────────────┤   right   │
│  sidebar  │ panes of the        │ pinned panes  │  sidebar  │
│           │ selected tab        │ in a column   │           │
│           │                     │               │           │
├───────────┴─────────────────────┴───────────────┴───────────┤
│ status bar: [status bar section] [status bar section]       │
└─────────────────────────────────────────────────────────────┘
```

## Rules of the layout

- The viewport gets the most width, because the developer reads and writes text there.
- A part that the developer uses rarely does not take space all the time. A part that the developer uses often is always visible.

## Workspace

- One workspace is selected at a time.
- The workspace button sits at the left end of the tab bar. It shows the name of the selected workspace. A click on the button opens the list of workspaces. The list does not open when the mouse moves over the button.
- A developer switches workspace rarely, so the workspace button takes little space.
- A small colored dot on the workspace button shows that an agent in another workspace is blocked or has finished. The dot follows the cards of the To handle sidebar section.
- The list of workspaces offers the creation of a workspace, the rename of a workspace, the close of a workspace, and the move of a workspace by drag and drop. A double click on the workspace button renames the selected workspace in place.
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
- A click on a pane gives the focus to that pane.
- A click on the pin button in the header of a pane pins the pane. A pinned pane goes into the column of pinned panes.
- The column of pinned panes sits at the right edge of the viewport, beside the panes of the selected tab. It shows every pinned pane in every tab, the tab of the pinned pane included. Its width is the same in every tab, so a pinned pane keeps the same width in every tab.
- The panes of the selected tab that are not pinned fill the width that the column leaves. A tab whose panes are all pinned shows the same picture as an empty tab.
- The header of a pinned pane in the column shows the pressed pin button, as in the panes of the selected tab. A click on the pressed pin button unpins the pane.
- A pinned pane does not change when the developer selects another tab or another workspace. Only the panes of the selected tab change.

## To handle

- The To handle sidebar section is a sidebar section of the left sidebar. It holds one card for each agent that is blocked, that asks a question, or that has finished, with the blocked agents first.
- A click on a card shows the pane of the agent. A card also lets the developer answer a blocked agent, pin the pane, and hide the card.
- The button of the To handle sidebar section shows the number of cards. The number is red when an agent is blocked.
- A hidden card comes back at the next change of the agent. A finished agent leaves the sidebar section after the delay that the settings give.

## Sidebars

- A sidebar holds several sidebar sections, and shows one sidebar section at a time.
- The left sidebar holds the To handle sidebar section, the Scripts sidebar section, and the Git sidebar section.
- The right sidebar holds the Pane sidebar section and the Notes sidebar section.
- Each sidebar has a navigation bar. Each button of the navigation bar shows one sidebar section. The two sidebars use the same kind of navigation bar.
- A button hides each sidebar completely. A hidden sidebar leaves no strip of icons, so the viewport takes the whole width.
- The two hide buttons are of the same kind, and sit in the top bar: the button of the left sidebar at the left, and the button of the right sidebar at the right. The shortcut ⌘B hides or shows the left sidebar, and the shortcut ⌥⌘B hides or shows the right sidebar.
- When the developer or the code opens a sidebar section, for example the Notes sidebar section after the shortcut ⇧⌘P pins a text, the sidebar that holds the sidebar section opens if it is hidden. A hidden sidebar that holds another sidebar section stays hidden.
- The sidebars hold no tabs. The word "tab" belongs to the tab bar only.

## Status bar

- The status bar sits at the bottom of the window, over the whole width.
- Each status bar section shows one piece of information, for example the usage of Claude, the usage of Codex, the Git branch, the number of agents that are blocked, working, or done, and the connection to Herdr.
- A click on a status bar section opens its information card above the section.
