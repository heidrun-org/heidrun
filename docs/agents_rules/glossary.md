# Glossary of Heidrun

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

One part of a sidebar, for example the To handle, the Scripts, or the Git sidebar section. A sidebar holds several sidebar sections, and shows one sidebar section at a time.

### Chat

One saved conversation between the developer and a coding agent, for example Claude Code or Codex. The coding agent saves each chat in a file on the disk of the developer. A chat belongs to a workspace when the coding agent ran in the folder of that workspace. A chat is not a pane: the pane is the terminal, and the chat is the saved conversation.

### Chats sidebar section

The sidebar section of the right sidebar that lists the chats of the selected workspace. At its top, a selector chooses the coding agent. Below the selector, the list shows the title of each chat of that coding agent.

### Navigation bar

A row of buttons inside a sidebar. Each button shows one sidebar section of that sidebar.

### Status bar

The horizontal row at the bottom of the window. It holds status bar sections.

### Status bar section

One part of the status bar. It shows one piece of information, for example the usage of Claude, the usage of Codex, or the Git branch. A click on a status bar section opens its information card.

### Information card

A small card that opens above a status bar section. It gives more detail about that section.

### Workspace status bar section

The first status bar section, at the left end of the status bar. It shows the status dot and the name of the selected workspace. Its information card gives the details of the selected workspace, and lists the workspaces to select, rename, close, move, or create.

## Rules

- The word "tab" means only a tab of Herdr, as defined above. A button of a navigation bar is not a tab.
- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.
- The word "chat" means only a saved conversation, as defined above. A pane is not a chat.
- The word "section" is never alone. Write "sidebar section" or "status bar section".
- Write "pinned pane" and "column of pinned panes". Do not write "docked pane", "side view", or "alongside".
