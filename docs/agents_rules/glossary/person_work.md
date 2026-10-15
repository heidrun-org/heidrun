# Glossary of Heidrun: work of one person

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md), [User activity glossary](user_activity.md), [User interface of Heidrun: Statistics window, tab "Work of one person"](../user_interface/window/statistics_person_work.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523)

This document gives one short definition for each word of the statistic of the work of one person. The other words of Heidrun are in [index.md](index.md). The Statistics window is defined in [user_activity.md](user_activity.md).

## The work of one person

### Work of one person tab

The tab "Work of one person" of the Statistics window. It shows how much one person changed the repository of the selected workspace, or what the coding agents cost, as a bar chart with one bar for each day. It has a radio button group for the source, a person chooser, a radio button group for the time range, the totals, and the bar chart.

### Source of the Work of one person tab

The kind of data that the bar chart shows, as the developer chooses it in a radio button group: the Git history, or the AI cost. The Git history is chosen at first.

### Git history

The source of the Work of one person tab that counts the commits, the pull requests, the issues, and the lines added and deleted of one person.

### AI cost

The source of the Work of one person tab that shows the estimated cost in US dollars of the chats of each coding agent, Claude Code and Codex, on this computer. It is not about one person, so the person chooser is hidden. The cost of a chat is cut into hours, from the date of each request, and each hour counts on the day that holds its start, so a chat that lasts several days is in several bars.

### Person

One author of the repository. A commit knows its author by a name and an email. A pull request or an issue knows its author by a login on GitHub. Heidrun finds the same person when the name and the login are the same after they are written in lower case, with no space, no hyphen, and no accent: the name "Jérôme Étienne" and the login "jerome-etienne" are one person. The login in an email of the form `login@users.noreply.github.com` counts as the login.

### Person chooser

The list in the Work of one person tab that chooses the person of the bar chart of the Git history. It holds each person that has at least one commit, one pull request, or one issue in the last 30 days, the person with the most of them first.

### Time range of the Work of one person tab

The last 7 days or the last 30 days, as the developer chooses. The last day of the time range is today.

### Day

The time from midnight to the next midnight, in the time zone of the computer. A commit counts on the day of its commit date. A pull request or an issue counts on the day that its author opened it.

### Totals

The numbers under the person chooser, in the time range. For the Git history there are five: the number of commits, the number of pull requests that the person opened, the number of issues that the person opened, the number of lines added, and the number of lines deleted. The lines are the lines of the commits of the person, as Git counts them for each commit, and a binary file counts 0. The issues and the lines are numbers only. They are not in the bar chart. The AI cost has three totals: the cost of Claude Code, the cost of Codex, and the two together.

### Average per day

The text under each total: the total divided by the number of days of the time range, 7 or 30, for example "71.1 per day". Every day counts, also a day with no work. For the AI cost, the average is a cost in US dollars, for example "$28.50 per day".

### Bar chart of the work of one person

The bar chart of the Work of one person tab. It has one bar for each day of the time range. Each bar has two colors, one on top of the other. For the Git history: the number of commits of the day, then the number of pull requests of the day. For the AI cost: the cost of Claude Code of the day, then the cost of Codex of the day. It has a chart legend and a chart information card, as every chart of the Statistics window has ([statistics_charts.md](statistics_charts.md)).
