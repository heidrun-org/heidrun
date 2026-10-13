# User interface of Heidrun: status bar

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)
- Related issue: [issue 290](https://github.com/heidrun-org/heidrun/issues/290), [issue 293](https://github.com/heidrun-org/heidrun/issues/293), [issue 303](https://github.com/heidrun-org/heidrun/issues/303), [issue 311](https://github.com/heidrun-org/heidrun/issues/311), [issue 324](https://github.com/heidrun-org/heidrun/issues/324), [issue 350](https://github.com/heidrun-org/heidrun/issues/350)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Status bar

- The status bar sits at the bottom of the window, over the whole width.
- Each status bar section shows one piece of information, for example the selected workspace, the usage of Claude, the usage of Codex, the Git branch, and the connection to Herdr. The number of agents that are blocked, working, or done is not in the status bar: the top right corner of the window already shows it.
- A click on a status bar section opens its information card above the section.
- Each status bar section looks like a button of the status bar of Visual Studio Code: while the mouse pointer is over it, and while its information card is open, it has a rounded background (6 pixels radius), white at 12 percent strength in the dark theme and black at 12 percent strength in the light theme. The background leaves 6 pixels of the status bar above and below it. The three components of the status bar sections share the class `status-section` of the file `styles.css` ([issue #324](https://github.com/heidrun-org/heidrun/issues/324)).
- The information card of the usage of Claude, the information card of the usage of Codex, and the information card of the Workspace status bar section are 408 pixels wide, which is 20 percent more than the 340 pixels of the other information cards of the status bar ([issue #290](https://github.com/heidrun-org/heidrun/issues/290), [issue #303](https://github.com/heidrun-org/heidrun/issues/303)).

## Git branch section

- The Git branch status bar section has two click zones, from left to right. Each zone is a status bar section with its own rounded background ([issue #350](https://github.com/heidrun-org/heidrun/issues/350)).
  - The branch zone shows the Git icon, the branch name, and a star when the working folder has an uncommitted change. A click on it opens the branch picker.
  - The counts zone shows the commits to download, then the commits to upload. A click on it opens its information card, which lists the details of the Git repository.
- The two zones touch each other: the side between them has 4 pixels of background, and the two outer sides have the 11 pixels of the other status bar sections. The text of the zones does not move.
- The branch picker is a card above the branch zone, 408 pixels wide. At the top it has a search field with the text "Select a branch to check out". Under it, the local branches, the most recently committed first. Each row shows the Git icon, the name of the branch, a check mark for the current branch, and the time of the last commit on the first line, then the author, the short hash, and the subject of the last commit on the second line.
- The card has no padding around the list: the separators between the rows touch the left and right borders of the card, and the scroll bar of the list touches the right border. Only the search field has space around it. The list scrolls inside the card when it is longer than 400 pixels.
- On the first line of each row, at the right end, a button that is only the icon of GitHub (or GitLab), with no border, appears while the pointer is over the row, or while the keyboard focus is on it, and opens the page of the branch on the forge, in the web browser, and does not check out the branch. The button is absent when the repository has no remote. The address is `<repository>/tree/<branch>` on GitHub and `<repository>/-/tree/<branch>` on GitLab. The rows have 10 pixels of space above and below, and 4 pixels between their two lines. While the picker is open, the title of the zone does not show over it. The page does not exist for a branch that was never pushed.
- The search field keeps the branches whose name, author, hash, or subject contains every word typed. The key Enter checks out the first branch of the list. The key Escape closes the picker.
- A click on a branch checks it out with `git switch`, closes the picker, and reads the Git status again. A click on the current branch only closes the picker.
- When Git refuses the checkout, for example because an uncommitted change would be overwritten, a message shows the text of Git, and the current branch does not change.
- Nothing reacts to the pointer that only moves over a zone, except the background. Visual Studio Code does the same.
- The turning-arrows icon that merges with the upstream branch is not part of this section yet: it is the subject of [issue 348](https://github.com/heidrun-org/heidrun/issues/348).

## Menu of the status item

- The status item sits in the macOS menu bar. A click on it opens a menu. From top to bottom, the menu has the line "Open Heidrun", then the three sections "Blocked", "Finished", and "Working". The menu ends with the last line of the section "Working", with no separator after it. The menu shows no quota ([issue #311](https://github.com/heidrun-org/heidrun/issues/311)).
- The picture of the status item shows only the icon of Heidrun and the three discs "Blocked", "Finished", and "Working", with little empty space around them. A disc without agent is gray inside, the same gray for the three statuses, and its border keeps the color of the status (red, green, or violet) and is thicker than the border of a disc with agents, so that it stays visible on the blue menu bar. The color of the status "Working" is violet, not blue, because blue is hard to see on the blue menu bar, above all on the lighter pill that macOS draws behind the status item while the pointer is over it. The same violet colors the dot before each working agent in the menu ([issue #313](https://github.com/heidrun-org/heidrun/issues/313)). The picture shows no quota: the status bar of the Heidrun window shows it. On a MacBook with a camera notch, macOS hides, with no message, the menu bar icons that do not fit to the right of the notch, so the picture stays as narrow as possible ([issue #311](https://github.com/heidrun-org/heidrun/issues/311)).
- The three section titles show the normal black text with the normal weight, like "Open Heidrun" and the names of the agents. They are not gray and not bold. The lines "None" are gray.
- macOS draws every disabled menu item in gray, and no text color changes this. So the section titles are enabled menu items, and the lines "None" are the only disabled lines. The cost is that macOS turns an enabled line blue while the pointer is over it ([issue #293](https://github.com/heidrun-org/heidrun/issues/293)).
- A click on "Open Heidrun" or on a section title shows the main window. A click on an agent shows the main window and selects the pane of the agent.

