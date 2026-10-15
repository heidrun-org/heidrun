# Glossary of Heidrun: user activity

- Created: 14 October 2026
- Last updated: 15 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md), [User interface of Heidrun: User activity sidebar section](../user_interface/sidebars/user_activity.md), [User interface of Heidrun: Statistics window](../user_interface/window/statistics_window.md)
- Related issue: [issue 440](https://github.com/heidrun-org/heidrun/issues/440), [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 486](https://github.com/heidrun-org/heidrun/issues/486)

This document gives one short definition for each word of the activity of the developer in front of Heidrun. The other words of Heidrun are in [index.md](index.md).

## The activity of the developer

### User activity time

The time that the developer is active in front of Heidrun, counted for one workspace. It is not the agent time: the agent time is the time that a coding agent works on a request ([issue 438](https://github.com/heidrun-org/heidrun/issues/438)).

### Action

One keyboard action or one mouse action that reaches the Heidrun window: a key press, a mouse button press, a turn of the mouse wheel, or a move of the mouse pointer over the window. An action that happens while the Heidrun window is not in front does not count.

### Cool down

The time with no action after which the developer is no longer active. It is 5 seconds.

### Active period

The time from the first action to the end of the cool down, in one workspace. An active period also ends when the Heidrun window goes behind another window, when the selected workspace changes, and when Heidrun closes.

### User activity record

One line of the file `~/.config/heidrun/user_activity.jsonl`: the description of one active period. It holds the folder of the workspace, three times, the number of keyboard actions, the number of mouse actions, and the reason why the active period ended. It never holds a key that the developer typed, and never a text of the screen.

### User activity sidebar section

The sidebar section of the right sidebar that shows the user activity records of today, with the icon `stopwatch`. It is a view to check by eye that the detection of the activity of the developer works.

## The Statistics window

### Statistics window

The large window that the item "Statistics" of the More menu opens. It is as large as the large Git window. It has a tab list, and the tab "User activity" is its first tab.

### User activity tab

The tab "User activity" of the Statistics window. It holds one histogram of the user activity time, and three choices: the time range (the last hour, the last day, or the last week), the slot length, and the workspaces.

### Histogram of the user activity time

The bar chart of the User activity tab. It shows the user activity time of the last hour, of the last day, or of the last week, as the developer chooses, with one bar for each slot.

### Slot

One bar of a histogram of the user activity time. The developer chooses the slot length, and each time range offers three lengths: 1, 5, or 10 minutes in the last hour (5 at first), 15 minutes, 30 minutes, or 1 hour in the last day (1 hour at first), and 1 hour, 6 hours, or 1 day in the last week (1 day at first). A slot of minutes or hours starts on a multiple of its length of the clock, for example 14:05 to 14:10 for a slot of five minutes. The last slot of a histogram is the slot of the current time, and it is not finished.
