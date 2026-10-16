# Rules for a good metric

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained rules for the metrics of this folder
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [The four data layers](../statistics/the_four_data_layers.md)
- Related issue: [issue 564](https://github.com/heidrun-org/heidrun/issues/564), [issue 561](https://github.com/heidrun-org/heidrun/issues/561)

This file says what a metric of this folder is, what it is not, and how to evaluate one before it goes into [metrics_examples.md](metrics_examples.md). The ten metrics of that file follow these rules, and a new metric follows them too.

## What a metric is

- **A metric is one number, with one definition that a person can say in one sentence.** "The output tokens of the chat sessions of a pull request, divided by the lines that the pull request adds." When the definition needs two sentences, it is two metrics.
- **A metric joins the chat sessions with at least one other input.** The three inputs of [inputs.md](inputs.md) are the chat sessions, the commits, and the issues and the pull requests. A number that one input gives alone, such as the number of commits per day, already exists in Git, in GitHub, or in the coding agent, and this folder does not repeat it. The join is what nobody has.
- **A metric is one SQL query on the SQLite file of the data layers.** It runs with `sqlite3 -readonly ~/.config/heidrun/data_layer.sqlite`, or with the command `query` of a data layer, and it needs nothing else: no language model, no network, no window of Heidrun. The query is the definition, written in a form that a program can run.
- **A metric gives the facts, and leaves the conclusion to the reader.** The struggle index says that issue 265 needed 9 chat sessions and 103 messages. It does not say that the issue was badly written, or that the coding agent was weak. The developer, or the coding agent that reads the number, says why.
- **A metric has four parts, written together:** the definition, the query, the result on this repository on a named date, and the limits. A metric without its limits is a claim, not a metric. A metric without its result is a guess.
- **A metric names the things that it counts, so the reader can go and look.** The result names the issue numbers, the pull request numbers, and the ids of the chat sessions. A number with no way back to its rows cannot be checked, and a number that cannot be checked is not kept.
- **A metric rests on a link of [inputs_links.md](inputs_links.md), and says which one.** Every metric inherits the gaps of its links. The metric says it, and the fix of a link is worth more than a new metric.

## What a metric is not

- **A metric is not a conclusion.** "The coding agents waste tokens" is a conclusion. "65 chat sessions have no issue and no pull request, and cost 195,334 output tokens, 1.8% of the total" is a metric. The first is not written in this folder. The second is.
- **A metric is not a policy, and not a target.** A metric never says what the number should be. The day a metric becomes a target, the number improves and the work does not: a developer who must lower the struggle index splits every issue in five. The folder measures. The developer decides.
- **A metric is not a benchmark of the coding agents.** Claude Code and Codex did not get the same issues, so the comparison between them says what happened here, on this repository, with this split of the work. It never says which coding agent is better.
- **A metric is not a judgment of a person.** The metrics count messages, tokens, commits, and issues. They never rank people, and a metric whose natural reading is "this developer is slow" is not written.
- **A metric is not a rate in dollars until the price is known.** The tokens of the two coding agents are not comparable as they are, and a sum in dollars needs one price per model and per kind of token. Until then, a metric is written in tokens, in messages, in lines, in days, or in counts.
- **A metric is not a feature of Heidrun.** It needs no window, no tab, no chart. A chart of a metric may come later in the Statistics window, and the metric is the same before and after.
- **A metric is not a story.** The history of how a metric was found, and the surprise that it gave, go into the issue. The metric keeps the definition, the query, the result, and the limits, and nothing else.

## How to evaluate a metric

Run these seven tests before a metric goes into [metrics_examples.md](metrics_examples.md). A metric that fails one test is rewritten or dropped.

1. **It runs.** The query runs on the real SQLite file of this repository, read only, and gives rows. A query that is only written, and never run, is not a metric yet.
2. **It names a known fact.** The result points at something the developer already knows, and agrees with it. The struggle index put the dynamic topics and the layout redesign first, and the developer knew that these were the two hard pieces of the week. A metric whose first result surprises on every row is more likely wrong than deep.
3. **It also says something new.** After the known fact, the result says one thing that the developer did not know, or did not know in numbers: the two hottest files are the two files of instructions for the coding agents, and the untracked work costs 1.8% of the tokens. A metric that only confirms is a check, not a metric.
4. **A person can go and look.** Take one row of the result, open the issue, the pull request, or the chat session that it names, and see that the number is right. Do this for the first row and for one row in the middle.
5. **Its limits are written, and they are honest.** The metric says which link it rests on, which rows it counts wrongly, and which range of dates it covers. The paths of `chat_session_files` are absolute, the chat sessions cover six days, the link counts a chat session that only mentioned the issue: each limit of this kind is written next to the metric, not discovered by the reader.
6. **It survives a floor.** Many ratios are dominated by their smallest rows: a pull request of one line gives 494,971 tokens per line. The metric says its floor, and the result holds with the floor on. A metric that only speaks without the floor speaks about noise.
7. **It is cheap to run again.** The query runs in seconds on the SQLite file, so it can run after each `update`, each week, and on another repository. A metric that needs a hand step each time is run once and forgotten.

## How to write a new metric

1. Start from the link, not from the number: pick two inputs and the link between them in [inputs_links.md](inputs_links.md).
2. Write the definition in one sentence, then the query.
3. Run the query on this repository, and write the result with the date and the numbers of the rows.
4. Run the seven tests above.
5. Write the limits. If a limit is a gap of a link, add it to [inputs_links.md](inputs_links.md) too.
6. Add the metric to [metrics_examples.md](metrics_examples.md), with the four parts, in the same form as the ten metrics there.
