# User interface of Heidrun: Statistics window

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: user activity](../../glossary/user_activity.md), [User activity sidebar section](../sidebars/user_activity.md), [layout.md](layout.md), [Tab "User activity"](statistics_user_activity.md), [Tab "Work of one person"](statistics_person_work.md)
- Related issue: [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 474](https://github.com/heidrun-org/heidrun/issues/474), [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 486](https://github.com/heidrun-org/heidrun/issues/486)

This file is a part of the rules of the window of Heidrun. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md).

## The item in the More menu

- The More menu has the item "Statistics", with the icon `bar-chart` and a title (the tooltip). The item is in the first group of the menu, after the item "Agents information" and before the first separator line.
- A click on the item opens the Statistics window and closes the More menu.

## The window

- The Statistics window is as large as the large Git window: 94% of the width and 90% of the height of the application window. It has a title bar with the title "Statistics" and a close button, like the other windows built with Bootstrap. The key Escape and a click outside the window close it.
- Under the title bar, the window has a Bootstrap tab list (`nav nav-tabs`), as the page [Tab](https://getbootstrap.com/docs/6.0/components/tab/) of Bootstrap describes it: each tab is a `button` with `role="tab"`, `aria-selected`, and `aria-controls`, and each tab pane has `role="tabpanel"` and `aria-labelledby`. Vue switches the tabs, because the application does not load the JavaScript of Bootstrap. The window has two tabs: "User activity" ([statistics_user_activity.md](statistics_user_activity.md)), and "Work of one person" ([statistics_person_work.md](statistics_person_work.md)). The tab "User activity" is selected when the window opens.
- The tab fills the height of the window: the choices are at the top, and the histogram takes the rest of the height, with at least 240 pixels.
- The window uses Bootstrap components and theme variables, and no custom CSS. The only own rule is the dark layer behind the window, as in the window "Three.js demo".
- The window reads the user activity data again each time that it opens. It does not read it again while it stays open. The tab "Work of one person" reads the Git history when it is shown for the first time, and the AI cost when the developer chooses it for the first time.
- While the data is read, the window shows the text "Reading the user activity…". When the data cannot be read, it shows the error in a Bootstrap alert, and no chart.
- Every text of the window is in every language, and `pnpm --filter web_frontend check:translations` shows no key of the window as missing.

## The tab "User activity"

- The tab "User activity" holds the histogram of the user activity time, and three choices: the time range, the slot length, and the workspaces. Its rules are in [statistics_user_activity.md](statistics_user_activity.md).

## Where the data comes from

- The histogram reads the user activity records through the data layer, with the command `user_activity_records_in_range` of the file `packages/apps/desktop_tauri/src/user_activity.rs`. The command copies the new lines of the file `user_activity.jsonl` into the SQLite file of the data layer with the mode `update` of the package `data_layer_user_activity`, then reads the records whose active period overlaps the time range with a read-only query. The window asks once, from the start of the oldest slot of any choice of the time range and of the slot length, which is a little less than 7 days before now, and cuts the same records again for each choice. The times of the records that it gives are in UTC.
- The command holds the same lock as the write of a record, so it never reads half a line.
- The calculation of the slots, the tab, and the chart are listed in [statistics_user_activity.md](statistics_user_activity.md).

## Tests

- `components/MoreMenu.test.ts` tests that the item "Statistics" shows in the first group, and that a click on it opens the Statistics window.
- `components/StatisticsModal.test.ts` tests the tab list, the tab that is selected, and the second tab, with a replacement for Plotly.js. The tests of the tab "User activity" are in [statistics_user_activity.md](statistics_user_activity.md).
- The Rust tests of the module `user_activity` test the command with a real SQLite file in a temporary folder.
