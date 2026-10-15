# User interface of Heidrun: the list of workspaces of the Needs you sidebar section

- Created: 14 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md), [User interface of Heidrun: panes](../workspaces_tabs_and_panes/panes.md), [User interface of Heidrun: workspace](../workspaces_tabs_and_panes/workspace.md)
- Related issue: [issue 417](https://github.com/heidrun-org/heidrun/issues/417)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## The list of workspaces

- The Needs you sidebar section shows the list of all the workspaces at its bottom, under the cards of the agents. The list stays at the bottom edge of the sidebar section. When there are many cards, only the cards scroll. The list is never taller than 40 percent of the sidebar section, and it scrolls by itself above that height.
- From the top, the list has one separator line, the title "Workspaces", and one row for each workspace.
- A row shows the status dot and the name of the workspace, with the same dot as the list of the information card of the workspace status bar section: the color of the status of the agents, or a hollow ring when no agent runs. The row of the selected workspace has the selected background. A row is 40 pixels tall, and two rows have no space between them.
- The Git branch of the workspace sits at the right end of the row, in the secondary color, and a long branch is cut with an ellipsis (at most half of the row). The tooltip gives the whole name. A workspace without a Git branch shows no branch. The branch comes from `git.status` of the store `git.ts`, which Herdr reads every 10 seconds for the selected workspace and every 60 seconds for the others.
- The list touches the left, the right, and the bottom border of the sidebar section: the highlight of a row (under the pointer, and for the selected workspace) has no rounded corner, and the last row touches the bottom. Two rows have no space between them. Only the space of 12 pixels above the title stays.
- The title and the status dot are 14 pixels from the left border, which is the distance of the first character of the message "No agent is blocked…" (6 pixels of padding of the cards and 8 pixels of padding of the message). The test of `NeedsYouWorkspaces.test.ts` reads both numbers. The spacing is in the style block of `NeedsYouWorkspaces.vue`, because the Bootstrap parts of the application have no utility class for it.
- The rows have the same order as the list of the information card of the workspace status bar section, because both lists read `workspaces` of the store `session.ts`. The order is the order of Herdr: the number of the workspace. **The order never changes with the status dot or with the presence of an agent**: starting, blocking, finishing, or stopping an agent moves no row. Only the developer changes the order, by drag and drop or with the keyboard ([workspace.md](../workspaces_tabs_and_panes/workspace.md)).
- A click on a row selects the workspace. The information card of the workspace status bar section is not involved.
- The developer moves a row by drag and drop, with the same function `moveWorkspace` as the information card. A drop is saved in Herdr, so both lists show the new order. A drag does not select the workspace, and a short press is a click.
- The row has no button to rename or to close a workspace. The information card of the workspace status bar section keeps them.
- The list shows nothing when Herdr has no workspace.

## The section "Needs you" of the Settings window

- The Settings window has a section "Needs you", between the sections "Finished items" and "Notifications" (icon `layout-sidebar-inset-reverse`, because the icon `bell` is the icon of the section "Notifications" and of the Needs you sidebar section).
- The section has one Bootstrap switch, "Show the workspaces", and a help line under it. The switch is the option `showWorkspacesInNeedsYou` of the settings, and the default is on. The change applies at once, with no restart. When the switch is off, the Needs you sidebar section shows only the cards.
- The section is the component `SettingsNeedsYouSection.vue`, and the switch is a `SettingsSwitchRow.vue`.
