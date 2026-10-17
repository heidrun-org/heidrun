# User interface of Heidrun: Statistics window, tab "Work of one person", source "Git history"

- Created: 16 October 2026
- Last updated: 17 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Source "AI cost"](statistics_ai_cost.md), [Totals](statistics_totals.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523), [issue 559](https://github.com/heidrun-org/heidrun/issues/559), [issue 622](https://github.com/heidrun-org/heidrun/issues/622)

This file is a part of the rules of the tab "Work of one person". It holds what counts for the source "Git history", and where its data comes from. The layout of the tab, the radio button groups, and the bar chart are in [statistics_person_work.md](statistics_person_work.md). The words are defined in [glossary/person_work.md](../../glossary/person_work.md).

## What counts

- A commit counts for its author, on the day of its commit date. A merge commit does not count, because it brings in commits that count already.
- A pull request and an issue count for the login of their author, on the day of their creation date. An item whose author account is deleted counts for nobody.
- Two spellings of one person are one person ([glossary/person_work.md](../../glossary/person_work.md)). The person chooser shows the name that the person writes the most often in the commits, or else the login.
- A person that has a different login and a different name on GitHub and in Git is two people. A later step can add a table that links them.

## The metric of the bar chart

- A radio button group chooses the metric: "Commits and pull requests", chosen at first, or "Lines added and lines deleted". The choice changes the bar chart only. It does not change the person, the time range, the workspaces, or the totals, and it reads nothing again.
- With the metric "Lines added and lines deleted", the bar of a day has the lines added by the commits of the person on this day below, and the lines deleted above. The lines count for the commits that count, and not for the pull requests. A binary file counts 0. The lines of the bars of the time range add up to the fourth and the fifth totals.
- The class `PersonWork` gives `insertionCount` and `deletionCount` for each day, with the same loop that gives the totals. The chart information card writes each number with the separator of the language of the interface.

## Where the data comes from

- The tab reads the data through the data layer, with the command `person_work_in_range` of the file `packages/apps/desktop_tauri/src/person_work.rs`. The command finds the repository from the remote `origin` of the folder of the workspace, copies the new commits with the mode `update` of the package `data_layer_source_control`, then copies the new pull requests and the new issues from GitHub with the mode `update` of the package `data_layer_code_hosting`, then reads the three kinds of items back with read-only queries. The tab asks once for each folder of a chosen workspace, for the 30 days that end today at midnight, and cuts the same items into the days of the two time ranges. It joins the items of the chosen folders with `PersonWork.merge`: two folders of the same repository (the same `owner/name`), for example a folder and its worktree, give the repository once, because the SQLite file holds the commits of a repository once.
- The first read of a repository reads every pull request and every issue from GitHub, which takes about 20 seconds for this repository. The next reads copy only the items that changed, and take about 5 seconds.
- When GitHub cannot be read, for example without a network, the tab still draws the commits and the pull requests and issues that an earlier read wrote in the SQLite file. It shows a Bootstrap alert (`alert theme-warning`) that says that they can be out of date.
- The command takes the lock `lock_database` of `packages/data_layers/heidrun_data/src/database_lock.rs` while it writes the SQLite file. The command `user_activity_records_in_range` and the command line `heidrun_data update` take the same lock, because the SQLite file has no waiting time and two writes at the same time fail.
- The calculation is the pure class `PersonWork` in `packages/apps/web_frontend/src/lib/person_work.ts`. It has no clock: the caller gives the current time. It makes its days with the class `CalendarDays` (`lib/calendar_days.ts`), which the source "AI cost" uses too, so the two sources have the same days. The tab is `PersonWorkTab.vue` and the chart is `StackedBarChart.vue`, in the folder `components`.
- The source "AI cost" is in [statistics_ai_cost.md](statistics_ai_cost.md).
