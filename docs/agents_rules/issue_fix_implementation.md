# Rule: the Issue Fix Implementation and the added requests

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun: the Issue Fix Workflow](glossary/issue_fix_workflow.md), [Rule: every support for GitHub is also a support for GitLab](github_and_gitlab_support.md)
- Related issue: [issue 610](https://github.com/heidrun-org/heidrun/issues/610)

This file gives the rules for the part Issue Fix Implementation of the Issue Fix Workflow in `AGENTS.md`, and for the added requests. An added request is more work that the developer asks for after the issue was written, during the Issue Fix Implementation or the Issue Fix Review. The glossary defines the words.

## The problem that these rules solve

When the developer asks for work that the issue does not describe, the issue, the pull request (on GitLab, the merge request), and the real change do not agree. These rules keep the three in agreement.

## The two kinds of added request

The agent decides which kind an added request is, and says it in one line, for example "This is a related added request of issue 607."

- A related added request is in the same part of the application as the issue, and the developer reviews it together with the fix, and it is not larger than the original fix.
- An unrelated added request is any added request that is in a different part of the application, or that could ship alone, or that is larger than the original fix.
- When the agent is not sure, the added request is unrelated.

## A related added request

1. Do the work in the same temporary worktree. Every commit message mentions the same issue number.
2. Update the rule files and the tests of the added work, as for any change.
3. When the work is done, and before the next first message of the Issue Fix Review, add one comment to the issue for this added request. Never edit the first text of the issue: the comments keep the history.
4. Write the comment as the section "The comment" below says.

## An unrelated added request

1. Do not do the work in this temporary worktree.
2. Ask the developer one question: whether to create a new issue for this work. Do not create the new issue before the developer says yes.
3. When the developer says yes, create the new issue as the section "GitHub and GitLab" of `AGENTS.md` says. The new issue gets its own Issue Fix Workflow, with its own temporary worktree.
4. Add a line to the new issue with the plain address of the original issue as its own bullet. Add a comment to the original issue with the plain address of the new issue as its own bullet.

## The comment

One comment for each related added request. The comment has these three parts, in this order, each as a bullet:

- What the developer asked, in the words of the developer, in one or two lines.
- What changed, in one or two lines.
- Which files changed. Write each file name as a link to the file, as the section "Writing the text of an issue" of `AGENTS.md` says.

Add the comment with `gh issue comment <number> --body "<comment>"`. On GitLab, use `glab issue note <number> --message "<comment>"`.

## The pull request

In the Issue Fix Completion, the description of the pull request lists each related added request, in the same three parts as the comment, and each new issue of an unrelated added request as its own bullet with the plain address of the issue.
