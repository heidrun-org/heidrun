---
name: bug_triage_workflow
description: Triage the open issues of a repository to keep the list small. Collect the open issues, give each issue one kind, write a report in the chat with a link, a recommendation, and the evidence for each issue, then close an issue only when the developer names its number. Use it when the developer asks to triage the issues, to clean the list of open issues, or to find which open issues to close.
---

# Bug Triage Workflow

This file gives the steps of the Bug Triage Workflow. The goal is to keep the list of open issues small. This file is a first draft ([issue 655](https://github.com/heidrun-org/heidrun/issues/655)). The developer changes it after each real triage. The short section "Bug Triage Workflow" in [AGENTS.md](../../../AGENTS.md) names this skill. The Bug Triage Workflow has the same shape as the Issue Fix Workflow in [AGENTS.md](../../../AGENTS.md): numbered steps, and one decision that only the developer makes.

## The numbers

These numbers are first guesses. Change them here, and nowhere else.

- An old issue is an issue with no activity for 30 days.
- An issue with the label `under-specified` is clarified within 7 days, or it is closed.
- The daily list is too long when it has more than 30 issues.

## When a triage starts

A triage starts only when the developer asks for it in the chat, for example "triage the issues". Nothing starts a triage by itself. The developer decides when. A good time is the end of the week, or a day when the daily list is too long.

## The daily list

The daily list is the list of open issues without the issues that can wait: the issues with the label `maybe later`, and the issues with the label `note`.

- GitHub: `gh issue list --search '-label:"maybe later" -label:note'`
- GitLab: `glab issue list --not-label "maybe later,note"`

## The four steps

### 1. Collect

List all open issues, oldest first. Then read each issue and its comments.

- GitHub: `gh issue list --state open --limit 200 --search 'sort:created-asc'`, then `gh issue view <number> --json number,title,state,body,labels,comments`
- GitLab: `glab issue list --order created_at --sort asc --per-page 100`, then `glab issue view <number> --comments`

### 2. Classify

Give each issue one kind from the table. The labels `bug`, `Simple Work`, `enhancement`, `idea`, `maybe later`, `under-specified`, and `duplicate` exist today. The label `note` is new. The report names the kind and the label of each issue. The coding agent puts a label on an issue only when the developer names the number of the issue.

| Kind | Label | What happens |
| --- | --- | --- |
| Bug | `bug` | Fix it. When it is old, the developer tests it again by hand. |
| Small and clear | `Simple Work` | Fix it when there is a free hour. |
| Feature request or early idea | `enhancement` or `idea` | It stays open only when it is planned. Otherwise it gets the label `maybe later`. |
| Note: a thought that the developer wrote down, with no goal | `note` | The triage never closes it. The developer closes it, or turns it into an issue with a goal. |
| Unclear | `under-specified` | Clarify it within 7 days, or close it. |
| Report, plan, or master issue | no label | Close it when all its child issues are closed. |
| Duplicate | `duplicate` | Close it with a link to the other issue. |

### 3. Report

Write the report in the chat. Do not write the report in a file, and do not write it in an issue. For each issue, write these four things:

- A link to the issue.
- A recommendation: handle first, keep, or close.
- The evidence: what you read, and what it showed.
- What was not checked.

In the report, write each issue number as a link to the issue. The coding agent only reads during a triage: it reads the issue, its comments, and the code history. It does not start the application, and it does not try to reproduce a bug. Put "not tested" in "what was not checked" for every bug.

The order for "handle first" is:

1. A bug that can do damage.
2. A bug with a known cause.
3. An issue with the label `Simple Work`.
4. All the other issues.

### 4. Decide

The developer reads the report and the evidence. The developer tests the old bugs by hand. The coding agent closes an issue only when the developer names the number of the issue. When the developer names a number, close the issue with a reason:

- Completed: the work is done.
- Not planned: nobody will do the work.
- Duplicate: write the link to the other issue.

The commands:

- GitHub: `gh issue close <number> --reason completed`, `gh issue close <number> --reason "not planned"`, or `gh issue close <number> --duplicate-of <other number>`. Add `--comment "<reason>"` to write the reason in words.
- GitLab: `glab issue note <number> --message "<reason>"`, then `glab issue close <number>`. GitLab has no option for the reason of a closing, so the comment holds the reason.

## Rules to keep the list small

- Test an old bug once, by hand. When the developer cannot make the bug happen again, the developer names the number, and the coding agent closes the issue. When the bug still happens, keep the issue.
- Every closed issue has a reason: completed, not planned, or duplicate with a link.
- The coding agent never closes an issue, never changes a label, and never writes a comment without a number named by the developer.
