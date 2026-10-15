# User interface of Heidrun: Statistics window, tab "User activity"

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: user activity](../../glossary/user_activity.md), [Statistics window](statistics_window.md), [User activity sidebar section](../sidebars/user_activity.md), [layout.md](layout.md)
- Related issue: [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 486](https://github.com/heidrun-org/heidrun/issues/486), [issue 498](https://github.com/heidrun-org/heidrun/issues/498)

This file is a part of the rules of the Statistics window. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md). The tab has no person, because the user activity is the activity of the person in front of the computer.

## The three choices

- The tab "User activity" holds one histogram, and above it the choices. The tab never remembers a choice: the next opening of the window starts again with the last hour, its default slot length, and all the workspaces. Each choice draws the histogram again at once, from the records that the window already read, and never reads the data layer again.
- The time range: a Bootstrap radio button group (`btn-group` with `btn-check btn-outline theme-secondary` labels, as in the section "General" of the Settings window, for example the time format) with three buttons that have a text and a title (the tooltip), in this order: "Last hour", "Last day", and "Last week". "Last hour" is chosen when the window opens.
- The slot length: a radio button group of the same form, after the label "Slot length". The time range gives the buttons, from the shortest to the longest, and the slot length that is chosen when the time range changes:
  - Last hour: 1 minute, 5 minutes (chosen), 10 minutes.
  - Last day: 15 minutes, 30 minutes, 1 hour (chosen).
  - Last week: 1 hour, 6 hours, 1 day (chosen).
- Each change of the time range goes back to the slot length that this time range starts with. A change of the slot length never changes the time range.
- The workspaces: after the label "Workspaces", a group of Bootstrap checkbox buttons (`btn-check btn-outline theme-secondary` labels around an `input` of the type `checkbox`). The first button is "All workspaces". It is checked when every workspace is checked. A click on it checks every workspace, or, when every workspace is checked, unchecks them all. The other buttons are one for each workspace, sorted by name, all checked when the window opens, and a click on one shows or hides this workspace. The group wraps on a narrow window. The button of a workspace starts with a small dot of the color of this workspace in the histogram, and the dot stays while the workspace is hidden. The button "All workspaces" has no dot.
- A workspace is listed when it has a user activity record in the longest time range, or when it runs the active period now. The button of an open workspace has the label of the workspace in the left sidebar. The button of a workspace that is closed, for example a removed worktree, has the last part of its folder. When two workspaces have the same name, the folder follows the name in parentheses. The title of each button is the folder of the workspace.
- When there is no record and no active period, the tab shows no button of workspace. When the developer unchecks every workspace, the tab shows the text "No workspace is chosen…" in place of the histogram.
- The choice of the workspaces stays when the time range or the slot length changes.

## The histogram of the user activity time

- The histogram is drawn with Plotly.js, in the build `plotly.js-basic-dist-min`, which has only the bar chart. Plotly.js is loaded when the window opens, so the other windows do not pay for its size.
- The number of slots is the length of the time range divided by the slot length: 12 slots, 60, or 6 in the last hour, 24, 96, or 48 in the last day, and 7, 168, or 28 in the last week. A slot of minutes starts on a multiple of its length inside the hour, a slot of hours starts on a multiple of its length inside the day, and a slot of one day starts at midnight, in the time zone of the computer.
- The last slot is the slot of the current time. It is not finished, so it can hold less than the length of the slot. The time range starts at the start of the first slot, so the last hour is at most 60 minutes long, the last day is at most 24 hours long, and the last week is at most 7 days long.
- One bar is drawn for each slot. The height of a bar is the user activity time in this slot. A slot with no activity, or with no workspace, has a bar of height 0. Each bar is stacked: it has one part for each chosen workspace, from the bottom to the top in the order of the buttons, and the height of a part is the user activity time of this workspace in the slot. The height of the bar is the user activity time of all the chosen workspaces.
- Each workspace has one color, taken from its place in the list of buttons, which is sorted by name: the color 500 of the scales blue, orange, green, purple, red, teal, yellow, and pink of Bootstrap, then the list starts again. The color of a workspace never changes with the time range, the slot length, or the choice of the workspaces. A legend above the bars gives the name of each color, in the order of the buttons. A click on the legend does nothing, because the buttons choose the workspaces. The chart has no legend while no workspace is listed.
- The vertical axis starts at 0. A slot of 1 minute goes to 60 seconds. A slot of 5 minutes to 1 hour goes to the length of the slot, in minutes. A slot of 6 hours goes to 6 hours, in hours. A slot of 1 day is in hours, and its top follows the longest day.
- The horizontal axis shows the start of a slot when the slot starts at a multiple of a label step since midnight, so that the axis has at most 13 labels. The step is the shortest of 1, 5, 10, 15, 30, 60, 120, 180, 360, 720, and 1440 minutes that is a whole number of slots. A step of 1440 minutes labels each midnight with the weekday and the date. Any other step labels the start with the time of the clock, in the time format of the settings.
- The tooltip of a bar is an HTML popover of Bootstrap, not a tooltip of Plotly.js, which takes only a few tags. It shows while the pointer is over a bar, and it never takes the pointer. It sits on the side of the pointer that has room, so it stays inside the chart. Its first line gives the start and the end of the slot, or the day for a slot of 1 day. In the last week, the start of a slot that is shorter than 1 day also gives its day. The second line is the word "Total" and the user activity time in minutes and seconds, or in hours and minutes for a slot of 6 hours or of 1 day. When two or more workspaces are chosen, one row follows for each workspace that has time in the slot, with the dot of its color, its name, and its time in the same unit.
- The user activity time of a slot is the total length of the parts of the active periods that are inside the slot. An active period that crosses the limit between two slots is cut at the limit, and each part counts in its own slot. An active period that starts before the first slot is cut at the start of the first slot. A period never counts after the current time. The total of the bars is the same for every slot length of a time range.
- The active period that runs now has no user activity record yet. The histogram counts it from its start up to the current time, and only while the selected workspace, which runs the period, is checked.
- The chart follows the dark theme and the light theme, and it is drawn again when the theme or the language changes. It fills the width of the window, and it changes size when the window changes size. Plotly.js does not read the CSS functions `light-dark` and `color-mix`, so the component reads each color of the theme from a probe element, and a canvas turns it into `rgba(...)`.

## The code

- The calculation of the slots is the pure class `UserActivitySlots` in `packages/apps/web_frontend/src/lib/user_activity_slots.ts`. It has no clock and no timer: the caller gives the current time. It also holds the slot lengths and the choices of each time range.
- The list of the workspaces, the filter of the records, the color of each workspace, and the slots of each workspace are the pure class `UserActivityWorkspaces` in `lib/user_activity_workspaces.ts`.
- The tab is `components/UserActivityTab.vue`, and the chart is `components/UserActivityHistogram.vue`. The class `PlotlyLoader` in `lib/plotly_loader.ts` loads Plotly.js once.

## Tests

- `lib/user_activity_slots.test.ts` tests the slots of each time range and each slot length: no record, one active period inside one slot, one active period that crosses the limit between two slots, one active period that starts before the time range, the active period that runs now, the same total for every slot length, and the step of the labels. The test of the last day and of the last week uses the clock of the computer, so run it with another time zone to check the limits, for example `TZ=Asia/Kolkata`.
- `lib/user_activity_workspaces.test.ts` tests the list of the workspaces, their names, the filter of the records, their colors, and their slots.
- `components/UserActivityTab.test.ts` tests the three choices, the default slot length of each time range, the workspace buttons, the running active period, and the stacked bars (the parts, the colors, the dots, and the tooltip), with a replacement for Plotly.js, because jsdom cannot draw an SVG chart. `components/StatisticsModal.test.ts` tests the tab list and the default histogram.
