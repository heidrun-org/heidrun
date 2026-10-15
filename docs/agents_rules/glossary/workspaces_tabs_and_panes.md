# Glossary of Heidrun: workspaces, tabs, and panes

- Created: 14 October 2026
- Last updated: 15 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md), [User interface of Heidrun: workspaces, tabs, and panes](../user_interface/workspaces_tabs_and_panes/index.md)
- Related issue: [issue 403](https://github.com/heidrun-org/heidrun/issues/403), [issue 405](https://github.com/heidrun-org/heidrun/issues/405), [issue 475](https://github.com/heidrun-org/heidrun/issues/475)

This document gives one short definition for each word of the workspaces, the tabs, the panes, the coding agents that run in a pane, and the parts of the window that hold the panes. The other words of Heidrun are in [index.md](index.md).

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

## The parts of the window that hold the panes

### Tab bar

The horizontal row at the top of the viewport, inside the border of the viewport. It shows the tabs of the selected workspace, one entry for each tab.

### Viewport

The main area of the window, between the left sidebar and the right sidebar. It has a border, like each sidebar. It holds the tab bar, the panes of the selected tab that are not pinned, and the column of pinned panes.

### Pinned pane

A pane that the developer keeps visible. The pin button in the header of the pane pins the pane. A pinned pane stays visible, with the same width, when the developer changes tab or workspace.

### Column of pinned panes

The column at the right edge of the viewport. It holds the pinned panes, one above the other, in every tab.

## The parts of a pane

### Usage wheel

The small circle in the header of a pane that shows how much of the context window the coding agent used. The circle fills like a ring, with the colors normal, warning, and critical. It has no word and no number beside it. A click on the usage wheel opens its information card, which gives the percent used, the number of tokens used, and the size of the context window.

## Rules

- The word "tab" means only a tab of Herdr, as defined above. An icon of a sidebar icon bar is not a tab.
- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.
- Write "coding agent" in full. Never write "agent" alone, "AI agent", or "AI coding agent" for Claude Code, Codex, or Antigravity.
- Write "pinned pane" and "column of pinned panes". Do not write "docked pane", "side view", or "alongside".
- Write "usage wheel". Do not write "context bar", "gauge", or "ring" for the circle in the header of a pane.
