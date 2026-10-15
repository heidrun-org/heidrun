# User interface of Heidrun: Statistics window, tab "Work of one person", source "AI cost"

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Chat summary](../sidebars/chats/chat_summary.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482)

This file is a part of the rules of the tab "Work of one person". The layout of the tab, the two radio button groups, and the bar chart are in [statistics_person_work.md](statistics_person_work.md). The words are defined in [glossary/person_work.md](../../glossary/person_work.md).

## What counts for the AI cost

- A chat counts for its coding agent, Claude Code or Codex, with its estimated cost: the tokens of each model at the public price of the model, as the Past chats sidebar section estimates it ([chat_summary.md](../sidebars/chats/chat_summary.md)). The chats are the chats of this computer that the Past chats sidebar section lists for the folder of the selected workspace, with the same cache of the scans.
- The package `data_layer_chat_sessions` keeps the tokens of each chat for each hour and each model, with the hour of the record of each request, in UTC. The cost of a chat is cut in the same hours: each hour has the cost of the tokens of that hour at the prices of its models. The web page puts each hour in the day that holds its start, in the time zone of the computer. A chat that lasts several days is therefore in several bars, with the cost of each day. In a time zone with a half hour, for example India, the tokens of at most one half hour can be on the next day or on the day before.
- The tokens of a request whose record has no date count at the date of the last record of the chat, or at the date of the last change of its file when no record has a date.
- A chat that used no token does not count. A chat with a model that has no known price counts as a chat with no cost in every hour, because a cost without the tokens of that model would be too small. A line of text under the chart says how many such chats have tokens in the time range.

## Where the data comes from

- The source "AI cost" reads its data with the command `ai_cost_in_range` of the file `packages/apps/desktop_tauri/src/ai_cost.rs`. The command lists the chats of Claude Code and of Codex of the folder of the workspace with the function of the Past chats sidebar section, and keeps the chats that used tokens. For each one it gives its coding agent and its hours that overlap the time range, each with the start of the hour and the estimated cost of the hour. It does not write the SQLite file, so it does not take the lock. The tab asks once, for the same 30 days as the Git history. The hours are in the scan cache of the package, `chats_cache.json`, and not in the SQLite file: nothing reads them there.
- The calculation is the pure class `AiCost` in `packages/apps/web_frontend/src/lib/ai_cost.ts`. It has no clock: the caller gives the current time. It makes its days with the class `CalendarDays`, as the class `PersonWork` does.

## Tests

- `lib/ai_cost.test.ts` tests the counting of the cost of each coding agent for each day, the cost of a chat that lasts several days, the totals, the chats with no known price, and the hours that are outside the time range.
- `components/PersonWorkTab.test.ts` tests that the window does not read the chats before the developer chooses the source "AI cost", and reads them once. It tests the totals, the stacked bars and their tooltips in US dollars, the 30 days, the hidden person chooser, the two lines of text under the chart, the empty time range, the reading in progress, and the error.
- The Rust tests of the module `ai_cost` test the cost of each hour, the hours that overlap the time range, a request without a date, a chat with no token, a chat with no known price, the names of the fields, and a text that is not a time. The Rust tests of the module `chats` test the tokens of each hour of a chat, and the Rust tests of the file `tokens.rs` of the package `data_layer_chat_sessions` test the hour of each request of Claude Code and of Codex.
