# User interface of Heidrun: status bar

- Created: 13 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md)
- Related issue: [issue 290](https://github.com/heidrun-org/heidrun/issues/290), [issue 293](https://github.com/heidrun-org/heidrun/issues/293), [issue 303](https://github.com/heidrun-org/heidrun/issues/303), [issue 311](https://github.com/heidrun-org/heidrun/issues/311), [issue 324](https://github.com/heidrun-org/heidrun/issues/324), [issue 440](https://github.com/heidrun-org/heidrun/issues/440), [issue 475](https://github.com/heidrun-org/heidrun/issues/475)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## Status bar

- The status bar sits at the bottom of the window, over the whole width.
- Each status bar section shows one piece of information, for example the selected workspace, the usage of Claude, the usage of Codex, the Git branch, and the connection to Herdr. The number of agents that are blocked, working, or done is not in the status bar: the top right corner of the window already shows it.
- A click on a status bar section opens its information card above the section.
- Each status bar section looks like a button of the status bar of Visual Studio Code: while the mouse pointer is over it, and while its information card is open, it has a rounded background (6 pixels radius), white at 12 percent strength in the dark theme and black at 12 percent strength in the light theme. The background leaves 6 pixels of the status bar above and below it. The three components of the status bar sections share the class `status-section` of the file `styles.css` ([issue #324](https://github.com/heidrun-org/heidrun/issues/324)).
- The ring of the usage of Claude and the ring of the usage of Codex have the same track as the usage wheel in the header of a pane: the part of the ring that is not filled is drawn in the faint color (`--faint`), so that the whole ring shows against the status bar in the dark theme and in the light theme ([issue 475](https://github.com/heidrun-org/heidrun/issues/475)).
- The information card of the usage of Claude, the information card of the usage of Codex, and the information card of the Workspace status bar section are 408 pixels wide, which is 20 percent more than the 340 pixels of the other information cards of the status bar ([issue #290](https://github.com/heidrun-org/heidrun/issues/290), [issue #303](https://github.com/heidrun-org/heidrun/issues/303)).

The Git branch section has its own file, [status_bar_git.md](status_bar_git.md).

## Menu of the status item

- The status item sits in the macOS menu bar. A click on it opens a menu. From top to bottom, the menu has the line "Open Heidrun", then the three sections "Blocked", "Finished", and "Working". The menu ends with the last line of the section "Working", with no separator after it. The menu shows no quota ([issue #311](https://github.com/heidrun-org/heidrun/issues/311)).
- The picture of the status item shows only the icon of Heidrun and the three discs "Blocked", "Finished", and "Working", with little empty space around them. A disc without agent is gray inside, the same gray for the three statuses, and its border keeps the color of the status (red, green, or violet) and is thicker than the border of a disc with agents, so that it stays visible on the blue menu bar. The color of the status "Working" is violet, not blue, because blue is hard to see on the blue menu bar, above all on the lighter pill that macOS draws behind the status item while the pointer is over it. The same violet colors the dot before each working agent in the menu ([issue #313](https://github.com/heidrun-org/heidrun/issues/313)). The picture shows no quota: the status bar of the Heidrun window shows it. On a MacBook with a camera notch, macOS hides, with no message, the menu bar icons that do not fit to the right of the notch, so the picture stays as narrow as possible ([issue #311](https://github.com/heidrun-org/heidrun/issues/311)).
- The three section titles show the normal black text with the normal weight, like "Open Heidrun" and the names of the agents. They are not gray and not bold. The lines "None" are gray.
- macOS draws every disabled menu item in gray, and no text color changes this. So the section titles are enabled menu items, and the lines "None" are the only disabled lines. The cost is that macOS turns an enabled line blue while the pointer is over it ([issue #293](https://github.com/heidrun-org/heidrun/issues/293)).
- A click on "Open Heidrun" or on a section title shows the main window. A click on an agent shows the main window and selects the pane of the agent.
- While the environment variable `HEIDRUN_STATUS_ITEM_USER_ACTIVITY` is set, the icon of Heidrun in the picture is faded while the user is not active in front of Heidrun, and normal while the user is active. The user is active when the Heidrun window is in front and a keyboard action or a mouse action happened less than 5 seconds ago. This is a way to see by eye that the detection of the activity of the user works. It is off when the variable is not set ([issue #440](https://github.com/heidrun-org/heidrun/issues/440)).

