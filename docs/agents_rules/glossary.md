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

The horizontal row on top of the viewport. It shows the tabs of the selected workspace, one entry for each tab.

### Viewport

The main area of the window. It shows the panes of the selected tab.

### Left sidebar

The panel on the left of the viewport.

### Right sidebar

The panel on the right of the viewport.

### Navigation bar

A row of buttons inside a sidebar. Each button shows one view of that sidebar.

### Status bar

The horizontal row at the bottom of the window. It holds status bar sections.

### Status bar section

One part of the status bar. It shows one piece of information, for example the usage of Claude, the usage of Codex, or the Git branch. A click on a status bar section opens its information card.

### Information card

A small card that opens above a status bar section. It gives more detail about that section.

## Rules

- The word "tab" means only a tab of Herdr, as defined above. A button of a navigation bar is not a tab.
- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.
