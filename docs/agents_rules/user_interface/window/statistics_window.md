# User interface of Heidrun: Statistics window

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: user activity](../../glossary/user_activity.md), [User activity sidebar section](../sidebars/user_activity.md), [layout.md](layout.md)
- Related issue: [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 474](https://github.com/heidrun-org/heidrun/issues/474)

This file is a part of the rules of the window of Heidrun. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md).

## The item in the More menu

- The More menu has the item "Statistics", with the icon `bar-chart` and a title (the tooltip). The item is in the first group of the menu, after the item "Agents information" and before the first separator line.
- A click on the item opens the Statistics window and closes the More menu.

## The window

- The Statistics window is as large as the large Git window: 94% of the width and 90% of the height of the application window. It has a title bar with the title "Statistics" and a close button, like the other windows built with Bootstrap. The key Escape and a click outside the window close it.
- Under the title bar, the window has a Bootstrap tab list (`nav nav-tabs`), as the page [Tab](https://getbootstrap.com/docs/6.0/components/tab/) of Bootstrap describes it: each tab is a `button` with `role="tab"`, `aria-selected`, and `aria-controls`, and each tab pane has `role="tabpanel"` and `aria-labelledby`. Vue switches the tabs, because the application does not load the JavaScript of Bootstrap. The window has one tab for now: "User activity". The tab "User activity" is selected when the window opens.
- The tab fills the height of the window: the radio button group is at the top, and the histogram takes the rest of the height, with at least 240 pixels.
- The window uses Bootstrap components and theme variables, and no custom CSS. The only own rule is the dark layer behind the window, as in the window "Three.js demo".
- The window reads the data again each time that it opens. It does not read the data again while it stays open.
- While the data is read, the window shows the text "Reading the user activity…". When the data cannot be read, it shows the error in a Bootstrap alert, and no chart.
- Every text of the window is in every language, and `pnpm --filter web_frontend check:translations` shows no key of the window as missing.

## The histogram of the user activity time

- The tab "User activity" holds one histogram, and above it a Bootstrap radio button group (`btn-group` with `btn-check btn-outline theme-secondary` labels, as in the section "General" of the Settings window, for example the time format) that chooses its time range. The group has three buttons with a text and a title (the tooltip), in this order: "Last hour", "Last day", and "Last week". The window opens with "Last hour" chosen, and it never remembers the choice: the next opening starts with "Last hour" again.
- A click on a button draws the histogram of this time range at once, from the records that the window already read. The window does not read the data again.
- The histogram is drawn with Plotly.js, in the build `plotly.js-basic-dist-min`, which has only the bar chart. Plotly.js is loaded when the window opens, so the other windows do not pay for its size.
- The last hour has twelve slots of five minutes. Each slot starts on a multiple of five minutes of the clock, for example 14:05 to 14:10. The vertical axis goes from 0 to 5 minutes. The horizontal axis shows the start time of each slot, in the time format of the settings.
- The last day has twenty-four slots of one hour. Each slot starts at a full hour, for example 14:00 to 15:00. The vertical axis goes from 0 to 60 minutes. The horizontal axis shows the start time of each slot.
- The last week has seven slots of one day. Each slot starts at midnight, in the time zone of the computer. The vertical axis is in hours, it starts at 0, and its top follows the longest day. The horizontal axis shows the weekday and the date of each slot.
- In every histogram, the last slot is the slot of the current time. It is not finished, so it can hold less than the length of the slot. The time range starts at the start of the first slot, so the last hour is between 55 and 60 minutes long, the last day is between 23 and 24 hours long, and the last week is between 6 and 7 days long.
- One bar is drawn for each slot. The height of a bar is the user activity time in this slot. A slot with no activity has a bar of height 0.
- The user activity time of a slot is the total length of the parts of the active periods that are inside the slot. An active period that crosses the limit between two slots is cut at the limit, and each part counts in its own slot. An active period that starts before the first slot is cut at the start of the first slot. A period never counts after the current time.
- The active period that runs now has no user activity record yet. The histogram counts it from its start up to the current time.
- The first version has one color, and it adds the time of all the workspaces together. A bar with one color for each workspace is a later step.
- The tooltip of a bar in the last hour and in the last day gives the start and the end of the slot, and the user activity time in minutes and seconds. The tooltip of a bar in the last week gives the day, and the user activity time in hours and minutes.
- The chart follows the dark theme and the light theme, and it is drawn again when the theme or the language changes. It fills the width of the window, and it changes size when the window changes size. Plotly.js does not read the CSS functions `light-dark` and `color-mix`, so the component reads each color of the theme from a probe element, and a canvas turns it into `rgba(...)`.

## Where the data comes from

- The histogram reads the user activity records through the data layer, with the command `user_activity_records_in_range` of the file `packages/apps/desktop_tauri/src/user_activity.rs`. The command copies the new lines of the file `user_activity.jsonl` into the SQLite file of the data layer with the mode `update` of the package `data_layer_user_activity`, then reads the records whose active period overlaps the time range with a read-only query. The window asks once, for the time range of the last week, and cuts the same records into the slots of the three time ranges. The times of the records that it gives are in UTC.
- The command holds the same lock as the write of a record, so it never reads half a line.
- The calculation of the slots is the pure class `UserActivitySlots` in `packages/apps/web_frontend/src/lib/user_activity_slots.ts`. It has no clock and no timer: the caller gives the current time. The chart is one Vue component, `UserActivityHistogram.vue`, in the folder `components`, and the class `PlotlyLoader` in `lib/plotly_loader.ts` loads Plotly.js once.

## Tests

- `lib/user_activity_slots.test.ts` tests the slots of the three ranges: no record, one active period inside one slot, one active period that crosses the limit between two slots, one active period that starts before the time range, and the active period that runs now. The test of the last day and of the last week uses the clock of the computer, so run it with another time zone to check the limits, for example `TZ=Asia/Kolkata`.
- `components/MoreMenu.test.ts` tests that the item "Statistics" shows in the first group, and that a click on it opens the Statistics window.
- `components/StatisticsModal.test.ts` tests the tab list, the radio button group, the histogram of each time range, and its vertical axis, with a replacement for Plotly.js, because jsdom cannot draw an SVG chart.
- The Rust tests of the module `user_activity` test the command with a real SQLite file in a temporary folder.
