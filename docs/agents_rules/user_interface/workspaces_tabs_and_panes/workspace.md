# User interface of Heidrun: workspace

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Workspace

- One workspace is selected at a time.
- The workspace status bar section is the first status bar section, at the left end of the status bar. It shows a status dot and the name of the selected workspace. A click on it opens its information card above the section. The information card does not open when the mouse moves over the section.
- The status dot is always visible, and it sits before the name, in the same place as the dot of a tab. When an agent in another workspace is blocked or has finished, the dot has the color of that status, and it follows the cards of the Needs you sidebar section. Otherwise, the dot shows the status of the selected workspace. A workspace without an agent gets a hollow ring.
- The information card of the workspace status bar section gives the folder, the Git branch, the number of tabs, and the number of agents of the selected workspace. The folder is shown on one line, under the rules of the section "Text that must stay on one line" (in [layout.md](../window/layout.md)): while the pointer is over the information card, a folder that does not fit scrolls sideways to its end, and it shows its beginning again when the pointer leaves. Under the details, it lists the workspaces. A click on a workspace selects it, and closes the information card.
- The list of workspaces has no separator line between the workspaces, and no space between two rows: between the two separator lines, the pointer is always on a workspace. Each row is 32 pixels tall, with the padding inside the row. One separator line sits between the list and the entry "New workspace…" at the end of the information card.
- The line after the workspace status bar section has 6 more pixels of space on each side than the other lines of the status bar, so that the workspace status bar section is not packed against the next status bar section.
- Each workspace of the list offers the rename of the workspace, the close of the workspace, and the move of the workspace by drag and drop. The rename puts a text field in the place of the name in the status bar. A double click on the workspace status bar section does not rename the workspace.
- Two other ways to switch workspace: the command search with ⌘K, and the shortcut Option+Command+Up arrow or Option+Command+Down arrow.

