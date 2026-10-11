# User interface of Heidrun

This document says where each part of the window goes and how each part works. The words are defined in [glossary.md](glossary.md). The layout below is the layout of the window.

## Layout

```
┌───────────┬─────────────────────────────────────┬───────────┐
│           │ [tab 1] [tab 2] [+]                 │           │
│   left    ├─────────────────────┬───────────────┤   right   │
│  sidebar  │ panes of the        │ pinned panes  │  sidebar  │
│           │ selected tab        │ in a column   │           │
│           │                     │               │           │
├───────────┴─────────────────────┴───────────────┴───────────┤
│ status bar: [● heidrun] [status bar section] [...]          │
└─────────────────────────────────────────────────────────────┘
```

## Rules of the layout

- The viewport gets the most width, because the developer reads and writes text there.
- The left sidebar, the viewport, and the right sidebar are three frames of the same kind: the same border, the same rounded corners, and the same background. The tab bar is inside the frame of the viewport.
- A part that the developer uses rarely does not take space all the time. A part that the developer uses often is always visible.

## Workspace

- One workspace is selected at a time.
- The workspace status bar section is the first status bar section, at the left end of the status bar. It shows a status dot and the name of the selected workspace. A click on it opens its information card above the section. The information card does not open when the mouse moves over the section.
- The status dot is always visible, and it sits before the name, in the same place as the dot of a tab. When an agent in another workspace is blocked or has finished, the dot has the color of that status, and it follows the cards of the To handle sidebar section. Otherwise, the dot shows the status of the selected workspace. A workspace without an agent gets a hollow ring.
- The information card of the workspace status bar section gives the folder, the Git branch, the number of tabs, and the number of agents of the selected workspace. Under the details, it lists the workspaces. A click on a workspace selects it, and closes the information card.
- The list of workspaces has no separator line between the workspaces, and no space between two rows: between the two separator lines, the pointer is always on a workspace. Each row is 32 pixels tall, with the padding inside the row. One separator line sits between the list and the entry "New workspace…" at the end of the information card.
- The line after the workspace status bar section has 6 more pixels of space on each side than the other lines of the status bar, so that the workspace status bar section is not packed against the next status bar section.
- Each workspace of the list offers the rename of the workspace, the close of the workspace, and the move of the workspace by drag and drop. The rename puts a text field in the place of the name in the status bar. A double click on the workspace status bar section does not rename the workspace.
- Two other ways to switch workspace: the command search with ⌘K, and the shortcut Option+Command+Up arrow or Option+Command+Down arrow.

## Tabs

- The tab bar sits at the top of the viewport, inside its border. It shows the tabs of the selected workspace, one entry for each tab. It has no workspace selector: the workspace status bar section has it.
- A click anywhere on a tab, padding included, selects the tab. The viewport then shows the panes of that tab. The close button of the tab is the only exception: a click on it closes the tab.
- The plus button at the end of the tab bar creates a new tab.
- The developer reorders the tabs by pressing a tab, moving the mouse, and releasing the button where the tab goes. The same holds for the list of workspaces and for the list of notes. The reorder uses the pointer events of the page, and never the drag and drop of the browser: the window of Heidrun receives the image files that the developer drops from Finder, so the native window takes every drag and drop, and the page gets no drag event of the browser. A press that moves less than 5 pixels is a click. The key Escape cancels the move.
- A developer switches tab often, so the tabs are always visible.
- A workspace has few tabs, twenty tabs is extremely rare. So each tab is large, with generous horizontal padding.
- Each tab shows a small icon between its status dot and its name: the Claude icon, the OpenAI icon for Codex, or the terminal icon. A pane with an agent always beats a terminal. Among the panes with an agent, the pane that decides the color of the status dot gives the icon (blocked, then working, then done, then idle). When two panes have the same status, the selected pane wins, then the focused pane, then the first pane.
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
- Each sidebar has a navigation bar. Each button of the navigation bar shows one sidebar section. The two sidebars use the same kind of navigation bar. In each sidebar, the line of the navigation bar reaches the left border and the right border, and the space between the top border and the selected button of the navigation bar is 5 pixels. A button of the navigation bar has the same height as a tab of the tab bar, so the three bars have the same height.
- A button hides each sidebar completely. A hidden sidebar leaves no strip of icons, so the viewport takes the whole width.
- The two hide buttons are of the same kind, and sit in the top bar: the button of the left sidebar at the left, and the button of the right sidebar at the right. The shortcut ⌘B hides or shows the left sidebar, and the shortcut ⌥⌘B hides or shows the right sidebar.
- When the developer or the code opens a sidebar section, for example the Notes sidebar section after the shortcut ⇧⌘P pins a text, the sidebar that holds the sidebar section opens if it is hidden. A hidden sidebar that holds another sidebar section stays hidden.
- The sidebars hold no tabs. The word "tab" belongs to the tab bar only.

## Notes

- A note belongs to the workspace where the developer pinned the text. The workspace is found again by its name, because Herdr gives new identifiers to its workspaces in its next session.
- The Notes sidebar section lists the notes of the selected workspace, or every note when "All workspaces" is checked. The number on the button of the Notes sidebar section counts the notes that the list shows.
- A note whose workspace does not exist any more stays, and shows only when "All workspaces" is checked.

## Status bar

- The status bar sits at the bottom of the window, over the whole width.
- Each status bar section shows one piece of information, for example the selected workspace, the usage of Claude, the usage of Codex, the Git branch, the number of agents that are blocked, working, or done, and the connection to Herdr.
- A click on a status bar section opens its information card above the section.

## Position and size of the window

- When Heidrun quits, it saves the position and the size of the window, and whether the window was maximized or full screen. The window-state plugin of Tauri does this work, and keeps the file `.window-state.json` in the configuration folder of the application.
- At the next start, the window opens with the saved position, the saved size, and the saved maximized or full screen state.
- At the first start, no state is saved, and the window opens in the middle of the screen with the size in `tauri.conf.json`.
- When the saved position is outside every screen that is connected, the window opens at the default position of the operating system, on a connected screen.
- The visible state is never restored. The window stays hidden until the splash image is ready.
