# User interface of Heidrun: workspace

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md), [Tabs](tabs.md)
- Related issue: [issue 379](https://github.com/heidrun-org/heidrun/issues/379)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## Workspace

- One workspace is selected at a time.
- The workspace status bar section is the first status bar section, at the left end of the status bar. It shows a status dot and the name of the selected workspace. A click on it opens its information card above the section. The information card does not open when the mouse moves over the section.
- The status dot is always visible, and it sits before the name, in the same place as the dot of a tab. When an agent in another workspace is blocked or has finished, the dot has the color of that status, and it follows the cards of the Needs you sidebar section. Otherwise, the dot shows the status of the selected workspace. A workspace without an agent gets a hollow ring.
- The information card of the workspace status bar section gives the folder, the Git branch, the number of tabs, and the number of agents of the selected workspace. The folder is shown on one line, under the rules of the section "Text that must stay on one line" (in [layout.md](../window/layout.md)): while the pointer is over the information card, a folder that does not fit scrolls sideways to its end, and it shows its beginning again when the pointer leaves. Under the details, it lists the workspaces. A click on a workspace selects it, and closes the information card.
- **The order of the workspaces never changes with the status dot or with the presence of an agent.** The list shows the workspaces in the order of Herdr, which is the number of the workspace. A workspace without an agent can sit above a workspace with an agent, and starting, blocking, finishing, or stopping an agent moves no workspace. Only the developer moves a workspace, by drag and drop, with the keyboard, or with the command search. The shortcuts that select a workspace (Command and a digit, Option+Command+Up arrow, and Option+Command+Down arrow) use this same order. The store `session.ts` has one list of workspaces, `workspaces`, and no other list that orders them by agent ([issue 417](https://github.com/heidrun-org/heidrun/issues/417)).
- The list of workspaces has no separator line between the workspaces, and no space between two rows: between the two separator lines, the pointer is always on a workspace. Each row is 32 pixels tall, with the padding inside the row. One separator line sits between the list and the entry "New workspace…" at the end of the information card.
- The line after the workspace status bar section has 6 more pixels of space on each side than the other lines of the status bar, so that the workspace status bar section is not packed against the next status bar section.
- Each workspace of the list offers the rename of the workspace, the close of the workspace, and the move of the workspace by drag and drop. The rename puts a text field in the place of the name in the status bar. A double click on the workspace status bar section does not rename the workspace.
- The entry "New workspace…" asks for a folder, then creates the workspace with the name of the folder and selects it at once, with its first tab and its first pane. Herdr creates this first tab with the workspace, so Heidrun creates no other tab. The pane of this first tab runs the default command of a new tab, the option `newTabCommand` of the settings, the same as a plain click on the plus button of the tab bar ([tabs.md](tabs.md)). With "terminal", the pane is the shell that Herdr started in the folder. With "claude" or "codex", Heidrun renames the first tab after the command and starts the command in the first pane ([issue 379](https://github.com/heidrun-org/heidrun/issues/379)).
- The Needs you sidebar section shows the same list of workspaces, in the same order, with the same selection and the same drag and drop, but without the rename and the close ([needs_you_workspaces.md](../sidebars/needs_you_workspaces.md)).
- Two other ways to switch workspace: the command search with ⌘K, and the shortcut Option+Command+Up arrow or Option+Command+Down arrow.
- Heidrun saves the identifier of the selected workspace each time that the selection changes, in the option `selectedWorkspaceId` of the store `settings.ts`. At the next start, Heidrun selects this workspace again, with its last tab and its last pane. When this workspace does not exist any more, Heidrun selects the workspace that Herdr has focused, or the first workspace.

