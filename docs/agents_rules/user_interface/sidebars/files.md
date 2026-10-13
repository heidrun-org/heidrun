# User interface of Heidrun: files

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)
- Related issue: [issue 349](https://github.com/heidrun-org/heidrun/issues/349)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Files

The Files sidebar section shows the whole folder tree of the Git repository of the selected workspace ([issue #349](https://github.com/heidrun-org/heidrun/issues/349)).

- The Files sidebar section changes nothing but one thing: it creates a new empty file or a new empty folder, because the developer asked for it ([issue #349](https://github.com/heidrun-org/heidrun/issues/349)). It has no button to rename, move, delete, or edit a file.
- The header stays at the top of the sidebar section while the rows scroll under it. It holds the title "Files" and five buttons that show only an icon, in this order: "New file", "New folder", "Refresh", "Collapse all folders" (the icon `dash-square`), and "More options" (three vertical dots).
- The menu of "More options" has three groups, and a check mark shows the choice that is on. "Indentation": Small (12 pixels for each level), Medium (20 pixels, the default), Large (28 pixels). "Row height": Compact (24 pixels), Comfortable (30 pixels, the default). "Indent guides": Show (the default), Hide. The choices are saved in the settings `filesPanelIndent`, `filesPanelRowHeight`, and `filesPanelIndentGuides`.
- The folder tree uses the same list of files as the Files window: the files that Git tracks, the new files, and the folders that `.gitignore` ignores only when the option to show ignored files is on, as folders that do not unfold. Folders come first, then files, in alphabetical order. Each row shows, from the left: one indent guide for each level of depth, a slot for the arrow of a folder, the icon of a folder or of the kind of the file, the name, and for a changed file a colored status letter at the right. A file keeps the slot of the arrow empty, so the names of the files and of the folders of one level line up. The icons are grey, not colored.
- "New file" and "New folder" show a name box inside the tree, as the first child of the target folder, indented as the children of that folder. The target folder is the selected folder, or the folder of the selected file, or the root of the repository when nothing is selected. The developer types only the name, and the name cannot contain the character `/`. The key Enter creates the file or the folder, and the key Escape, or a click outside the name box, cancels. A new file opens in the large Git window. A name that exists already gives an error message, and the name box stays open. The new file or the new folder becomes the selected row.
- Git does not list an empty folder, so the tree remembers the new empty folders that the developer created, until Heidrun restarts.
- "Collapse all folders" folds every folder. There is no button that unfolds every folder.
- A click on a file or on a folder selects its row. Only one row is selected. The selected row has a background that is darker than the background of a row under the pointer, and a blue line around it, as the selected row of VS Code. The selection belongs to the workspace: each workspace keeps its own selected row, and when the developer comes back to a workspace, its selected row is the one that the developer selected there, with the folders above it unfolded. The selection stays when the developer shows another sidebar section and comes back, and when the large Git window closes. A row under the pointer has a light background. A click on the empty space of the sidebar section, outside every row, selects nothing in the selected workspace only.
- A click on a folder folds or unfolds it. The folds stay when the developer changes the sidebar section.
- A click on a file opens the file in the large Git window, the same window as the Source control sidebar section. The large Git window shows a file that has no change as a whole file, with no diff, and disables the buttons "Diff" and "Side by side" for it.
- The tree is read again when the repository changes, when the number of changed files changes, and at a click on "Refresh".
- The icon `folder2` of the Files sidebar section is the first icon of the sidebar icon bar of the left sidebar, above the Scripts icon. It shows no number.
