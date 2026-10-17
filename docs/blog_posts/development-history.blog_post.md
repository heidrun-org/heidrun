# Why Did We Write This Code? Ask the Development History

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Draft blog post awaiting developer review
- Related framing: [Series plan](blog_series_plan.md)
- Related rules: [Project glossary](../agents_rules/glossary/index.md), [Marketing guidance](../marketing/README.md)
- Related issue: [issue #642](https://github.com/heidrun-org/heidrun/issues/642)

## Remembering the Question Behind a Change

Looking at a database table tells me what the software stores. The table does not necessarily explain why I decided to store those facts, which alternative I rejected, or which frustrating experience started the change.

Conversations with coding agents contain some of those missing explanations. When I can connect the conversation to an issue, a pull request, and the changed code, I can reconstruct a decision from evidence.

Here is a real example from Heidrun: why does the coding agents data layer store token usage for each minute? The answer begins with a slow statistics request and a conversation about reading the same history again.

> The complete project is open source: [github.com/heidrun-org/heidrun](https://github.com/heidrun-org/heidrun)

![Editorial illustration of a thread connecting code, a conversation, an issue, and a pull request](images/development-history.png)

*Illustration generated for this article; the illustration is not a screenshot of Heidrun.*

## Recover the Original Reason

In the saved conversation “Review Heidrun data history,” on 17 October 2026, I asked how the Statistics window obtained its data. I wanted to understand why retrieving a date range involved reading conversation files, and whether the same question could be answered through heidrun_data.

At 02:54 in Paris, I asked why token usage could not be stored for each minute, with an index, so that both Heidrun and heidrun_data could query the stored usage without reading the conversations again. The later discussion added another requirement: estimated dollar costs should be queryable through the same data layer.

The conversation identifier is `01a14733-1314-70d3-91a3-6f28c85c5ebe`. The identifier points to a saved local conversation; the public requirement is recorded in [issue #616](https://github.com/heidrun-org/heidrun/issues/616).

[Pull request #624](https://github.com/heidrun-org/heidrun/pull/624) records the implementation: stored minute usage, versioned model prices, and a shared view for estimated cost. The [merge commit](https://github.com/heidrun-org/heidrun/commit/c3753808826dddfa552fb517fe73e5b21dd00b6b) connects that implementation to the changed files.

The implementation conversation, `f26732ee-ed61-4483-8725-09d4b9146400`, is also linked to the issue in the stored history. Its file records include the token-usage work. Reading those records supplies candidates to investigate; checking the original conversation and the pull request establishes what actually happened.

I now have a useful answer to “Why is this table here?” The table supports a shared retrieval path for the desktop application and the coding agent's command line. The reasoning survives beyond the code that implements the table.

## Give the Coding Agent a Way to Find Evidence

The developer asks the question in a conversation with Claude Code or Codex. The heidrun_data skill explains which records are available, how to query those records, and when to read the original source.

Four data-layer packages collect different parts of the history into a SQLite database, a local database stored in one file:

| Source | Evidence available |
| --- | --- |
| Git history | Commits, authors, dates, and change counts |
| Code hosting | Issues and pull requests, their dates, authors, and recorded descriptions |
| Coding agents | Saved chat metadata, links to files and references, token usage, and coding agent configuration |
| User activity | Recorded active periods in Heidrun for workspace folders |

A useful investigation follows a short sequence:

```text
A question with a topic and approximate date
    → Query stored records for candidate conversations and changes
    → Follow recorded issue, pull request, and file references
    → Read the original conversations and change records
    → Explain the conclusion with sources and remaining gaps
```

The database stores useful facts and relationships. Reading the original sources supplies conversation text, commit differences, and issue discussions when the investigation needs those details. This arrangement keeps the first search focused without treating a stored reference as proof of causation.

## Keep Retrieval Separate From Collection

The minute-usage example also illustrates an engineering decision inside Heidrun. Importing historical conversations is different work from asking how many tokens were used yesterday.

The initial import reads the source records. Later synchronization reads changed files. A statistics query then reads stored usage for the selected period. The Statistics window and heidrun_data use the shared data layer for those results.

Keeping the token counts separate from model prices preserves the underlying facts when prices change. The cost view can combine each token category with the corresponding price. A model without a known price has an unknown cost, and the result reports that missing information.

These decisions matter to the user. The same question should have the same scope and counting rules whether the developer asks through a chart or through a coding agent. The developer should also be able to distinguish an inexpensive query from an initial import that reads a large history.

## Check the Limits Before Trusting the Answer

A reference in a conversation can be a passing mention. A conversation can discuss an issue without implementing the issue. Dates narrow an investigation, but two changes happening on the same day do not establish that one caused the other.

The indexed chat list currently covers repository-root conversations. Worktree conversations can be missing from that index, even though the reader can retrieve a worktree conversation when its identifier is known. Token usage covers a broader set of folders. Code-hosting records can be stale, and reading a public discussion needs access to the hosting service.

For this example, I checked the recorded question, the stored links, the public issue and pull request, and the merge's changed files. This is a reconstruction performed while preparing the article, not a claim that one natural-language question automatically found every record without investigation.

## Try a Question You Already Care About

This investigation uses the development branch `dev_jerome` on 17 October 2026. The minute-usage implementation was merged after the latest public release checked, [v0.2.7](https://github.com/heidrun-org/heidrun/releases/tag/v0.2.7). Use the development source and its documentation when reproducing this particular example.


Ask your coding agent a question with a topic and a rough date: “We changed the statistics retrieval last week. Find the discussion and explain why.” Ask for the sources behind the answer and for any missing evidence.

The valuable result is an explanation you can check. A limitation is useful information too: learning that a conversation was never indexed is better than receiving an invented reason for a change.

I want early users to try this with their own development history. If the coding agent cannot find a conversation you know exists, or the returned context does not explain the decision, [describe the missing context](https://github.com/heidrun-org/heidrun/issues). Those reports can improve both the records Heidrun exposes and the instructions the coding agent follows.

Next: [What Does a Day of Development With Coding Agents Actually Look Like?](day-of-development.blog_post.md).
