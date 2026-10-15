# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.7] - 2026-10-15

### Added

- Install a skill from the web address of its folder on GitHub. ([#507](https://github.com/heidrun-org/heidrun/pull/507))
- View developer activity in the Statistics window, with selectable slot lengths and workspaces, stacked bars, a legend, and chart information cards. ([#481](https://github.com/heidrun-org/heidrun/pull/481), [#491](https://github.com/heidrun-org/heidrun/pull/491), [#505](https://github.com/heidrun-org/heidrun/pull/505))
- View one person’s work in the Statistics window. ([#485](https://github.com/heidrun-org/heidrun/pull/485))
- Show a usage wheel for a pane’s context window, with an information card. ([#479](https://github.com/heidrun-org/heidrun/pull/479))
- Show tokens and estimated cost for each chat in the Past chats sidebar section. ([#447](https://github.com/heidrun-org/heidrun/pull/447))
- Detect developer activity and show it in the User activity sidebar section. ([#454](https://github.com/heidrun-org/heidrun/pull/454))
- Fetch the remote repository in the background, with a setting for the delay. ([#434](https://github.com/heidrun-org/heidrun/pull/434))
- Add an option to show ignored files in the File explorer sidebar section. ([#437](https://github.com/heidrun-org/heidrun/pull/437))
- Add saved searches to the Code hosting sidebar section. ([#377](https://github.com/heidrun-org/heidrun/pull/377))
- Add the Code hosting sidebar section. ([#373](https://github.com/heidrun-org/heidrun/pull/373))
- Add back and forward navigation through the history of focused panes. ([#387](https://github.com/heidrun-org/heidrun/pull/387))
- Start the default command when splitting a pane or adding a tab. ([#478](https://github.com/heidrun-org/heidrun/pull/478))
- Select a new workspace immediately and run the default command in its first tab. ([#421](https://github.com/heidrun-org/heidrun/pull/421))
- Show the list of workspaces at the bottom of the Needs you sidebar section. ([#418](https://github.com/heidrun-org/heidrun/pull/418))
- Show the date and time of the build in the About Heidrun window. ([#477](https://github.com/heidrun-org/heidrun/pull/477))
- Add a window with a Three.js demo to the desktop application. ([#399](https://github.com/heidrun-org/heidrun/pull/399))
- Add a video explaining how to pronounce Heiðrún to the website’s About page. ([#402](https://github.com/heidrun-org/heidrun/pull/402))
- Add context menus to file and folder rows in the File explorer sidebar section. ([#385](https://github.com/heidrun-org/heidrun/pull/385), [#445](https://github.com/heidrun-org/heidrun/pull/445))
- Add the option to enable or disable dynamic topics in Settings. ([#429](https://github.com/heidrun-org/heidrun/pull/429))

### Changed

- Keep terminals in open tabs running when switching tabs. ([#496](https://github.com/heidrun-org/heidrun/pull/496))
- Update the Statistics window with tab buttons in a thin title bar and helpful tooltips. ([#497](https://github.com/heidrun-org/heidrun/pull/497))
- Use theme colors for the Needs you cards and show a question mark after abbreviated times with the exact time in its tooltip. ([#502](https://github.com/heidrun-org/heidrun/pull/502))
- Make the User and Workspace choices look like the Language choice. ([#492](https://github.com/heidrun-org/heidrun/pull/492))
- Move the large Git window controls to the title bar and rename “Reading” to “Preview.” ([#448](https://github.com/heidrun-org/heidrun/pull/448))
- Give the Clipboard and Needs you sidebar sections titles like the other sidebar sections. ([#433](https://github.com/heidrun-org/heidrun/pull/433))
- Replace the “All workspaces” check box in the Clipboard sidebar section with a switch. ([#436](https://github.com/heidrun-org/heidrun/pull/436))
- Rename the Files sidebar section to File explorer, Notes to Clipboard, Scripts to Launchers, and Chats to Past chats. ([#437](https://github.com/heidrun-org/heidrun/pull/437), [#436](https://github.com/heidrun-org/heidrun/pull/436), [#431](https://github.com/heidrun-org/heidrun/pull/431), [#426](https://github.com/heidrun-org/heidrun/pull/426))
- Rebuild the Settings window with Bootstrap components. ([#416](https://github.com/heidrun-org/heidrun/pull/416))
- Show each chat’s worktree name in its summary. ([#413](https://github.com/heidrun-org/heidrun/pull/413))
- Show a clear message when another client holds a terminal, and give each worktree its own Herdr session. ([#484](https://github.com/heidrun-org/heidrun/pull/484))
- Read the models and effort levels from each coding agent’s tool, and add Antigravity to the coding agent list. ([#393](https://github.com/heidrun-org/heidrun/pull/393), [#395](https://github.com/heidrun-org/heidrun/pull/395))
- Import scripts from any repository `package.json` and add the current working directory to the Command line kind. ([#388](https://github.com/heidrun-org/heidrun/pull/388))
- Improve the Code hosting sidebar section’s logo, buttons, and saved search windows. ([#384](https://github.com/heidrun-org/heidrun/pull/384))
- Rebuild the Scripts sidebar section and the Create a custom script window. ([#382](https://github.com/heidrun-org/heidrun/pull/382))
- Add a Flux Lines background to the public website homepage. ([#439](https://github.com/heidrun-org/heidrun/pull/439))
- Remove the fixed maximum width of the left and right sidebars. ([#397](https://github.com/heidrun-org/heidrun/pull/397))

### Removed

- Remove Visual Studio Code variables from the Herdr server environment. ([#480](https://github.com/heidrun-org/heidrun/pull/480))

### Fixed

- Prevent closing the last tab in a workspace and show an error notification. ([#427](https://github.com/heidrun-org/heidrun/pull/427))
- Show folders ignored by Git only once in the File explorer sidebar section. ([#444](https://github.com/heidrun-org/heidrun/pull/444))

## [0.2.5] - 2026-10-13

### Added

- Add a Files section to the sidebar. ([#351](https://github.com/heidrun-org/heidrun/pull/351))
- Add a setting to choose the default command for new tabs. ([#330](https://github.com/heidrun-org/heidrun/pull/330))
- Add a setting to ask before closing tabs, workspaces, or the application. ([#310](https://github.com/heidrun-org/heidrun/pull/310), [#334](https://github.com/heidrun-org/heidrun/pull/334))
- Add icons to sidebar sections and let each sidebar collapse to an icon bar. ([#308](https://github.com/heidrun-org/heidrun/pull/308))
- Add a Source control section to the sidebar. ([#307](https://github.com/heidrun-org/heidrun/pull/307))
- Add dynamic topics to the Chats section, with a language model extraction method. ([#268](https://github.com/heidrun-org/heidrun/pull/268), [#273](https://github.com/heidrun-org/heidrun/pull/273))
- Add a sort menu to the Chats section. ([#263](https://github.com/heidrun-org/heidrun/pull/263))
- Add goat sounds to the About window, splash screen, and empty tab screen. ([#258](https://github.com/heidrun-org/heidrun/pull/258))
- Add the Chats section to the sidebar. ([#259](https://github.com/heidrun-org/heidrun/pull/259))
- Add a command line option to start without the splash screen. ([#255](https://github.com/heidrun-org/heidrun/pull/255))
- Add a workspace selector to the status bar. ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Add a tab bar and a workspace button. ([#213](https://github.com/heidrun-org/heidrun/pull/213), [#212](https://github.com/heidrun-org/heidrun/pull/212))
- Add a setting to show or hide the status item in the macOS menu bar. ([#170](https://github.com/heidrun-org/heidrun/pull/170))
- Add a macOS menu bar item showing agent states and Claude quota. ([#164](https://github.com/heidrun-org/heidrun/pull/164))
- Add a custom script creation window. ([#151](https://github.com/heidrun-org/heidrun/pull/151))
- Add an Agents information window. ([#148](https://github.com/heidrun-org/heidrun/pull/148))
- Add a top bar menu for settings and skills. ([#144](https://github.com/heidrun-org/heidrun/pull/144))
- Add an Agents section to Settings. ([#123](https://github.com/heidrun-org/heidrun/pull/123))
- Add a tool for coding agents that can be used as a library or from the command line. ([#116](https://github.com/heidrun-org/heidrun/pull/116))
- Add support for pasting an image by dropping it onto a terminal. ([#115](https://github.com/heidrun-org/heidrun/pull/115))
- Add a command to create a disk image for release. ([#110](https://github.com/heidrun-org/heidrun/pull/110))

### Changed

- Remember the selected workspace and restore it when Heidrun starts. ([#356](https://github.com/heidrun-org/heidrun/pull/356))
- Synchronize with the upstream branch from the status bar and switch Git branches there. ([#354](https://github.com/heidrun-org/heidrun/pull/354), [#352](https://github.com/heidrun-org/heidrun/pull/352))
- Make the selected pane easier to see. ([#347](https://github.com/heidrun-org/heidrun/pull/347))
- Make Command+T start the default command in a new tab. ([#346](https://github.com/heidrun-org/heidrun/pull/346))
- Use the theme colors for notifications in light mode. ([#344](https://github.com/heidrun-org/heidrun/pull/344))
- Change the Working status color from blue to violet. ([#339](https://github.com/heidrun-org/heidrun/pull/339))
- Update the public website shortcuts page. ([#358](https://github.com/heidrun-org/heidrun/pull/358))
- Make panes meet the viewport border and each other, with thin lines and square corners. ([#329](https://github.com/heidrun-org/heidrun/pull/329))
- Give each status bar section a rounded background when the pointer is over it. ([#327](https://github.com/heidrun-org/heidrun/pull/327))
- Use the colors of Visual Studio Code Dark Modern and Light Modern. ([#321](https://github.com/heidrun-org/heidrun/pull/321))
- Make the Workspace information card wider and scroll long folder paths. ([#322](https://github.com/heidrun-org/heidrun/pull/322))
- Add the Heidrun favicon to the public website. ([#319](https://github.com/heidrun-org/heidrun/pull/319))
- Collapse sidebars instead of hiding them. ([#318](https://github.com/heidrun-org/heidrun/pull/318))
- Make the status item narrower so macOS does not hide it behind the camera notch. ([#314](https://github.com/heidrun-org/heidrun/pull/314))
- Make the Claude and Codex usage information cards wider. ([#291](https://github.com/heidrun-org/heidrun/pull/291))
- Show colored status dots and quota badges in the status item menu. ([#287](https://github.com/heidrun-org/heidrun/pull/287))
- Show pinned notes in their own workspace and keep pinned panes the same width across tabs. ([#221](https://github.com/heidrun-org/heidrun/pull/221), [#218](https://github.com/heidrun-org/heidrun/pull/218))
- Center the Shortcuts window. ([#216](https://github.com/heidrun-org/heidrun/pull/216))
- Make both sidebars hide completely. ([#215](https://github.com/heidrun-org/heidrun/pull/215))
- Create the workspace button at the left end of the tab bar. ([#213](https://github.com/heidrun-org/heidrun/pull/213))
- Let users reorder tabs, workspaces, and notes with the mouse while keeping image drops working. ([#249](https://github.com/heidrun-org/heidrun/pull/249))
- Move the workspace selector into the status bar and show its list in an information card. ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Make the workspace button and tabs larger, with icons. ([#241](https://github.com/heidrun-org/heidrun/pull/241))
- Make the whole tab clickable and move its close button closer to the right edge. ([#236](https://github.com/heidrun-org/heidrun/pull/236))
- Show a pinned pane at the same width in every tab. ([#218](https://github.com/heidrun-org/heidrun/pull/218))
- Show a baby goat, Heidrun's name, and a joke with a firework on an empty tab screen. ([#185](https://github.com/heidrun-org/heidrun/pull/185))
- Replace the application icon with a goat that is clear at small sizes, and use it as the website favicon. ([#183](https://github.com/heidrun-org/heidrun/pull/183))
- Resize panes by height and in two directions from a corner. ([#177](https://github.com/heidrun-org/heidrun/pull/177))
- Name a shell pane after its folder or running command. ([#171](https://github.com/heidrun-org/heidrun/pull/171))
- Show only the quotas for coding agents enabled in Settings. ([#140](https://github.com/heidrun-org/heidrun/pull/140))
- Link installed skills when an agent is enabled later. ([#128](https://github.com/heidrun-org/heidrun/pull/128))
- Drop the title bar name and splash screen subtitle. ([#159](https://github.com/heidrun-org/heidrun/pull/159), [#155](https://github.com/heidrun-org/heidrun/pull/155))
- Apply font size zoom to the whole window. ([#111](https://github.com/heidrun-org/heidrun/pull/111))

### Removed

- Remove the status bar section showing the number of agents by state. ([#288](https://github.com/heidrun-org/heidrun/pull/288))
- Remove the Pane section from the right sidebar. ([#282](https://github.com/heidrun-org/heidrun/pull/282))
- Remove unused text after the layout redesign. ([#222](https://github.com/heidrun-org/heidrun/pull/222))

### Fixed

- Increase the timeout for each web frontend test to 30 seconds. ([#362](https://github.com/heidrun-org/heidrun/pull/362))
- Keep the gap between the viewport and a collapsed sidebar. ([#325](https://github.com/heidrun-org/heidrun/pull/325))
- Keep the status item menu text black and open quota cards. ([#294](https://github.com/heidrun-org/heidrun/pull/294))
- Show the empty tab screen in light colors when using the light theme. ([#187](https://github.com/heidrun-org/heidrun/pull/187))
- Prevent terminal text from blinking or shifting while the window is resized. ([#158](https://github.com/heidrun-org/heidrun/pull/158))
- Keep pane names clear of the buttons in narrow panes. ([#153](https://github.com/heidrun-org/heidrun/pull/153))
- Remove the black window that appeared before the splash screen. ([#145](https://github.com/heidrun-org/heidrun/pull/145))

## [0.2.0] - 2026-10-10

### Added

- See Git information and agent activity in the status bar, with hover cards for more details. ([#87](https://github.com/heidrun-org/heidrun/pull/87), [#85](https://github.com/heidrun-org/heidrun/pull/85))
- See Codex quota information and usage pace, and configure general settings. ([#83](https://github.com/heidrun-org/heidrun/pull/83))
- Reorder panes in the sidebar by dragging their rows. ([#91](https://github.com/heidrun-org/heidrun/pull/91))
- Rename workspaces from a menu in each workspace row. ([#96](https://github.com/heidrun-org/heidrun/pull/96))
- Add English and French interface languages. ([#26](https://github.com/heidrun-org/heidrun/pull/26))
- Choose a template from the pane header when creating a pane. ([#58](https://github.com/heidrun-org/heidrun/pull/58))
- Show a splash screen and an image in the About window. ([#56](https://github.com/heidrun-org/heidrun/pull/56))
- Add a public website for Heidrun. ([#70](https://github.com/heidrun-org/heidrun/pull/70))
- Add light and dark themes. ([#24](https://github.com/heidrun-org/heidrun/pull/24))
- Add a tooltip to every clickable element. ([#23](https://github.com/heidrun-org/heidrun/pull/23))
- Add the MIT license. ([#12](https://github.com/heidrun-org/heidrun/pull/12), [#13](https://github.com/heidrun-org/heidrun/pull/13))

### Changed

- Open workspace status cards from anywhere in their section, and keep them open longer. ([#106](https://github.com/heidrun-org/heidrun/pull/106))
- Replace pane tabs with rows that include a menu and close button. ([#47](https://github.com/heidrun-org/heidrun/pull/47))
- Combine the top bar buttons into one Settings window with a sidebar. ([#61](https://github.com/heidrun-org/heidrun/pull/61))
- Use a single plus icon to create panes, remember entered values, and confirm with Enter. ([#63](https://github.com/heidrun-org/heidrun/pull/63))
- Show pane status until a row is hovered, then show its buttons. ([#49](https://github.com/heidrun-org/heidrun/pull/49))
- Replace the New agent and New terminal buttons with icons in the Panes header. ([#43](https://github.com/heidrun-org/heidrun/pull/43))
- Use the system language for application menu labels. ([#59](https://github.com/heidrun-org/heidrun/pull/59))
- Rename the application to Heidrun and migrate existing data. ([#53](https://github.com/heidrun-org/heidrun/pull/53), [#52](https://github.com/heidrun-org/heidrun/pull/52))
- Use Bootstrap Icons throughout the application, including a pin for keep-beside. ([#19](https://github.com/heidrun-org/heidrun/pull/19), [#20](https://github.com/heidrun-org/heidrun/pull/20))
- Move the project configuration to `.heidrun/config.json`, checked with a schema. ([#67](https://github.com/heidrun-org/heidrun/pull/67))
- Use identical plus buttons in the sidebar. ([#65](https://github.com/heidrun-org/heidrun/pull/65))

### Removed

- Remove the GitLab issue creation script and issue templates. ([#39](https://github.com/heidrun-org/heidrun/pull/39), [#18](https://github.com/heidrun-org/heidrun/pull/18))
- Remove the `docs/issues` folder. ([#36](https://github.com/heidrun-org/heidrun/pull/36))

### Fixed

- Make the Codex input area readable in light mode. ([#101](https://github.com/heidrun-org/heidrun/pull/101))
- Show a star after the branch name when the working folder has uncommitted changes. ([#89](https://github.com/heidrun-org/heidrun/pull/89))
- Show only one pane rename field, where the rename started. ([#95](https://github.com/heidrun-org/heidrun/pull/95))
- Use soft border colours around the terminal pane in the light theme. ([#28](https://github.com/heidrun-org/heidrun/pull/28))
- Show a spinner on the Refresh button while it refreshes. ([#25](https://github.com/heidrun-org/heidrun/pull/25))
- Show a modal dialog to confirm closing the application. ([#29](https://github.com/heidrun-org/heidrun/pull/29))
- Make the scroll bar of the terminal panel no longer white. ([#108](https://github.com/heidrun-org/heidrun/pull/108))
