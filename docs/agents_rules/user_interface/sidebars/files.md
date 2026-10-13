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

- The Files sidebar section only reads files. It has no button to create, rename, move, delete, or edit a file.
- The header stays at the top of the sidebar section while the rows scroll under it. It holds the title "Files" and two buttons that show only an icon: "Refresh", and "More options" (three vertical dots).
- The menu of "More options" has three groups, and a check mark shows the choice that is on. "Indentation": Small (12 pixels for each level), Medium (20 pixels, the default), Large (28 pixels). "Row height": Compact (24 pixels), Comfortable (30 pixels, the default). "Indent guides": Show (the default), Hide. The choices are saved in the settings `filesPanelIndent`, `filesPanelRowHeight`, and `filesPanelIndentGuides`.
- The folder tree uses the same list of files as the Files window: the files that Git tracks, the new files, and the folders that `.gitignore` ignores only when the option to show ignored files is on, as folders that do not unfold. Folders come first, then files, in alphabetical order. Each row shows, from the left: one indent guide for each level of depth, a slot for the arrow of a folder, the icon of a folder or of the kind of the file, the name, and for a changed file a colored status letter at the right. A file keeps the slot of the arrow empty, so the names of the files and of the folders of one level line up. The icons are grey, not colored.
- A click on a folder folds or unfolds it. The folds stay when the developer changes the sidebar section.
- A click on a file opens the file in the large Git window, the same window as the Source control sidebar section. The large Git window shows a file that has no change as a whole file, with no diff, and disables the buttons "Diff" and "Side by side" for it.
- The tree is read again when the repository changes, when the number of changed files changes, and at a click on "Refresh".
- The icon `folder2` of the Files sidebar section is the first icon of the sidebar icon bar of the left sidebar, above the Scripts icon. It shows no number.
