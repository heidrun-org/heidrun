# User interface of Heidrun: Statistics window, tab "Work of one person"

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: work of one person](../../glossary/person_work.md), [Statistics window](statistics_window.md), [layout.md](layout.md), [Source "AI cost"](statistics_ai_cost.md), [Totals](statistics_totals.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523)

This file is a part of the rules of the window of Heidrun. The words are defined in [glossary/person_work.md](../../glossary/person_work.md). The rules of the source "AI cost" are in [statistics_ai_cost.md](statistics_ai_cost.md).

## The tab

- The Statistics window has the tab "Work of one person" after the tab "User activity". The tab "User activity" is still the selected tab when the window opens.
- The window does not read the data of the tab when it opens, so a developer that never opens the tab never waits for GitHub. The source "Git history" reads its data the first time that the tab is shown. The source "AI cost" reads its data the first time that the developer chooses it. Each source keeps its data while the window stays open, and reads it again the next time that the window opens.
- The tab uses the repository of the selected workspace. When no workspace is selected, the tab shows the text "No workspace is selected…" and reads nothing.
- While the data is read, the tab shows the text "Reading the commits, the pull requests, and the issues…" (Git history) or "Reading the chats of the coding agents…" (AI cost). When the data cannot be read, it shows the error in a Bootstrap alert (`alert theme-danger`), and no chart. The error of one source does not change the other source. When the repository has no commit, no pull request, and no issue in the last 30 days, the Git history shows a text and no chart. When no chat used tokens in the last 30 days, the AI cost shows a text and no chart.
- The tab uses Bootstrap components, utility classes, and theme variables, and no custom CSS. Every text of the tab is in every language, and `pnpm --filter web_frontend check:translations` shows no key of the tab as missing.

## From top to bottom

- The radio button group of the source, the person chooser, and the radio button group of the time range, on one line that wraps on a narrow window. The tab never remembers the choice of the source, of the person, or of the time range.
- The radio button group of the source has the same Bootstrap form as the one of the tab "User activity", with two buttons that have a text and a title: "Git history", chosen at first, and "AI cost". A click shows the other source at once.
- The person chooser, a `select` with the class `form-control`, is shown for the source "Git history" only, because the AI cost is the cost of the chats on this computer and not the work of one person. The person with the most items is chosen at first.
- The radio button group of the time range has two buttons that have a text and a title: "Last 7 days", chosen at first, and "Last 30 days". A click draws the bar chart of this time range at once, from the data that the tab already read. A change of the source keeps the time range.
- The totals. For the Git history: the number of commits, the number of pull requests, the number of issues, the lines added, and the lines deleted of the person in the time range. For the AI cost: the cost of Claude Code, the cost of Codex, and the two together, in US dollars, for example "$4.00". A cost of exactly zero is "$0.00". A change of the person or of the time range changes the totals at once.
- Under each total, its average per day. The rules of the lines and of the average per day are in [statistics_totals.md](statistics_totals.md).
- The bar chart takes the rest of the height, with at least 240 pixels. For the AI cost, two lines of text are under the bar chart ([statistics_ai_cost.md](statistics_ai_cost.md)).

## The bar chart

- Both sources use the same component, `StackedBarChart.vue`. It is drawn with Plotly.js, as the histogram of the user activity time is, with the same loading and the same reading of the colors of the theme (`lib/chart_theme.ts`). It follows the dark theme and the light theme, it is drawn again when the theme, the language, the source, the person, or the time range changes, and it changes size when the window changes size.
- It has one bar for each day of the time range: 7 bars or 30 bars. The last bar is today. For 7 days, the horizontal axis shows the weekday and the date of each day. For 30 days, it shows the date only.
- Each bar has two colors, one on top of the other (`barmode` is `stack`), and a legend names them. Git history: the number of commits of the day below, in the color `--primary-bg`, and the number of pull requests of the day above, in the color `--success-bg`. AI cost: the cost of Claude Code of the day below, in the color `--accent`, and the cost of Codex of the day above, in the color `--primary-bg`.
- The vertical axis starts at 0. For the Git history, it shows whole numbers only, and it goes up one by one while the highest bar is 8 or less. For the AI cost, it shows US dollars with the sign "$". A higher bar lets Plotly.js choose the step.
- Both sources follow [statistics_charts.md](statistics_charts.md): a chart legend above the bars, and a chart information card beside the bar under the pointer. The title of the card is the day, for example "Monday 12 October". Git history: the card has no total, and one row for the commits and one row for the pull requests of the day, each with its number, and a color that has 0 has no row. AI cost: the card has the total cost of the day, and one row for each coding agent that has a cost in the day, with its cost in US dollars.
- The title of the chart gives the name of the person for the Git history, and "AI cost of each day, for each coding agent" for the AI cost.

## What counts

- A commit counts for its author, on the day of its commit date. A merge commit does not count, because it brings in commits that count already.
- A pull request and an issue count for the login of their author, on the day of their creation date. An item whose author account is deleted counts for nobody.
- Two spellings of one person are one person ([glossary/person_work.md](../../glossary/person_work.md)). The person chooser shows the name that the person writes the most often in the commits, or else the login.
- A person that has a different login and a different name on GitHub and in Git is two people. A later step can add a table that links them.

## Where the data comes from

- The tab reads the data through the data layer, with the command `person_work_in_range` of the file `packages/apps/desktop_tauri/src/person_work.rs`. The command finds the repository from the remote `origin` of the folder of the workspace, copies the new commits with the mode `update` of the package `data_layer_source_control`, then copies the new pull requests and the new issues from GitHub with the mode `update` of the package `data_layer_code_hosting`, then reads the three kinds of items back with read-only queries. The tab asks once, for the 30 days that end today at midnight, and cuts the same items into the days of the two time ranges.
- The first read of a repository reads every pull request and every issue from GitHub, which takes about 20 seconds for this repository. The next reads copy only the items that changed, and take about 5 seconds.
- When GitHub cannot be read, for example without a network, the tab still draws the commits and the pull requests and issues that an earlier read wrote in the SQLite file. It shows a Bootstrap alert (`alert theme-warning`) that says that they can be out of date.
- The command takes the lock of `packages/apps/desktop_tauri/src/data_layer_lock.rs` while it writes the SQLite file. The command `user_activity_records_in_range` takes the same lock, because the SQLite file has no waiting time and two writes at the same time fail.
- The calculation is the pure class `PersonWork` in `packages/apps/web_frontend/src/lib/person_work.ts`. It has no clock: the caller gives the current time. It makes its days with the class `CalendarDays` (`lib/calendar_days.ts`), which the source "AI cost" uses too, so the two sources have the same days. The tab is `PersonWorkTab.vue` and the chart is `StackedBarChart.vue`, in the folder `components`.
- The source "AI cost" is in [statistics_ai_cost.md](statistics_ai_cost.md).

## Tests

- `lib/person_work.test.ts` tests the finding of the people (name and login, accents, hyphens, emails of GitHub, the shown name, the order), and the counting of each day and the totals. `lib/calendar_days.test.ts` tests the days: the first and the last day, and the time zone.
- `components/PersonWorkTab.test.ts` tests the reading of the Git history, the two radio button groups, the person chooser, the totals, the stacked bars, their legends and their chart information cards, the change of the person, of the source, and of the time range, and the texts of the error, of the missing workspace, of GitHub, and of the empty repository, with a replacement for Plotly.js. It tests the source "AI cost" too: [statistics_ai_cost.md](statistics_ai_cost.md).
- `components/StatisticsModal.test.ts` tests that the tab list has the two tabs, and that the tab "Work of one person" reads its data only when it is shown.
- The Rust tests of the module `person_work` test the command with a real Git repository and a real SQLite file in a temporary folder, and with a fake GitHub: the time range, the author, the date, and the lines of a commit, the merge commits, the pull requests and the issues, the failure of GitHub, a folder that is not a repository, and a text that is not a time.
