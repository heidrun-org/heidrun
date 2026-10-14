# User interface of Heidrun: sidebars and notes

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md)
- Related issue: [issue 315](https://github.com/heidrun-org/heidrun/issues/315), [issue 371](https://github.com/heidrun-org/heidrun/issues/371)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## Sidebars

- A sidebar holds several sidebar sections, and shows one sidebar section at a time.
- The left sidebar holds the Files sidebar section, the Launchers sidebar section, the Source control sidebar section, and the Code hosting sidebar section, in this order from the top.
- The right sidebar holds the Needs you sidebar section, the Notes sidebar section, and the Past chats sidebar section.
- Each sidebar has a sidebar icon bar, always visible, like the bar of icons of Visual Studio Code. The sidebar icon bar sits at the outer edge of the sidebar: at the left of the left sidebar, and at the right of the right sidebar. The two sidebars use the same kind of sidebar icon bar.
- The sidebar icon bar shows one icon for each sidebar section, one under the other: `folder2` for the Files sidebar section, `play-circle` for the Launchers sidebar section, `git` for the Source control sidebar section, `github` or `gitlab` for the Code hosting sidebar section (a `cloud` when the hosting service is not known, see [code_hosting.md](code_hosting.md)), `bell` for the Needs you sidebar section, `sticky` for the Notes sidebar section, and `chat-left-text` for the Past chats sidebar section. The title of the sidebar section is the tooltip of its icon. The number of a sidebar section sits on the top right corner of its icon.
- A sidebar is expanded or collapsed. An expanded sidebar shows the sidebar icon bar and the content of the selected sidebar section, side by side, in one frame, with a line between them. The icon of the selected sidebar section has a background. A collapsed sidebar shows only the sidebar icon bar, 48 pixels wide, and no icon has a background.
- A click on the icon of the sidebar section that an expanded sidebar shows collapses the sidebar. A click on any other icon expands the sidebar, if it is collapsed, and shows that sidebar section.
- The first button of the sidebar icon bar, above the icons, collapses or expands the sidebar. In an expanded sidebar, it is the collapse button, with an arrow toward the edge of the window: `chevron-bar-left` in the left sidebar, `chevron-bar-right` in the right sidebar. In a collapsed sidebar, it is the expand button, with an arrow toward the viewport: `chevron-bar-right` in the left sidebar, `chevron-bar-left` in the right sidebar. The expand button expands the sidebar to its selected sidebar section.
- A collapsed sidebar has no line to drag: its width does not change, and the gap between it and the viewport stays. The width of an expanded sidebar includes the sidebar icon bar.
- An expanded sidebar has a minimum width: 200 pixels for the left sidebar, and 260 pixels for the right sidebar. It has no fixed maximum width: the rule of the layout, in [layout.md](../window/layout.md), says how far the developer can make it wider ([issue #371](https://github.com/heidrun-org/heidrun/issues/371)).
- A sidebar is never hidden completely: the top bar has no button that hides a sidebar, and the sidebar icon bar stays on the screen, collapsed or expanded.
- The shortcut ⌘B collapses or expands the left sidebar, and the shortcut ⌥⌘B collapses or expands the right sidebar ([issue #315](https://github.com/heidrun-org/heidrun/issues/315)).
- When the developer or the code opens a sidebar section, for example the Notes sidebar section after the shortcut ⇧⌘P pins a text, the sidebar that holds the sidebar section expands if it is collapsed to the sidebar icon bar. A sidebar that holds another sidebar section does not change.
- The sidebars hold no tabs. The word "tab" belongs to the tab bar only.

## Notes

- A note belongs to the workspace where the developer pinned the text. The workspace is found again by its name, because Herdr gives new identifiers to its workspaces in its next session.
- The Notes sidebar section lists the notes of the selected workspace, or every note when "All workspaces" is checked. The number on the button of the Notes sidebar section counts the notes that the list shows.
- A note whose workspace does not exist any more stays, and shows only when "All workspaces" is checked.

