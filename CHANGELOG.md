# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Remember the selected workspace and reopen it at the next start ([#356](https://github.com/heidrun-org/heidrun/pull/356))
- Synchronize with the upstream branch from the status bar ([#354](https://github.com/heidrun-org/heidrun/pull/354))
- Switch Git branches from the status bar ([#352](https://github.com/heidrun-org/heidrun/pull/352))
- Add a Files section to the sidebar ([#351](https://github.com/heidrun-org/heidrun/pull/351))
- Set a default command for new tabs ([#330](https://github.com/heidrun-org/heidrun/pull/330))
- Add a setting to ask before closing a tab ([#310](https://github.com/heidrun-org/heidrun/pull/310))
- Add icons to sidebar sections and allow each sidebar to collapse to an icon bar ([#308](https://github.com/heidrun-org/heidrun/pull/308))
- Add a Source control section to the sidebar ([#307](https://github.com/heidrun-org/heidrun/pull/307))
- Add colored status dots and quota badges to the status item menu ([#287](https://github.com/heidrun-org/heidrun/pull/287))
- Add language model extraction for dynamic topics ([#273](https://github.com/heidrun-org/heidrun/pull/273))
- Add dynamic topics to the Chats sidebar section ([#268](https://github.com/heidrun-org/heidrun/pull/268))
- Add a sort menu to the Chats sidebar section ([#263](https://github.com/heidrun-org/heidrun/pull/263))
- Add goat sounds to the About window, splash screen, and empty tab screen ([#258](https://github.com/heidrun-org/heidrun/pull/258))
- Add the Chats sidebar section ([#259](https://github.com/heidrun-org/heidrun/pull/259))
- Add the `--no-splash-screen` command line option ([#255](https://github.com/heidrun-org/heidrun/pull/255))
- Move the workspace selector to the status bar ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Show a baby goat, the application name, and a joke with a firework on an empty tab screen ([#185](https://github.com/heidrun-org/heidrun/pull/185))
- Add a setting to show or hide the status item in the macOS menu bar ([#170](https://github.com/heidrun-org/heidrun/pull/170))
- Show agent states and the Claude quota in the macOS menu bar ([#164](https://github.com/heidrun-org/heidrun/pull/164))
- Add a window for creating custom scripts ([#151](https://github.com/heidrun-org/heidrun/pull/151))
- Add a window for agent information ([#148](https://github.com/heidrun-org/heidrun/pull/148))
- Add a menu to the top bar and split skills into two windows ([#144](https://github.com/heidrun-org/heidrun/pull/144))
- Add an Agents section to Settings ([#123](https://github.com/heidrun-org/heidrun/pull/123))
- Add a command line tool and library for coding agents ([#116](https://github.com/heidrun-org/heidrun/pull/116))
- Allow dropping an image onto a terminal to paste it ([#115](https://github.com/heidrun-org/heidrun/pull/115))

### Changed
- Make the selected pane easier to identify ([#347](https://github.com/heidrun-org/heidrun/pull/347))
- Make Command+T start the default command in a new tab ([#346](https://github.com/heidrun-org/heidrun/pull/346))
- Use theme colors for notifications in light mode ([#344](https://github.com/heidrun-org/heidrun/pull/344))
- Change the Working status color from blue to violet ([#339](https://github.com/heidrun-org/heidrun/pull/339))
- Ask before closing tabs, workspaces, and notes using separate settings ([#334](https://github.com/heidrun-org/heidrun/pull/334), [#310](https://github.com/heidrun-org/heidrun/pull/310))
- Make panes meet the viewport border and each other, with square corners and a thin dividing line ([#329](https://github.com/heidrun-org/heidrun/pull/329))
- Give status bar sections a rounded background on hover ([#327](https://github.com/heidrun-org/heidrun/pull/327))
- Use the colors of Visual Studio Code Dark Modern and Light Modern ([#321](https://github.com/heidrun-org/heidrun/pull/321))
- Collapse sidebars instead of hiding them, while keeping the gap next to a collapsed sidebar ([#325](https://github.com/heidrun-org/heidrun/pull/325), [#318](https://github.com/heidrun-org/heidrun/pull/318), [#308](https://github.com/heidrun-org/heidrun/pull/308))
- Make the Workspace status bar information card wider and scroll long folder paths ([#322](https://github.com/heidrun-org/heidrun/pull/322))
- Make the information cards for Claude and Codex usage 20 percent wider ([#291](https://github.com/heidrun-org/heidrun/pull/291))
- Replace the Git sidebar section with a Source control section and rename “To handle” to “Needs you” ([#307](https://github.com/heidrun-org/heidrun/pull/307), [#306](https://github.com/heidrun-org/heidrun/pull/306))
- Open quota cards from the status item menu and show the menu in black ([#294](https://github.com/heidrun-org/heidrun/pull/294))
- Replace the Dynamic topics help text with two information cards ([#267](https://github.com/heidrun-org/heidrun/pull/267))
- Move the “Needs you” sidebar section from the left sidebar to the right sidebar ([#253](https://github.com/heidrun-org/heidrun/pull/253))
- Reorder tabs, workspaces, and notes with the mouse while keeping image drops available ([#249](https://github.com/heidrun-org/heidrun/pull/249))
- Move the workspace selector into the status bar and show its list in an information card ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Make the workspace button and tabs larger, and add icons to them ([#241](https://github.com/heidrun-org/heidrun/pull/241))
- Make the whole tab clickable and move its close button closer to the right edge ([#236](https://github.com/heidrun-org/heidrun/pull/236))
- Restore the window position and size at the next start ([#227](https://github.com/heidrun-org/heidrun/pull/227))
- Show a pinned note in its own workspace ([#221](https://github.com/heidrun-org/heidrun/pull/221))
- Keep a pinned pane the same width in every tab ([#218](https://github.com/heidrun-org/heidrun/pull/218))
- Center the Shortcuts window and other dialog windows ([#216](https://github.com/heidrun-org/heidrun/pull/216))
- Make both sidebars hide completely ([#215](https://github.com/heidrun-org/heidrun/pull/215))
- Add the workspace button at the left end of the tab bar and create the tab bar above the viewport ([#213](https://github.com/heidrun-org/heidrun/pull/213), [#212](https://github.com/heidrun-org/heidrun/pull/212))
- Move the Scripts and Git sidebar sections to the left sidebar ([#208](https://github.com/heidrun-org/heidrun/pull/208))
- Open status bar information cards with a click ([#194](https://github.com/heidrun-org/heidrun/pull/194))
- Rename prompt templates to macros ([#192](https://github.com/heidrun-org/heidrun/pull/192))
- Show empty tabs in light colors when using the light theme ([#187](https://github.com/heidrun-org/heidrun/pull/187))
- Reduce the space between panes from 8 to 5 pixels ([#180](https://github.com/heidrun-org/heidrun/pull/180))
- Name shell panes after their folder or running command ([#171](https://github.com/heidrun-org/heidrun/pull/171))
- Show only the quotas of enabled coding agents in the status bar ([#140](https://github.com/heidrun-org/heidrun/pull/140))
- Link installed skills when an agent is enabled later ([#128](https://github.com/heidrun-org/heidrun/pull/128))
- Manage skill files with the skills.sh service ([#124](https://github.com/heidrun-org/heidrun/pull/124))
- Apply font size zoom to the whole window ([#111](https://github.com/heidrun-org/heidrun/pull/111))

### Removed
- Remove the status bar section showing counts of blocked, working, and done agents ([#288](https://github.com/heidrun-org/heidrun/pull/288))
- Remove the Pane section from the right sidebar ([#282](https://github.com/heidrun-org/heidrun/pull/282))
- Remove the application name from the window title bar ([#159](https://github.com/heidrun-org/heidrun/pull/159))
- Remove the splash screen subtitle ([#155](https://github.com/heidrun-org/heidrun/pull/155))

### Fixed
- Fix narrow pane names running underneath their buttons ([#153](https://github.com/heidrun-org/heidrun/pull/153))
- Fix the black window appearing before the splash screen ([#145](https://github.com/heidrun-org/heidrun/pull/145))
- Fix terminal blinking and shifted lines while resizing the window ([#158](https://github.com/heidrun-org/heidrun/pull/158))

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
