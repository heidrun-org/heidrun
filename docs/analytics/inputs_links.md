# Links between the three inputs

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained description of the links between the inputs, and of their gaps
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [The four data layers](../statistics/the_four_data_layers.md)
- Related issue: [issue 564](https://github.com/heidrun-org/heidrun/issues/564), [issue 561](https://github.com/heidrun-org/heidrun/issues/561)

Every metric of [metrics_examples.md](metrics_examples.md) rests on a link between two of the three inputs of [inputs.md](inputs.md): a chat session, a commit, an issue, or a pull request. This file says how each link is made in the SQLite file of the data layers, how complete each link is on this repository, and which gaps are known. A better link is worth more than a new metric, because every metric inherits the gaps of its links.

## The links

| From | To | How the link is made | Where it is |
| --- | --- | --- | --- |
| Chat session | Issue | The text of the chat names the issue, for example "fix the issue 35" or `#35`. | Table `chat_session_issues`, column `issueNumber`. |
| Chat session | Pull request | The text of the chat names the pull request. | Table `chat_session_pull_requests`, column `pullRequestNumber`. |
| Chat session | File | The chat session read or wrote the file. | Table `chat_session_files`, column `path`. |
| Chat session | Folder | The folder in which the chat session ran. | Table `chat_session_folders`, column `folder`. |
| Commit | Issue | The text `#N` in the first line of the message of the commit. The Issue Fix Workflow requires it. | Field `subject` of the column `data` of the table `commits`. No link table: the number is read from the text in the query. |
| Pull request | Issue | The text `Fixes #N` in the body of the pull request. The field `closingIssuesReferences` of GitHub is empty here, because the pull requests merge into `dev_jerome` and not into `main`. | Field `body` of the column `data` of the table `pull_requests`. No link table. |
| Pull request | Commit | The field `mergeCommit` of the pull request. | Field `mergeCommit` of the column `data` of the table `pull_requests`. |
| Chat session | Commit | No direct link. A chat session and a commit meet through their issue, or through their dates and their files. | Nothing stores it. |

Issues and pull requests share one sequence of numbers on GitHub, so the number 300 is either an issue or a pull request, never both.

## How complete each link is on this repository

Counted on 16 October 2026, on the repository `heidrun-org/heidrun`. The chat sessions cover 9 to 14 October 2026, the commits cover 5 to 16 October 2026, and the issues and the pull requests cover the whole repository: 313 issues, 248 pull requests, 306 chat sessions, 900 commits.

| Link | Complete | Missing | Note |
| --- | --- | --- | --- |
| Issue with at least one chat session | 249 of 313 issues (80%) | 70 issues | An issue with no chat session was fixed by hand, or its chat session is older than 9 October, or the text of the chat never named the number. |
| Pull request with at least one chat session | 194 of 248 pull requests (78%) | 54 pull requests | |
| Chat session with at least one issue or pull request | 238 of 306 chat sessions (78%) | 68 chat sessions | The 68 chat sessions cost 195,334 output tokens together, 1.8% of the total. See the metric "Work outside the tracker". |
| Chat session with at least one file | 141 of 306 chat sessions (46%) | 165 chat sessions | A chat session that only talked, or that read files without a tool that the data layer recognizes, names no file. |
| Commit with an issue number, merges excluded | 497 of 618 commits (80%) | 121 commits | |
| Pull request with `Fixes #N` | 163 of 248 pull requests (66%) | 85 pull requests | The pull requests of the Issue Fix Workflow carry it. The others merge a personal branch, or were made before the rule. |
| Pull request with a merge commit | 248 of 248 pull requests | 0 | Every pull request of this repository is merged. |

## Known gaps

- **The paths of `chat_session_files` are absolute, and name files outside the repository.** The most linked file is `/Users/jetienne/.claude/projects/-Users-jetienne-webwork-heidrun/memory/MEMORY.md`, with 13 chat sessions, and files of the scratchpad folder `/private/tmp/claude-501/...` appear too. The metric "Hot files" needs paths relative to the root of the repository, and the files outside the repository dropped or marked. This is a change of `data_layer_chat_sessions`.
- **The chat sessions of the worktrees are not read.** `data_layer_chat_sessions` reads the chat sessions of the root of the repository only. The Issue Fix Workflow makes every fix in a worktree, so a chat session that ran in `.claude/worktrees/<name>` is counted only when Claude Code or Codex files it under the root. This is an open point of [the four data layers](../statistics/the_four_data_layers.md).
- **A chat session links to an issue when the chat names the number, not when the chat fixed the issue.** A chat session that discusses five issues links to the five. The metric "Cost of a feature" uses this on purpose, and the metric "Struggle index" suffers from it: issues 199 and 200 share the same 5 chat sessions and the same 107 messages.
- **Nothing links a chat session to a commit.** The post-mortem of a commit goes through the issue of the commit, or through the dates and the files of the chat session. A link table `chat_session_commits`, filled from the hashes that appear in the text of the chat, would make it direct.
- **The tokens of the two coding agents are not comparable as they are.** Codex reports 6,854,146 fresh input tokens and Claude Code reports 25,000, because Claude Code reports almost every input token as cached input. Any sum in dollars needs one price per model and per kind of token, and the field `tokens` has the kinds for that.
- **The time range of the chat sessions is six days.** Claude Code and Codex keep their chat session files for a limited time, and the data layer keeps a row after the file is gone. The range grows with each run of `update`, and the metrics on time are reliable only inside the range.
