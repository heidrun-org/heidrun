# User interface of Heidrun: layout of the window

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)
- Related issue: [issue 303](https://github.com/heidrun-org/heidrun/issues/303), [issue 315](https://github.com/heidrun-org/heidrun/issues/315), [issue 323](https://github.com/heidrun-org/heidrun/issues/323)

This document says where each part of the window goes and how each part works. The words are defined in [glossary.md](../../glossary.md). The layout below is the layout of the window.

The other files of the folder `docs/agents_rules/user_interface` give the rules of the other parts. [AGENTS.md](../../../../AGENTS.md) lists them.

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
- The left sidebar, the viewport, and the right sidebar are three frames of the same kind: the same border, the same rounded corners, and the same background (`--side`). The tab bar is inside the frame of the viewport. The panes inside the frame of the viewport have a lighter background (`--bg`), as the editor of VS Code is lighter than its sidebar, and they have no frame of their own: see the section "Panes".
- The gap between the viewport and a sidebar is 5 pixels (`--pane-gap`), whether the sidebar is expanded or collapsed. An expanded sidebar fills the gap with its line to drag, and a collapsed sidebar, which has no line to drag, keeps an empty gap of the same width, so the viewport does not move when the developer collapses or expands a sidebar ([issue #323](https://github.com/heidrun-org/heidrun/issues/323)).
- A part that the developer uses rarely does not take space all the time. A part that the developer uses often is always visible.
- The top bar is 43 pixels high. The gap above the search box, the theme button, and the more button is 9 pixels, and the gap below them is also 9 pixels, down to the first tab of the tab bar and to the first button of each sidebar icon bar ([issue #315](https://github.com/heidrun-org/heidrun/issues/315)).

## Text that must stay on one line

- A piece of information that must not go to the next line, for example a folder path, a file path, or a Git branch name, is always shown on one line.
- When the container is too narrow to show the whole text on one line, the text does not wrap and does not break in the middle of a word. The container cuts the text at its edge.
- While the pointer is over the container, the text scrolls sideways, so that the developer can read the whole text.
- The folder path in the information card of the Workspace status bar section follows these rules ([issue #303](https://github.com/heidrun-org/heidrun/issues/303)).

## Files

- Heidrun never modifies a file of the developer. Only the coding agents that run in the panes modify files.
- A part of the window that shows files, for example a file explorer, only reads them. It has no button to rename, move, delete, or edit a file. The only exception is the Files sidebar section, which can create a new empty file and a new empty folder ([files.md](../sidebars/files.md)).

