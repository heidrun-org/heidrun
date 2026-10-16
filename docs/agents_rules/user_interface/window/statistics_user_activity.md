# User interface of Heidrun: Statistics window, tab "User activity"

- Created: 15 October 2026
- Last updated: 16 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: user activity](../../glossary/user_activity.md), [Statistics window](statistics_window.md), [User activity sidebar section](../sidebars/user_activity.md), [layout.md](layout.md), [Stacked bars](statistics_user_activity_stacked_bars.md)
- Related issue: [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 486](https://github.com/heidrun-org/heidrun/issues/486), [issue 498](https://github.com/heidrun-org/heidrun/issues/498), [issue 552](https://github.com/heidrun-org/heidrun/issues/552)

This file is a part of the rules of the Statistics window. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md). The tab has no person, because the user activity is the activity of the person in front of the computer.

## The three choices

- The tab "User activity" holds one histogram, and above it the choices. The tab never remembers a choice: the next opening of the window starts again with the last day, its default slot length, and all the workspaces. Each choice draws the histogram again at once, from the records that the window already read, and never reads the data layer again.
- The time range: a Bootstrap radio button group (`btn-group` with `btn-check btn-outline theme-secondary` labels, as in the section "General" of the Settings window, for example the time format) with three buttons that have a text and a title (the tooltip), in this order: "Last day", "Last week", and "Last month". "Last day" is chosen when the window opens. The time range "Last hour" does not exist.
- The slot length: a radio button group of the same form, after the label "Slot length". The time range gives the buttons, from the shortest to the longest, and the slot length that is chosen when the time range changes:
  - Last day: 15 minutes, 30 minutes, 1 hour (chosen).
  - Last week: 1 hour, 6 hours, 1 day (chosen).
  - Last month: 6 hours, 1 day (chosen).
- Each change of the time range goes back to the slot length that this time range starts with. A change of the slot length never changes the time range.
- The workspaces: after the label "Workspaces", a group of Bootstrap checkbox buttons (`btn-check btn-outline theme-secondary` labels around an `input` of the type `checkbox`). The first button is "All workspaces". It is checked when every workspace is checked. A click on it checks every workspace, or, when every workspace is checked, unchecks them all. The other buttons are one for each workspace, sorted by name, all checked when the window opens, and a click on one shows or hides this workspace. The group wraps on a narrow window. The button of a workspace starts with a small dot of its color ([statistics_user_activity_stacked_bars.md](statistics_user_activity_stacked_bars.md)).
- A workspace is listed when it has a user activity record in the longest time range, or when it runs the active period now. The button of an open workspace has the label of the workspace in the left sidebar. The button of a workspace that is closed, for example a removed worktree, has the last part of its folder. When two workspaces have the same name, the folder follows the name in parentheses. The title of each button is the folder of the workspace.
- When there is no record and no active period, the tab shows no button of workspace. When the developer unchecks every workspace, the tab shows the text "No workspace is chosen…" in place of the histogram.
- The choice of the workspaces stays when the time range or the slot length changes.

## The histogram of the user activity time

- The histogram is drawn with Plotly.js, in the build `plotly.js-basic-dist-min`, which has only the bar chart. Plotly.js is loaded when the window opens, so the other windows do not pay for its size.
- The number of slots is the length of the time range divided by the slot length: 24, 96, or 48 in the last day, 7, 168, or 28 in the last week, and 30 or 120 in the last month. The last month is 30 days long. A slot of minutes starts on a multiple of its length inside the hour, a slot of hours starts on a multiple of its length inside the day, and a slot of one day starts at midnight, in the time zone of the computer.
- The last slot is the slot of the current time. It is not finished, so it can hold less than the length of the slot. The time range starts at the start of the first slot, so the last day is at most 24 hours long, the last week is at most 7 days long, and the last month is at most 30 days long.
- One bar is drawn for each slot. The height of a bar is the user activity time in this slot. A slot with no activity has a bar of height 0. Each bar is stacked by workspace, with a legend and a chart information card: the rules are in [statistics_user_activity_stacked_bars.md](statistics_user_activity_stacked_bars.md) and in [statistics_charts.md](statistics_charts.md).
- The vertical axis starts at 0. A slot of 15 minutes to 1 hour goes to the length of the slot, in minutes. A slot of 6 hours goes to 6 hours, in hours. A slot of 1 day is in hours, and its top follows the longest day.
- The horizontal axis shows the start of a slot when the slot starts at a multiple of a label step since midnight, so that the axis has at most 13 labels. The step is the shortest of 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, and 4320 minutes that is a whole number of slots. A step of 1440 minutes labels each midnight with the weekday and the date. A step of 4320 minutes, which is 3 days, labels every third midnight, counted back from the midnight of the last slot, so the last month has 10 labels. Any other step labels the start with the time of the clock, in the time format of the settings.
- The user activity time of a slot is the total length of the parts of the active periods that are inside the slot. An active period that crosses the limit between two slots is cut at the limit, and each part counts in its own slot. An active period that starts before the first slot is cut at the start of the first slot. A period never counts after the current time. The total of the bars is the same for every slot length of a time range.
- The active period that runs now has no user activity record yet. The histogram counts it from its start up to the current time, and only while the selected workspace, which runs the period, is checked.
- The chart follows the dark theme and the light theme, and it is drawn again when the theme or the language changes. It fills the width of the window, and it changes size when the window changes size. Plotly.js does not read the CSS functions `light-dark` and `color-mix`, so the component reads each color of the theme from a probe element, and a canvas turns it into `rgba(...)`.

## The code

- The calculation of the slots is the pure class `UserActivitySlots` in `packages/apps/web_frontend/src/lib/user_activity_slots.ts`. It has no clock and no timer: the caller gives the current time. It also holds the slot lengths and the choices of each time range.
- The list of the workspaces and the filter of the records are the pure class `UserActivityWorkspaces` in `lib/user_activity_workspaces.ts`. The classes of the stacked bars are in [statistics_user_activity_stacked_bars.md](statistics_user_activity_stacked_bars.md).
- The tab is `components/UserActivityTab.vue`, and the chart is `components/UserActivityHistogram.vue`. The class `PlotlyLoader` in `lib/plotly_loader.ts` loads Plotly.js once.

## Tests

- `lib/user_activity_slots.test.ts` tests the slots of each time range and each slot length: no record, one active period inside one slot, one active period that crosses the limit between two slots, one active period that starts before the time range, the active period that runs now, the same total for every slot length, and the step and the place of the labels. The test of the last day, of the last week, and of the last month uses the clock of the computer, so run it with another time zone to check the limits, for example `TZ=Asia/Kolkata`.
- `lib/user_activity_workspaces.test.ts` tests the list of the workspaces, their names, and the filter of the records.
- `components/UserActivityTab.test.ts` tests the three choices, the default slot length of each time range, the workspace buttons, and the running active period, with a replacement for Plotly.js, because jsdom cannot draw an SVG chart. `components/StatisticsModal.test.ts` tests the tab list and the default histogram.
