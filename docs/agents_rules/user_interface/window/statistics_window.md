# User interface of Heidrun: Statistics window

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: user activity](../../glossary/user_activity.md), [User activity sidebar section](../sidebars/user_activity.md), [layout.md](layout.md), [Tab "User activity"](statistics_user_activity.md), [Tab "Work of one person"](statistics_person_work.md), [Glossary of Heidrun: status bar and HTML tooltip](../../glossary/status_bar.md)
- Related issue: [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 474](https://github.com/heidrun-org/heidrun/issues/474), [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 486](https://github.com/heidrun-org/heidrun/issues/486), [issue 494](https://github.com/heidrun-org/heidrun/issues/494)

This file is a part of the rules of the window of Heidrun. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md).

## The item in the More menu

- The More menu has the item "Statistics", with the icon `bar-chart` and a title (the tooltip). The item is in the first group of the menu, after the item "Agents information" and before the first separator line.
- A click on the item opens the Statistics window and closes the More menu.

## The window

- The Statistics window is as large as the large Git window: 94% of the width and 90% of the height of the application window. It has a title bar with the title "Statistics", the buttons of its tabs, and a close button, like the other windows built with Bootstrap. The key Escape and a click outside the window close it.
- The title bar is thin. It has the title "Statistics" at the left, and at the right the buttons of the tabs, then the close button. The three parts are centered vertically. The padding of the title bar is `--dialog-header-padding: 0.375rem 0.75rem`, and the close button is small (the property `isSmall` of `DialogCloseButton`). There is no row of tabs under the title bar, so the tab uses all the height.
- The buttons of the tabs are a Bootstrap button group (`btn-group`) of small outline buttons (`btn btn-sm btn-outline theme-secondary`), with the same look as the radio button groups of the tab, and with no rounded pill. The chosen button has the class `active` and the fill of a checked radio button: the application shows no pressed look on a `btn`, so an own rule of the component gives the fill. The roles follow the page [Tab](https://getbootstrap.com/docs/6.0/components/tab/) of Bootstrap: each tab is a `button` with `role="tab"`, `aria-selected`, and `aria-controls`, the group has `role="tablist"` and an `aria-label`, and each tab pane has `role="tabpanel"` and `aria-labelledby`. Vue switches the tabs, because the application does not load the JavaScript of Bootstrap. The window has two tabs: "User activity" ([statistics_user_activity.md](statistics_user_activity.md)), and "Work of one person" ([statistics_person_work.md](statistics_person_work.md)). The tab "User activity" is selected when the window opens.
- Each button of a tab has an HTML tooltip, the component `HtmlTooltip` (the word is defined in [glossary/status_bar.md](../../glossary/status_bar.md)). The tooltip opens below the button when the pointer is over it, and when the button has the keyboard focus. It closes when the pointer or the keyboard focus leaves. The tooltip is a child of the element `body`, so it is never a sibling of a button of the group, and the component draws no element around the button. While it is open, the button has `aria-describedby`. The text of the tooltip tells the kind of statistic of the tab: a bold title, one sentence, and a list. The text is written in HTML in the translation keys `statisticsModal.userActivityTabTooltip` and `statisticsModal.personWorkTabTooltip`, in every language, and the component cleans it with DOMPurify before it shows it. The tooltip uses the Bootstrap part `tooltip`, which is in `bootstrap_parts.scss`.
- The tab fills the height of the window: the choices are at the top, and the histogram takes the rest of the height, with at least 240 pixels.
- The window uses Bootstrap components and theme variables, and no custom CSS. The only own rules are the dark layer behind the window, as in the window "Three.js demo", the spacing of the paragraphs and of the list inside a tooltip, and the fill of the chosen tab button.
- The window reads the user activity data again each time that it opens. It does not read it again while it stays open. The tab "Work of one person" reads the Git history when it is shown for the first time, and the AI cost when the developer chooses it for the first time.
- While the data is read, the window shows the text "Reading the user activity…" with a busy wheel (the Bootstrap `spinner-border spinner-sm`) before it. The two loading messages of the tab "Work of one person" have the busy wheel too. When the data cannot be read, it shows the error in a Bootstrap alert, and no chart.
- Every text of the window is in every language, and `pnpm --filter web_frontend check:translations` shows no key of the window as missing.

## The tab "User activity"

- The tab "User activity" holds the histogram of the user activity time, and three choices: the time range, the slot length, and the workspaces. Its rules are in [statistics_user_activity.md](statistics_user_activity.md).

## Where the data comes from

- The histogram reads the user activity records through the data layer, with the command `user_activity_records_in_range` of the file `packages/apps/desktop_tauri/src/user_activity.rs`. The command copies the new lines of the file `user_activity.jsonl` into the SQLite file of the data layer with the mode `update` of the package `data_layer_user_activity`, then reads the records whose active period overlaps the time range with a read-only query. The window asks once, from the start of the oldest slot of any choice of the time range and of the slot length, which is a little less than 7 days before now, and cuts the same records again for each choice. The times of the records that it gives are in UTC.
- The command holds the same lock as the write of a record, so it never reads half a line.
- The calculation of the slots, the tab, and the chart are listed in [statistics_user_activity.md](statistics_user_activity.md).

## Tests

- `components/MoreMenu.test.ts` tests that the item "Statistics" shows in the first group, and that a click on it opens the Statistics window.
- `components/StatisticsModal.test.ts` tests that the tab list is a button group in the title bar, the thin title bar and its order, the tab that is selected, the second tab, and the HTML tooltip of each tab button, with a replacement for Plotly.js.
- `components/HtmlTooltip.test.ts` tests that the tooltip opens on the pointer and on the keyboard focus, closes when they leave, shows its HTML, removes a script and an event handler, draws no element around the button, puts the tooltip in the element `body`, and gives each tooltip its own identifier. `components/DialogCloseButton.test.ts` tests the small X. `bootstrap_parts.test.ts` tests the Bootstrap part `tooltip`. The tests of the tab "User activity" are in [statistics_user_activity.md](statistics_user_activity.md).
- The Rust tests of the module `user_activity` test the command with a real SQLite file in a temporary folder.
