# Glossary of Heidrun: user activity

- Created: 14 October 2026
- Last updated: 14 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md), [User interface of Heidrun: User activity sidebar section](../user_interface/sidebars/user_activity.md)
- Related issue: [issue 440](https://github.com/heidrun-org/heidrun/issues/440)

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
