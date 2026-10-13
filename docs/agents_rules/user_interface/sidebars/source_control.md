# User interface of Heidrun: source control

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Source control

The Source control sidebar section copies the source control view of VS Code ([issue #305](https://github.com/heidrun-org/heidrun/issues/305)).

- The Source control sidebar section shows only the local Git repository. It shows nothing of GitHub or GitLab.
- The header holds the title "Source Control" and three buttons that show only an icon: "Commit" (a check mark), "Refresh", and "More actions" (three dots: Pull, Push, Fetch, and the large Git window).
- The commit message box fills the full width. Its placeholder text names the current branch: `Message (⌘Enter to commit on "dev_jerome")`. The keys ⌘Enter make the commit. The sparkle button at its right asks a coding agent (`codex`, else `claude`) to write the message from the diff of the staged files, or of every change when nothing is staged.
- The blue commit button fills the full width. The arrow at its right opens a dropdown menu: "Commit", "Commit and push", and "Commit (amend the last commit)". When no file is staged, a confirmation asks to stage every change and commit it. After a commit, the message box is empty.
- The group "Staged Changes" shows only when a file is staged. The group "Changes" holds the files that are not staged, the new files, and the files in conflict. A file staged then changed again is in the two groups. Each group header has an arrow that folds the group, the title, and a badge with the number of files.
- The buttons of a group header and of a file line show only while the pointer is over the header or the line. On "Staged Changes": Stash, View the changes, Unstage all. On "Changes": Stash, View the changes, Discard all, Stage all. On a file line of "Changes": Open the file, Discard, Stage. On a file line of "Staged Changes": Open the file, Unstage.
- A file line shows the icon of the kind of the file, the file name, its folders in grey (nothing for a file at the root of the repository), and a colored status letter at the right: M modified, A added, D deleted, R renamed, U untracked, ! conflict. Its tooltip gives the full path and the status in words. A click on the line opens the diff of the file in the large Git window.
- A discard asks for a confirmation first, because the changes cannot come back. A file that Git does not know is deleted.
- The icon of the Source control sidebar section in the sidebar icon bar shows the number of changed files.

