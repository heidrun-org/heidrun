# Glossary of Heidrun

- Created: 11 October 2026
- Last updated: 14 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 403](https://github.com/heidrun-org/heidrun/issues/403)

This document gives one short definition for each word that Heidrun uses for a part of its window. Use these words in the code, in the documents, and in the conversations. One word means one thing, and one thing has one word.

## The three levels that come from Herdr

A workspace holds tabs. A tab holds panes.

```
Workspace
└── Tab
    └── Pane
```

### Workspace

One project folder. In most cases, the folder is one repository. A workspace holds tabs.

### Tab

One entry of the tab bar. A tab belongs to one workspace. A tab holds one or more panes.

### Pane

One terminal inside a tab. The terminal runs a shell or a coding agent, for example Claude Code or Codex. A pane belongs to one tab.

## The programs that run in a pane

### Coding agent

One program that the developer runs in a pane to write code with a language model. The coding agents that Heidrun supports are Claude Code, Codex, and Antigravity. "Coding agent" is the official name of each one of them. Write "coding agent" in full, and write the name of the program, for example Claude Code, only when the text is about that one program. Do not write "AI agent", "AI coding agent", "agent", or "assistant" for a coding agent.

## The parts of the window

### Tab bar

The horizontal row at the top of the viewport, inside the border of the viewport. It shows the tabs of the selected workspace, one entry for each tab.

### Viewport

The main area of the window, between the left sidebar and the right sidebar. It has a border, like each sidebar. It holds the tab bar, the panes of the selected tab that are not pinned, and the column of pinned panes.

### Pinned pane

A pane that the developer keeps visible. The pin button in the header of the pane pins the pane. A pinned pane stays visible, with the same width, when the developer changes tab or workspace.

### Column of pinned panes

The column at the right edge of the viewport. It holds the pinned panes, one above the other, in every tab.

### Left sidebar

The panel on the left of the viewport. It holds sidebar sections.

### Right sidebar

The panel on the right of the viewport. It holds sidebar sections.

### Sidebar section

One part of a sidebar, for example the Needs you, the Scripts, the Source control, or the Files sidebar section. A sidebar holds several sidebar sections, and shows one sidebar section at a time.

### Source control sidebar section

The sidebar section of the left sidebar that shows the Git changes of the selected workspace, as the source control view of VS Code does. From the top: a header with the title "Source Control" and its buttons, the commit message box, the commit button, the group "Staged Changes", and the group "Changes". It shows only the local Git repository, nothing of GitHub or GitLab. It replaces the Git sidebar section.

### Code hosting sidebar section

The sidebar section of the left sidebar that shows what lives on GitHub or on GitLab for the repository of the selected workspace: a list of the open issues, and a list of the open pull requests (GitHub) or merge requests (GitLab). A row has three lines and no button. A click on a row opens an information card. The words for its search, such as "saved search", are in [glossary_code_hosting.md](glossary_code_hosting.md).

### Files sidebar section

The sidebar section of the left sidebar that shows the whole folder tree of the Git repository of the selected workspace. A click on a folder folds or unfolds it. A click on a file opens the file in the large Git window. A right click on a file opens a context menu that copies the path of the file. It only reads files.

### Chat

One saved conversation between the developer and a coding agent, for example Claude Code or Codex. The coding agent saves each chat in a file on the disk of the developer. A chat belongs to a workspace when the coding agent ran in the folder of that workspace. A chat is not a pane: the pane is the terminal, and the chat is the saved conversation.

### Chats sidebar section

The sidebar section of the right sidebar that lists the chats of the selected workspace. At its top, a header that stays in place holds a line with the selector that chooses the coding agent, the Chats sort dropdown menu, and the two view buttons, then the dynamic topic bar. Below the header, the list shows the title of each chat of that coding agent, with a summary of three lines under the title. Under the list, the buttons "Show less" and "Show more" change the number of chats. The words for the dynamic topics, such as "dynamic topic bar" and "translation table", are in [glossary_dynamic_topics.md](glossary_dynamic_topics.md).

### Chats sort dropdown menu

The dropdown menu at the top of the Chats sidebar section, at the left of the two view buttons. Its button shows the name of the chosen sort key, with an icon that shows the chosen order. It has two parts: "Sort by" chooses what the chats are sorted by (created on, last updated, messages from you, issues, pull requests, or files written), and "Order" chooses "Ascending" (the smallest value first) or "Descending" (the largest value first), for the sort key that was chosen. It looks like the sort dropdown menu of the list of issues of GitHub.

### Sidebar icon bar

The narrow vertical bar of icons at the outer edge of each sidebar, like the bar of icons of Visual Studio Code. It shows one icon for each sidebar section of that sidebar. A click on an icon shows that sidebar section. When the sidebar is collapsed, the sidebar icon bar is the only part of the sidebar that stays visible.

### Status bar

The horizontal row at the bottom of the window. It holds status bar sections.

### Status bar section

One part of the status bar. It shows one piece of information, for example the usage of Claude, the usage of Codex, or the Git branch. A click on a status bar section opens its information card.

### Information card

A small card that opens on a click, never when the mouse pointer only moves over its part. It gives more detail about that part, and it can hold buttons. It opens above a status bar section, at the left of a part of the right sidebar, at the right of a part of the left sidebar, or below a circled question mark of a page of the Settings window. The part gets a background while the pointer is over it and while the information card is open. A second click on the part, the key Escape, a click outside, and the loss of the keyboard focus close the information card. The files line of a chat in the Chats sidebar section has the first information card that opens at the left of a part of a sidebar.

### Workspace status bar section

The first status bar section, at the left end of the status bar. It shows the status dot and the name of the selected workspace. Its information card gives the details of the selected workspace, and lists the workspaces to select, rename, close, move, or create.

## Rules

- The word "tab" means only a tab of Herdr, as defined above. An icon of a sidebar icon bar is not a tab.
- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.
- The word "chat" means only a saved conversation, as defined above. A pane is not a chat.
- Write "coding agent" in full. Never write "agent" alone, "AI agent", or "AI coding agent" for Claude Code, Codex, or Antigravity.
- The word "section" is never alone. Write "sidebar section" or "status bar section".
- Write "pinned pane" and "column of pinned panes". Do not write "docked pane", "side view", or "alongside".
