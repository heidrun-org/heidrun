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
- The right sidebar holds the Pane sidebar section, the Notes sidebar section, and the Chats sidebar section.
- Each sidebar has a navigation bar. Each button of the navigation bar shows one sidebar section. The two sidebars use the same kind of navigation bar. In each sidebar, the line of the navigation bar reaches the left border and the right border, and the space between the top border and the selected button of the navigation bar is 5 pixels. A button of the navigation bar has the same height as a tab of the tab bar, so the three bars have the same height.
- A button hides each sidebar completely. A hidden sidebar leaves no strip of icons, so the viewport takes the whole width.
- The two hide buttons are of the same kind, and sit in the top bar: the button of the left sidebar at the left, and the button of the right sidebar at the right. The shortcut ⌘B hides or shows the left sidebar, and the shortcut ⌥⌘B hides or shows the right sidebar.
- When the developer or the code opens a sidebar section, for example the Notes sidebar section after the shortcut ⇧⌘P pins a text, the sidebar that holds the sidebar section opens if it is hidden. A hidden sidebar that holds another sidebar section stays hidden.
- The sidebars hold no tabs. The word "tab" belongs to the tab bar only.

## Notes

- A note belongs to the workspace where the developer pinned the text. The workspace is found again by its name, because Herdr gives new identifiers to its workspaces in its next session.
- The Notes sidebar section lists the notes of the selected workspace, or every note when "All workspaces" is checked. The number on the button of the Notes sidebar section counts the notes that the list shows.
- A note whose workspace does not exist any more stays, and shows only when "All workspaces" is checked.

## Chats

- The Chats sidebar section is a sidebar section of the right sidebar. It lists the chats of the selected workspace.
- The folder of the selected workspace gives the chats: the root of the repository that holds the folder of the workspace. A chat that a coding agent saved for another folder, a worktree of the workspace included, is not in the list.
- A selector at the top of the Chats sidebar section chooses the coding agent: Claude or Codex. The selector offers only the coding agents that have at least one chat in the selected workspace. The Chats sidebar section shows no selector when neither coding agent has a chat, and says so.
- Below the selector, the list shows the title of each chat of the chosen coding agent, newest first. The title of Claude comes from the last title record of the file of the chat. The title of Codex comes from the index of Codex. A chat without a title shows its first message. A chat without a title and without a message is not in the list.
- The list shows 5 chats at the start. Under the list, two buttons stay visible all the time: "Show more" on the left and "Show less" on the right. "Show more" is disabled when the workspace has no more chats of the chosen coding agent. "Show less" is disabled when the list has no more chats than the next lower number allows. Each click on "Show more" asks for more: 10 chats, then 20, then 50, then 50 more at each click. Each click on "Show less" goes one step back, down to 5 chats, and cuts the list at once without reading the files again. While "Show more" waits for the answer, it shows a small spinning wheel, and both buttons are disabled. The program opens only the files of the chats that the list shows, so the cost does not grow with the number of chats of the workspace. The one exception is the first line of each file of Codex: the program reads it once, to know the folder of the file, and keeps it. The list starts again with 5 chats when the developer selects another workspace.
- The rows of the list use the Bootstrap list group. The separators between the rows go from one edge of the sidebar to the other, and the title and the lines of a row keep the same small margin as the selector (14 pixels) at the left and at the right. A row gets a background while the mouse pointer is over it.
- Under the title, each chat shows a summary in muted color, in up to three lines. A line has no indent: its icon starts at the same place as the first letter of the title. A line that has nothing to say is left out. Each line starts with a small icon.
  1. The clock icon, then the first and the last date, then the number of messages from the developer.
  2. The icon of the forge of the repository (GitHub or GitLab, else the Git icon), then the issue numbers, then the pull request numbers. A list of numbers shows the first three, then "+" and how many more.
  3. The file icon, then the names of the first two files that the coding agent wrote, then "+" and how many more. This line is the files line.
  The folders where the coding agent ran are found and kept, but the summary does not show them yet.
- The files line has an information card. The files line gets a background while the pointer is over it, and the information card opens at the left of the files line on a click, or on the key Enter or the key Space when the files line has the keyboard focus. The information card does not open when the pointer only moves over the files line. The information card stays open until a second click on the files line, the key Escape, a click outside, or the loss of the keyboard focus closes it.
- The information card has a title with the files icon and the number of files written, then one row for each file. A row shows an icon that fits the kind of the file, then two lines: the name of the file in medium weight, and the folders of the file in muted color under it. A file at the root of the repository shows `./` as its folders, so every row has two lines. A line that does not fit shows its beginning with an ellipsis, on one line. While the pointer is over the row, a line that does not fit scrolls to its end, after a short wait, and it shows its beginning again when the pointer leaves. The scroll is a CSS transition of the transform of the text, at a constant speed, so the browser moves the text by fractions of a pixel without JavaScript frames. At the right of the row, a Bootstrap button group holds two buttons that show only an icon: the VS Code icon, and the GitHub or GitLab icon. Each button has a title that says what it does, without the path of the file: "Open in VS Code" and "Open in GitHub". A button gets a background, lighter than the background of the row, while the pointer is over it. A row gets a soft background while the pointer is over it, and the files line and the buttons get a stronger background than the soft one, so each of them still shows inside the row. The soft background is the color `--hover-soft`, for every row of a Bootstrap list group. The information card uses the Bootstrap list group, so its rows are like the rows of the list.
- The folders of a file are the path below the root of the repository. A file that the coding agent wrote in a worktree of the repository (a path that starts with `.claude/worktrees/<name>/` below the root) shows the path of the same file at the root, because the worktree is deleted after its merge. A file written in a worktree and the same file at the root count as one file, in the files line and in the information card. A file that is not below the root of the repository shows its absolute path, and its two buttons are always visible but disabled, with a title that says the file is outside the repository.
- "VS Code" opens the file at the root of the repository, after it checks the file against the folder of the selected workspace. "GitHub" or "GitLab" opens the file on the web page of the repository, on the default branch (`HEAD`). Every row always shows its buttons. A repository without a remote has no button for the forge. A button that fails shows the reason in a message.
- Each time the information card opens, the program tells which files exist (the Tauri command `chats_files_exist`). "VS Code" is disabled when the file is not in the working folder of the root of the repository. "GitHub" or "GitLab" is disabled when the file is not on the default branch of the remote. The default branch is `refs/remotes/origin/HEAD` as the last fetch knows it, or `HEAD` when the repository has no such reference. The check is local and offline. A disabled button shows the reason in its title when the pointer rests on it. When the check fails, the buttons stay on.
- The information cards of the issues and of the pull requests are not built yet.
- The program finds the summary without a model, by reading the file of the chat: the dates come from the `timestamp` field of the records, the messages from the records that the developer typed, and the files from the Write, Edit, MultiEdit, and NotebookEdit tools of Claude and from the patches of Codex. A pull request number comes from the `pr-link` records of Claude, from addresses that end with `/pull/<number>`, and from the words "pull request" or "PR" before a number. An issue number comes from addresses that end with `/issues/<number>`, from the word "issue" before a number, from `gh` commands, and from a bare `#<number>` in a message of the developer or in a commit command. A number that is a pull request is never an issue.
- The program keeps what it read in each file in the file `chats_cache.json`, in the data folder of Heidrun. It reads a file again only when the size or the modification date of the file changes. A file that only grew is read from the place where the last read stopped, so a long chat that is still running costs little.
- The button of the Chats sidebar section shows no number.
- The list reads the chats again when the Chats sidebar section opens, when the developer selects another workspace, and every 10 seconds while the Chats sidebar section is on the screen.
- The ideas for later are in [issue #250](https://github.com/heidrun-org/heidrun/issues/250).

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
