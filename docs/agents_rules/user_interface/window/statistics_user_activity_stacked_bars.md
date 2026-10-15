# User interface of Heidrun: Statistics window, tab "User activity", the stacked bars

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: user activity](../../glossary/user_activity.md), [Tab "User activity"](statistics_user_activity.md), [Statistics window](statistics_window.md)
- Related issue: [issue 498](https://github.com/heidrun-org/heidrun/issues/498)

This file is a part of the rules of the tab "User activity". It gives the rules of the stacked bars of the histogram of the user activity time: the parts, the colors, the legend, and the tooltip. The other rules of the tab are in [statistics_user_activity.md](statistics_user_activity.md).

## The parts and the colors

- Each bar is stacked: it has one part for each chosen workspace, from the bottom to the top in the order of the buttons, and the height of a part is the user activity time of this workspace in the slot. The height of the bar is the user activity time of all the chosen workspaces. A slot with no workspace has a bar of height 0.
- Each workspace has one color, taken from its place in the list of buttons, which is sorted by name: the color 500 of the scales blue, orange, green, purple, red, teal, yellow, and pink of Bootstrap, then the list starts again. The color of a workspace never changes with the time range, the slot length, or the choice of the workspaces.
- The button of a workspace starts with a small dot of its color, and the dot stays while the workspace is hidden. The button "All workspaces" has no dot.
- A legend above the bars gives the name of each color, in the order of the buttons. A click on the legend does nothing, because the buttons choose the workspaces. The chart has no legend while no workspace is listed.

## The tooltip

- The tooltip of a bar is an HTML popover of Bootstrap, not a tooltip of Plotly.js, which takes only a few tags. It shows while the pointer is over a bar, and it never takes the pointer.
- It sits beside the column of the slot: at the right of a column in the left half of the chart, and at the left of a column in the right half. An arrow touches the column at the height of the pointer, so the developer sees which column the tooltip is about. The middle of the tooltip is at the height of the pointer, and the tooltip stays inside the chart.
- The first line gives the start and the end of the slot, or the day for a slot of 1 day. In the last week, the start of a slot that is shorter than 1 day also gives its day.
- The second line is the word "Total" and the user activity time in minutes and seconds, or in hours and minutes for a slot of 6 hours or of 1 day.
- When two or more workspaces are chosen, one row follows for each workspace that has time in the slot, with the dot of its color, its name, and its time in the same unit.

## The code

- The list of the workspaces, the color of each workspace, and the slots of each workspace are the pure class `UserActivityWorkspaces` in `packages/apps/web_frontend/src/lib/user_activity_workspaces.ts`.
- The place of the tooltip beside a column is the pure class `UserActivityTooltipPlacement` in `lib/user_activity_tooltip_placement.ts`, which also holds the margins of the chart and the gap between two columns.
- The legend, the parts, and the tooltip are in `components/UserActivityHistogram.vue`. The dots of the buttons are in `components/UserActivityTab.vue`.

## Tests

- `lib/user_activity_tooltip_placement.test.ts` tests the side, the edge, the top, and the arrow of the tooltip. `lib/user_activity_workspaces.test.ts` tests the colors and the slots of each workspace.
- `components/UserActivityTab.test.ts` tests the parts, the colors, the dots, the legend, the rows and the totals of the tooltip, the side and the arrow of the tooltip, and the hiding of the tooltip.
