# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add dynamic topics to the Chats sidebar and extract topics with a language model. ([#268](https://github.com/heidrun-org/heidrun/pull/268), [#273](https://github.com/heidrun-org/heidrun/pull/273))
- Add a sort menu to the Chats sidebar. ([#263](https://github.com/heidrun-org/heidrun/pull/263))
- Add goat sounds in the About window, on the splash screen, and on the empty tab screen. ([#258](https://github.com/heidrun-org/heidrun/pull/258))
- Add the Chats sidebar section. ([#259](https://github.com/heidrun-org/heidrun/pull/259))
- Add an option to start Heidrun without the splash screen. ([#255](https://github.com/heidrun-org/heidrun/pull/255))
- Add a workspace selector to the status bar. ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Add a tab bar and a workspace button. ([#212](https://github.com/heidrun-org/heidrun/pull/212), [#213](https://github.com/heidrun-org/heidrun/pull/213))
- Add a document about Norse mythology and developers using artificial intelligence. ([#191](https://github.com/heidrun-org/heidrun/pull/191))
- Add a goat application icon and web page icon. ([#183](https://github.com/heidrun-org/heidrun/pull/183))
- Add a setting to show or hide the status item in the macOS menu bar. ([#170](https://github.com/heidrun-org/heidrun/pull/170))
- Add the status item to the macOS menu bar, showing agent states and the Claude quota. ([#164](https://github.com/heidrun-org/heidrun/pull/164))
- Add a baby goat, its name, and a joke with a firework to the empty tab screen. ([#185](https://github.com/heidrun-org/heidrun/pull/185))
- Add a window for creating custom scripts. ([#151](https://github.com/heidrun-org/heidrun/pull/151))
- Add a menu to the top bar and separate the skills into two windows. ([#144](https://github.com/heidrun-org/heidrun/pull/144))
- Add an Agents section to Settings. ([#123](https://github.com/heidrun-org/heidrun/pull/123))
- Add a command line tool and library for coding agents. ([#116](https://github.com/heidrun-org/heidrun/pull/116))
- Add the ability to paste an image into a terminal by dropping it there. ([#115](https://github.com/heidrun-org/heidrun/pull/115))
- Add a release script for disk images. ([#110](https://github.com/heidrun-org/heidrun/pull/110))

### Changed
- Make Claude and Codex usage cards wider. ([#291](https://github.com/heidrun-org/heidrun/pull/291))
- Show colored status dots and quota badges in the status item menu. ([#287](https://github.com/heidrun-org/heidrun/pull/287))
- Replace the help text on the Dynamic topics page with information cards. ([#267](https://github.com/heidrun-org/heidrun/pull/267))
- Move the To handle section from the left sidebar to the right sidebar. ([#214](https://github.com/heidrun-org/heidrun/pull/214), [#253](https://github.com/heidrun-org/heidrun/pull/253))
- Save the last state of each setting option. ([#256](https://github.com/heidrun-org/heidrun/pull/256))
- Allow tabs, workspaces, and notes to be reordered with the mouse while dragging images into terminals. ([#249](https://github.com/heidrun-org/heidrun/pull/249))
- Move the workspace selector to the status bar and show its list in an information card. ([#244](https://github.com/heidrun-org/heidrun/pull/244))
- Make the workspace button and tabs larger, add icons, and make the whole tab clickable. ([#241](https://github.com/heidrun-org/heidrun/pull/241), [#236](https://github.com/heidrun-org/heidrun/pull/236))
- Show pinned notes in their own workspace and keep pinned panes the same width across tabs. ([#221](https://github.com/heidrun-org/heidrun/pull/221), [#218](https://github.com/heidrun-org/heidrun/pull/218))
- Make both sidebars hide completely. ([#215](https://github.com/heidrun-org/heidrun/pull/215))
- Open the four information cards above the status bar when clicked. ([#194](https://github.com/heidrun-org/heidrun/pull/194))
- Rename prompt templates to macros. ([#192](https://github.com/heidrun-org/heidrun/pull/192))
- Show the empty tab screen in light colors when using the light theme. ([#187](https://github.com/heidrun-org/heidrun/pull/187))
- Use a separate named Herdr session for Heidrun and stop the session when Heidrun quits. ([#182](https://github.com/heidrun-org/heidrun/pull/182))
- Name shell panes after their folder or running command. ([#171](https://github.com/heidrun-org/heidrun/pull/171))
- Show quotas in the status bar only for coding agents enabled in Settings. ([#140](https://github.com/heidrun-org/heidrun/pull/140))
- Link installed skills when an agent is enabled later. ([#128](https://github.com/heidrun-org/heidrun/pull/128))
- Manage skill files with the skills.sh service. ([#124](https://github.com/heidrun-org/heidrun/pull/124))
- Zoom the whole window when changing the font size. ([#111](https://github.com/heidrun-org/heidrun/pull/111))

### Removed
- Remove the agent count section from the status bar. ([#288](https://github.com/heidrun-org/heidrun/pull/288))
- Remove the Pane section from the right sidebar. ([#282](https://github.com/heidrun-org/heidrun/pull/282))
- Remove the unused text and update documents after the layout redesign. ([#222](https://github.com/heidrun-org/heidrun/pull/222))
- Remove the Heidrun name from the window title bar. ([#159](https://github.com/heidrun-org/heidrun/pull/159))
- Remove the splash screen subtitle. ([#155](https://github.com/heidrun-org/heidrun/pull/155))

### Fixed
- Show the status item menu in black and open quota cards. ([#294](https://github.com/heidrun-org/heidrun/pull/294))
- Restore the window position and size when Heidrun starts. ([#227](https://github.com/heidrun-org/heidrun/pull/227))
- Center the Shortcuts window. ([#216](https://github.com/heidrun-org/heidrun/pull/216))
- Show the workspace button at the left end of the tab bar. ([#213](https://github.com/heidrun-org/heidrun/pull/213))
- Show the splash screen without a black window beforehand. ([#145](https://github.com/heidrun-org/heidrun/pull/145))
- Keep narrow terminal pane names clear of the buttons. ([#153](https://github.com/heidrun-org/heidrun/pull/153))
- Stop terminal text from blinking or shifting when the window is resized. ([#158](https://github.com/heidrun-org/heidrun/pull/158))
- Show a four-arrow cursor when dragging a corner between panes. ([#179](https://github.com/heidrun-org/heidrun/pull/179))

### Security

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
