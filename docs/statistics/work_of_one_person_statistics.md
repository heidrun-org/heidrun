# Work of one person statistics

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained description of the statistic of the tab "Work of one person"
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun: work of one person](../agents_rules/glossary/person_work.md), [Tab "Work of one person"](../agents_rules/user_interface/window/statistics_person_work.md), [Source "AI cost"](../agents_rules/user_interface/window/statistics_ai_cost.md), [Rule for GitHub and GitLab support](../agents_rules/github_and_gitlab_support.md)
- Related issue: [issue 489](https://github.com/heidrun-org/heidrun/issues/489), [issue 482](https://github.com/heidrun-org/heidrun/issues/482)

This file describes the statistic of the tab "Work of one person" of the Statistics window, and the data layers that it reads. The words are defined in the [glossary of the work of one person](../agents_rules/glossary/person_work.md). The rules of the tab are in [statistics_person_work.md](../agents_rules/user_interface/window/statistics_person_work.md). The data layers are explained in [the_four_data_layers.md](the_four_data_layers.md).

## What the statistic shows

One bar chart with one bar for each day of the last 7 days or of the last 30 days. The developer chooses one of two sources:

- Git history: for one person, the commits and the pull requests of each day, and the number of issues of the time range.
- AI cost: for each coding agent, the estimated cost in US dollars of each day. It is not about one person.

The chart has a legend that names each color. A card beside the bar under the pointer, with an arrow that points to the bar, gives the day, the total of the AI cost, and the value of each color.

The two sources read the data layers in two different ways.

## Source "Git history"

### The data layers that it reads

| Data layer | Table | Fields that the statistic uses |
| --- | --- | --- |
| `data_layer_source_control` | `commits` | `authorName`, `authorEmail`, `committedAt`, and `parents`. A commit with two or more parents is a merge, and it does not count. |
| `data_layer_code_hosting` | `pull_requests` | `author` and `createdAt`. |
| `data_layer_code_hosting` | `issues` | `author` and `createdAt`. |

### The way of the data

1. The tab is shown for the first time. It calls the command `person_work_in_range` once, with the folder of the selected workspace and the 30 days that end today at midnight.
2. The command finds the repository `owner/name` from the remote `origin` of the folder.
3. The command takes the lock of the SQLite file.
4. The command runs the mode `update` of `data_layer_source_control`. The mode runs `git log` and copies the new commits into the table `commits`.
5. The command runs the mode `update` of `data_layer_code_hosting`. The mode asks GitHub, with the command `gh`, for the issues and the pull requests that changed, and copies them into the two tables.
6. When GitHub fails, for example without a network, the command does not stop. It keeps the message of the error, and it reads the rows that an earlier read wrote. The tab shows a warning that the pull requests and the issues can be out of date.
7. The command reads the rows of the repository with three read-only queries, `SELECT data FROM commits`, `SELECT data FROM pull_requests`, and `SELECT data FROM issues`, each with `WHERE repository = '<owner/name>'`. It keeps the rows of the time range, and it removes the merge commits.
8. The tab cuts the same rows into the days of the two time ranges, for each person. The pure class `PersonWork` does the calculation.

The first read of a repository reads every pull request and every issue from GitHub, which takes about 20 seconds for this repository. The next reads take about 5 seconds.

### What counts

- A commit counts for its author, on the day of its commit date.
- A pull request and an issue count for the login of their author, on the day of their creation date.
- A commit knows its author by a name and an email. A pull request or an issue knows its author by a login on GitHub. The tab finds one person from two spellings with the rule of the [glossary](../agents_rules/glossary/person_work.md). A person with a different login and a different name is two people.

## Source "AI cost"

### The data layer that it uses

The source "AI cost" uses `data_layer_chat_sessions` as a library. It does not read the SQLite file, and it does not write it, so it takes no lock. The tables `chat_sessions` and the four link tables are not read.

The reason: the cost needs the tokens of each hour and each model, and the table `chat_sessions` stores the tokens of each model only. The tokens of each hour are in the scan cache `~/.config/heidrun/chats_cache.json`, which the scan cache of the library holds. `data_layer_chat_sessions` stores no cost, because the cost depends on a price list that changes.

### The way of the data

1. The developer chooses the source "AI cost" for the first time. The tab calls the command `ai_cost_in_range` once, with the folder of the selected workspace and the same 30 days as the Git history.
2. The command lists the chats of Claude Code and of Codex of the folder, with the same function as the Past chats sidebar section. The library finds the chat session files and reads them, and it keeps the tokens of each hour in the scan cache.
3. The command keeps the chats that used tokens. For each hour of a chat that overlaps the time range, it computes the cost of the tokens of that hour at the public prices of their models (`model_prices.rs`).
4. The tab puts each hour on the day that holds its start, in the time zone of the computer. The pure class `AiCost` does the calculation.

A chat that uses a model with no known price has no cost in every hour. A line of text under the chart says how many such chats exist in the time range.

## Where the code is

| Part | Place |
| --- | --- |
| The data layers | `packages/data_layers/data_layer_source_control`, `data_layer_code_hosting`, and `data_layer_chat_sessions` |
| The command `person_work_in_range` | `packages/apps/desktop_tauri/src/person_work.rs` |
| The command `ai_cost_in_range` | `packages/apps/desktop_tauri/src/ai_cost.rs` |
| The lock of the SQLite file | `packages/apps/desktop_tauri/src/data_layer_lock.rs` |
| The tab and the chart | `packages/apps/web_frontend/src/components/PersonWorkTab.vue` and `StackedBarChart.vue` |
| The calculations | `packages/apps/web_frontend/src/lib/person_work.ts`, `ai_cost.ts`, and `calendar_days.ts` |

The tests are listed in [statistics_person_work.md](../agents_rules/user_interface/window/statistics_person_work.md) and in [statistics_ai_cost.md](../agents_rules/user_interface/window/statistics_ai_cost.md), in the sections "Tests".

## Open points

- The source "AI cost" does not use the SQLite file. A later issue can decide whether the tokens of each hour move into the data layer.
- A person with a different login on GitHub and a different name in Git is two people. A later step can add a table that links them.
- GitHub only: `data_layer_code_hosting` reads GitHub, so the pull requests and the issues of a repository on GitLab are not read. The rule of GitHub and GitLab support requires the same support for GitLab.
