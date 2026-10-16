# User interface of Heidrun: Statistics window, tab "Work of one person", source "AI cost"

- Created: 15 October 2026
- Last updated: 16 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Chat summary](../sidebars/chats/chat_summary.md), [Workspace selector](statistics_person_work_workspace.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523), [issue 559](https://github.com/heidrun-org/heidrun/issues/559)

This file is a part of the rules of the tab "Work of one person". The layout of the tab, the two radio button groups, and the bar chart are in [statistics_person_work.md](statistics_person_work.md). The words are defined in [glossary/person_work.md](../../glossary/person_work.md).

## What counts for the AI cost

- A chat counts for its coding agent, Claude Code or Codex, with its estimated cost: the tokens of each model at the public price of the model, as the Past chats sidebar section estimates it ([chat_summary.md](../sidebars/chats/chat_summary.md)). The chats are the chats of this computer that the Past chats sidebar section lists for the folder of the selected workspace, with the same cache of the scans.
- The package `data_layer_chat_sessions` keeps the tokens of each chat for each hour and each model, with the hour of the record of each request, in UTC. The cost of a chat is cut in the same hours: each hour has the cost of the tokens of that hour at the prices of its models. The web page puts each hour in the day that holds its start, in the time zone of the computer. A chat that lasts several days is therefore in several bars, with the cost of each day. In a time zone with a half hour, for example India, the tokens of at most one half hour can be on the next day or on the day before.
- The tokens of a request whose record has no date count at the date of the last record of the chat, or at the date of the last change of its file when no record has a date.
- A chat that used no token does not count. A chat with a model that has no known price counts as a chat with no cost in every hour, because a cost without the tokens of that model would be too small. A line of text under the chart says how many such chats have tokens in the time range.

## The unit: US dollars or tokens

- When the source "AI cost" is shown, a radio button group of the unit comes after the radio button group of the source. It has the same Bootstrap form, with two buttons that have a text and a title: "US dollars", chosen at first, and "Tokens". The source "Git history" does not show it. A click shows the other unit at once, from the data that the tab already read, so a change of the unit reads nothing. The tab never remembers the choice.
- The tokens of a chat in an hour are its input tokens, with the ones read from the cache and written to it, and its output tokens, for every model: the numbers that the Past chats sidebar section shows ([chat_summary.md](../sidebars/chats/chat_summary.md)).
- In tokens, a chat with no known price counts with its tokens, because a token has no price. The line of text about the chats with no known price is shown only in US dollars.
- A number of tokens is written as the information card of a chat writes it: a number under one thousand as it is, else two decimal digits and KT (thousand), MT (million), BT (billion), or TT (trillion), for example "20.61 KT". A total of zero is "0".
- In tokens, the three totals, their average per day, the stacked bars, the chart legend, and the chart information card show tokens, in the same places where they show US dollars. The title of the chart is "Tokens of each day, for each coding agent", and the title of the vertical axis is "Tokens".
- The vertical axis in tokens has one unit for all its ticks: the biggest of KT, MT, BT, and TT that does not go over the highest bar, or one token for a highest bar under one thousand, for example "5 MT", "10 MT", "15 MT". `StackedBarChart.vue` divides the heights by the size of this unit. The chart information card still shows the exact text of each value.

## The average per day

- Under each of the three totals, the tab shows the average per day: the total divided by the number of days of the time range, 7 or 30, in US dollars, for example "$0.57 per day", or in tokens, rounded to whole tokens, for example "9.29 KT per day". The rules are in [statistics_totals.md](statistics_totals.md).

## Where the data comes from

- The source "AI cost" reads its data with the command `ai_cost_in_range` of the file `packages/apps/desktop_tauri/src/ai_cost.rs`. The command lists the chats of Claude Code and of Codex of the folder of the workspace with the function of the Past chats sidebar section, and keeps the chats that used tokens. For each one it gives its coding agent and its hours that overlap the time range, each with the start of the hour, the estimated cost of the hour, and its tokens (the field `tokens`: the input tokens and the output tokens of every model). It does not write the SQLite file, so it does not take the lock. The tab asks once for each folder of a chosen workspace, for the same 30 days as the Git history, and joins the chats of the chosen folders with `AiCost.merge`. Each chat has an identifier (the field `id`), and a chat that two folders list counts once for its coding agent. The hours are in the scan cache of the package, `chats_cache.json`, and not in the SQLite file: nothing reads them there.
- The calculation is the pure class `AiCost` in `packages/apps/web_frontend/src/lib/ai_cost.ts`. It counts the cost and the tokens of each day. It has no clock: the caller gives the current time. It makes its days with the class `CalendarDays`, as the class `PersonWork` does.

## Tests

- `lib/ai_cost.test.ts` tests the counting of the tokens of each coding agent for each day, with a chat with no known price, and the counting of the cost of each coding agent for each day, the cost of a chat that lasts several days, the totals, the chats with no known price, and the hours that are outside the time range.
- `components/PersonWorkTab.test.ts` tests that the window does not read the chats before the developer chooses the source "AI cost", and reads them once. It tests the totals, the average cost per day for 7 days and for 30 days, the stacked bars, their legend, and their chart information card in US dollars, the 30 days, the hidden person chooser, the radio button group of the unit, the totals, the average, the bars, the vertical axis, and the card in tokens, the two lines of text under the chart, the empty time range, the reading in progress, and the error.
- `lib/chat_usage.test.ts` tests the unit of the vertical axis in tokens (`tokenUnitFor`).
- The Rust tests of the module `ai_cost` test the cost and the tokens of each hour, the hours that overlap the time range, a request without a date, a chat with no token, a chat with no known price, the names of the fields, and a text that is not a time. The Rust tests of the module `chats` test the tokens of each hour of a chat, and the Rust tests of the file `tokens.rs` of the package `data_layer_chat_sessions` test the hour of each request of Claude Code and of Codex.
