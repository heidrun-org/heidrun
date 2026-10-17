# Data layer access timing

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Maintained measurement of the cost of the data layer access
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Data layer access](../agents_rules/data_layer_access.md), [The four data layers](the_four_data_layers.md)
- Related issue: [issue 617](https://github.com/heidrun-org/heidrun/issues/617)

This file gives the time that the Past chats sidebar section and the Statistics window spend when they get their data through the packages of the data layer. It reports the collection (the functions `refresh_*`, which read the sources and write the SQLite file) apart from the display queries (the functions `find_*`, which read the SQLite file only). The two costs are different: the collection runs when a part opens or after a delay, and a display query runs at each click on "Show more", at each change of the sort key, and at each change of the slot length.

## How it was measured

- The data is the real history on the computer of the developer, on 17 October 2026: 370 chats of Claude Code and 35 chats of Codex for the workspace of this repository, 675 commits in the last 365 days, 1041 user activity records in the last 30 days, and an SQLite file of 24.5 MB.
- A small Rust program, built in release mode, called the functions of the four packages on a copy of the SQLite file and of the scan cache `chats_cache.json`. The sources were read as they are, and nothing was written to the real SQLite file. The program is not in the repository. The chat session files were in the cache of the operating system.
- A collection is one call. A display query is the median of 20 calls.
- The collection of the issues and pull requests of GitHub was not measured, because it needs the network and the command `gh`. Its time is in [work_of_one_person_statistics.md](work_of_one_person_statistics.md).

## The collection

| Function | Warm: the SQLite file and the scan cache hold the history | Cold: no SQLite file and no scan cache |
| --- | --- | --- |
| `refresh_chat_sessions` | 31.5 ms (the first call: 2371 ms, because many chat files changed after the scan cache was saved) | 2594 ms |
| `refresh_ai_cost` | 33 to 57 ms | 458 ms (the scan cache already held the chats of the line above) |
| `refresh_source_control` | 23 to 96 ms | 3288 ms (every commit of the repository) |
| `refresh_user_activity` | 3 to 6 ms | not measured |

## The display queries

| Function | Median | Rows |
| --- | --- | --- |
| `find_chat_list`, 30 chats, last updated | 5.5 ms | 30 + 30 |
| `find_chat_list`, 300 chats, last updated | 5.1 ms | 300 + 35 |
| `find_chat_list`, 10 000 chats, last updated | 5.0 ms | 370 + 35 |
| `find_chat_list`, 30 chats, messages | 5.2 ms | 30 + 30 |
| `find_chat_list`, 30 chats, created on, ascending | 5.1 ms | 30 + 30 |
| `find_ai_cost`, 30 days or 365 days | 18.7 to 18.9 ms | 199 hours |
| `find_commits`, 7 days, 90 days, or 365 days | 1.5 to 1.9 ms | 508 to 675 commits |
| `find_pull_requests_opened_between`, any range | 1.3 to 1.4 ms | |
| `find_issues_opened_between`, any range | 2.4 to 2.5 ms | |
| `find_user_activity_records`, 30 days | 1.0 ms | 1041 records |

## What it means

- A display query costs 1 to 19 ms, and it does not grow with the number of chats or with the time range at this size.
- The chat list had to scan the chat session files at each call. The same scan now runs once when the section opens, and in the warm case it takes about 32 ms with the write of the SQLite file. I did not run the old command again, so this is a bound and not a measurement of the old command.
- A click on "Show more", a change of the sort key, and a change of the slot length no longer touch a chat file. With the old code, every sort key other than "Last updated" opened every chat file of the workspace.
- The cold collection runs only the first time, or after the scan cache is deleted.
