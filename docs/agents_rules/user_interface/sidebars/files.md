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
- The header holds the title "Files" and one button that shows only an icon: "Refresh".
- The folder tree uses the same list of files as the Files window: the files that Git tracks, the new files, and the folders that `.gitignore` ignores only when the option to show ignored files is on, as folders that do not unfold. Folders come first, then files, in alphabetical order. Each row shows an icon, the name, and for a changed file a colored status letter at the right.
- A click on a folder folds or unfolds it. The folds stay when the developer changes the sidebar section.
- A click on a file opens the file in the large Git window, the same window as the Source control sidebar section. The large Git window shows a file that has no change as a whole file, with no diff, and disables the buttons "Diff" and "Side by side" for it.
- The tree is read again when the repository changes, when the number of changed files changes, and at a click on "Refresh".
- The icon `folder2` of the Files sidebar section in the sidebar icon bar shows no number.
