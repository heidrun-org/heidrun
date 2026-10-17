# What Does a Day of Development With Coding Agents Actually Look Like?

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Draft blog post awaiting developer review
- Related framing: [Series plan](blog_series_plan.md)
- Related rules: [Project glossary](../agents_rules/glossary/index.md), [Marketing guidance](../marketing/README.md)
- Related issue: [issue #642](https://github.com/heidrun-org/heidrun/issues/642)

## Start With a Day You Can Examine

On 16 October 2026, the stored Heidrun history records 85 commits excluding merge commits authored by Jerome Etienne, 29 pull requests opened by my GitHub account, and 40 issues opened by the same account. The stored token usage for the Heidrun workspace gives an estimated cost of $173.96 at the imported public model prices.

Those numbers describe different aspects of the day. The interesting question is what happened behind the numbers—and which decisions I can improve after examining the history.

Heidrun gives me several views of that evidence through the Statistics window and heidrun_data. I use the records to ask better questions about my workflow.

> The complete project is open source: [github.com/heidrun-org/heidrun](https://github.com/heidrun-org/heidrun)

![Editorial illustration of a developer examining the records of a working day](images/day-of-development.png)

*Illustration generated for this article; the illustration is not a chart or a screenshot of Heidrun.*

## Define the Period Before Counting

For this investigation, I examined 10–16 October 2026 inclusive, in the Europe/Paris time zone, in the Heidrun repository. The stored records were checked on 17 October, and their newest source timestamps extend beyond the end of the selected week.

The Git counts use the name `Jerome Etienne` after the repository's author mapping. The issue and pull request counts use the GitHub login `jeromeetienne`. The table treats those identities as mine explicitly; the records do not automatically establish an identity match between every Git author and every hosting account.

| Date in Paris | Commits excluding merges | Pull Requests Opened | Issues Opened | Estimated AI Cost |
| --- | ---: | ---: | ---: | ---: |
| 10 October | 78 | 40 | 45 | $52.27 |
| 11 October | 106 | 43 | 48 | $122.04 |
| 12 October | 34 | 14 | 26 | $43.30 |
| 13 October | 119 | 40 | 54 | $115.18 |
| 14 October | 38 | 30 | 35 | $117.87 |
| 15 October | 59 | 39 | 40 | $153.69 |
| 16 October | 85 | 29 | 40 | $173.96 |
| **Whole Period** | **519** | **235** | **288** | **$778.30** |

The cost total is rounded after adding the underlying amounts; adding already-rounded daily amounts can differ by a cent. Commits and pull requests overlap as records of work, so adding the two counts would not give a count of distinct delivered features.

The same stored history records 235 pull requests merged by my GitHub account during the period. “Opened during the period” and “merged during the period” are separate measurements, even when their totals happen to match.

## Find the Question Behind an Unusual Day

The day with the most commits was 13 October. The day with the highest estimated AI cost was 16 October. Those observations give me two places to investigate; neither observation tells me which day produced the better software.

A commit can contain a small correction or a large change. Token usage includes repeated context and cached input. A conversation can involve experiments that never become a merged change. Comparing totals without reading the work would leave all of those differences unexplained.

One concrete example on 16 October concerns the conversations shown in Past chats. [Issue #557](https://github.com/heidrun-org/heidrun/issues/557) explains that Codex approval-review conversations appeared as ordinary developer chats, even though the developer had typed none of those approval messages. [Pull request #577](https://github.com/heidrun-org/heidrun/pull/577) records the change to exclude those review conversations from Past chats and the associated statistics.

That example does not explain the day's total token usage. The example shows why the definition of a counted conversation matters. A chart can be accurate about the stored rows while still answering a different question from the question the developer intended.

## Understand What the Cost Means

The week's stored usage contains 3,835,847,761 tokens across Claude Code and Codex. Most of those tokens—3,749,366,426—are cached input. The number therefore does not mean that the coding agents generated billions of new words or lines of code.

The estimated cost multiplies fresh input, cached input, cache-write input, and output tokens by the corresponding prices. For the selected period, the stored usage has no rows with an unknown price. The price list used here is version 1, retrieved on 17 October 2026. Claude Code accounts for $709.00 of the estimate and Codex for $69.30.

The estimate uses the imported price list for the whole historical period. The estimate is not an invoice or a subscription payment. Updating the price list can change the estimate for an old day while the underlying token counts stay the same.

The [token usage documentation](https://github.com/heidrun-org/heidrun/blob/dev_jerome/docs/statistics/token_usage_and_cost.md) explains these rules, including unknown prices, duplicate records, and time zones.

## Activity Time Answers Another Question

The User activity tab records active periods while Heidrun has focus, with a five-second interval after the last action. The records do not measure all the time I spend thinking, reading another application, or waiting for a coding agent.

For 16 October, the imported records for the Heidrun folder and its subfolders contain 371 active periods. After clipping the periods to the local day and combining any overlapping intervals, those records total 82.11 minutes.

That is recorded interaction with Heidrun. Reading the figure as “the developer worked for 82 minutes” would discard work outside the measured window and any gaps in collection. The useful question is how those periods relate to particular decisions, questions, and reviews.

## Ask Through the Same Stored History

This investigation uses `dev_jerome` on 17 October 2026. The stored-minute implementation was merged after the latest public release checked, [v0.2.7](https://github.com/heidrun-org/heidrun/releases/tag/v0.2.7). Reproducing these queries requires the development source with that change and an imported history.


In Heidrun, open Statistics from the More menu. The User activity tab shows recorded active periods. The Work of one person tab offers Git history and AI cost for the chosen workspaces.

In a coding agent's conversation, ask for a defined period and repository: “Examine Heidrun from 10 to 16 October in Paris time. Separate commits, pull requests opened, pull requests merged, and estimated token cost. Show the evidence and explain missing data.” The heidrun_data skill gives the coding agent a way to query those records.

Both paths depend on imported history. An initial token-history import is explicit; later synchronization brings changed records into the data layer. A query can only describe the history that has been collected, and an unknown model price remains unknown.

## Help Make the Measurements Useful

I use Heidrun every day, and I want to learn where the workflow fails for other developers. Try a period of your own work. Find a result you can explain from memory, then check whether Heidrun helps recover the supporting context.

Report the awkward step: a missing conversation, a surprising count, an unclear definition, or a workflow that makes you leave Heidrun. Include the expected result and what Heidrun showed instead in the [issue tracker](https://github.com/heidrun-org/heidrun/issues).

Early users can help make Heidrun useful in daily development. A specific account of where a workflow breaks gives me something concrete to improve.

Previous: [Why Did We Write This Code? Ask the Development History](development-history.blog_post.md).
