# User interface of Heidrun: Git branch section of the status bar

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md), [status_bar.md](status_bar.md)
- Related issue: [issue 350](https://github.com/heidrun-org/heidrun/issues/350), [issue 348](https://github.com/heidrun-org/heidrun/issues/348)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md). The other status bar sections are in [status_bar.md](status_bar.md).

## Git branch section

- The Git branch status bar section has three click zones, from left to right. Each zone is a status bar section with its own rounded background ([issue #350](https://github.com/heidrun-org/heidrun/issues/350)).
  - The branch zone shows the Git icon, the branch name, and a star when the working folder has an uncommitted change. A click on it opens the branch picker.
  - The merge zone shows a turning-arrows icon (`arrow-repeat`), like "Synchronize Changes" of Visual Studio Code. See the section "Merge with the upstream branch" below.
  - The counts zone shows the commits to download, then the commits to upload. A click on it opens its information card, which lists the details of the Git repository.
- The zones touch each other: each side between two zones has 4 pixels of background, and the two outer sides have the 11 pixels of the other status bar sections. The text of the zones does not move. The three zones are one button group, as in Bootstrap: only the left corners of the branch zone and the right corners of the counts zone are round (6 pixels), and the corners where two zones touch are square, also in the hover background and in the open state.
- The branch picker is a card above the branch zone, 408 pixels wide. At the top it has a search field with the text "Select a branch to check out". Under it, the local branches, the most recently committed first. Each row shows the Git icon, the name of the branch, a check mark for the current branch, and the time of the last commit on the first line, then the author, the short hash, and the subject of the last commit on the second line.
- The card has no padding around the list: the separators between the rows touch the left and right borders of the card, and the scroll bar of the list touches the right border. Only the search field has space around it. The list scrolls inside the card when it is longer than 560 pixels, and the list is at most 60 percent of the window height.
- On the first line of each row, at the right end, just after the time, a button that is only the icon of GitHub (or GitLab) is always visible. It is a Bootstrap outline button with no border (classes `btn btn-outline theme-secondary border-0`). It opens the page of the branch on the forge, in the web browser, and does not check out the branch. The button is absent when the repository has no remote. The button is disabled, with the title "This branch is only on your computer: push it to see its page", when the branch is only local: this computer has no remote-tracking branch of that name, and the list of the remote repository (`git ls-remote`, command `git_remote_branches`) does not have it. That list is kept for one day, in memory and in the local storage (key `heidrun.gitRemoteBranches`), and is asked again after one day. When the remote repository cannot answer, an older list is used, and while nothing is known the button stays enabled. The address is `<repository>/tree/<branch>` on GitHub and `<repository>/-/tree/<branch>` on GitLab. The rows have 10 pixels of space above and below, and 4 pixels between their two lines. While the picker is open, the title of the zone does not show over it. The page does not exist for a branch that was never pushed.
- The search field keeps the branches whose name, author, hash, or subject contains every word typed. The key Enter checks out the first branch of the list. The key Escape closes the picker.
- A click on a branch checks it out with `git switch`, closes the picker, and reads the Git status again. A click on the current branch only closes the picker.
- When Git refuses the checkout, for example because an uncommitted change would be overwritten, a message shows the text of Git, and the current branch does not change.
- Nothing reacts to the pointer that only moves over a zone, except the background. Visual Studio Code does the same.

### Merge with the upstream branch

- A click on the merge zone opens its information card and starts the merge ([issue #348](https://github.com/heidrun-org/heidrun/issues/348)). The next click, a click outside, or the key Escape closes the card. A click that closes the card does not start a second merge.
- The merge is the Tauri command `git_merge_upstream`: it fetches the upstream branch of the current branch (`git fetch --prune`), then merges it into the current branch (`git merge --no-edit`). It never pushes. The Git status is read again after it.
- The card is 408 pixels wide, like the cards of the usage of Claude and of Codex. In every sentence, the name of the upstream branch (for example `origin/dev_jerome`) is a link that opens the page of that branch on the forge, in the web browser, without the name of the remote in the address. When the repository has no known remote, the name is plain text.
- While the merge runs, a spinner replaces the icon, and the card says "Fetching and merging" with the name of the upstream branch. A second merge cannot start during this time.
- The card then shows one of these results: "Merged" (new commits came in), "Already up to date", or the number of files in conflict with the list of these files and the advice to fix them in the Source control sidebar section, then commit. When Git stops on conflicts, the merge stays open, as it does in a terminal.
- When Git refuses, for example because a change of the working folder would be overwritten, the card shows the message of Git in a red notice, and nothing changes.
- When the current branch has no upstream branch, the icon is faded to 35 percent, nothing starts, and the card says "This branch has no upstream branch. Push it first, so it has one."
