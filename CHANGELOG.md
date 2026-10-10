# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add a command line tool and library for running coding agents. ([#116](https://github.com/heidrun-org/heidrun/pull/116))
- Add support for dropping an image on a terminal to paste it. ([#115](https://github.com/heidrun-org/heidrun/pull/115))
- Add a script to generate the change log from merged pull requests. ([#117](https://github.com/heidrun-org/heidrun/pull/117))
- Add a script to create a disk image for a release. ([#110](https://github.com/heidrun-org/heidrun/pull/110))

### Changed

- Apply font size zoom to the whole window. ([#111](https://github.com/heidrun-org/heidrun/pull/111))
- Rename the `desktop-tauri` and `web-frontend` packages to `desktop_tauri` and `web_frontend`. ([#112](https://github.com/heidrun-org/heidrun/pull/112))

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
