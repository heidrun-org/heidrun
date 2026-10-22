---
name: git_cleanup_adviser
description: Review Git branches and worktrees and advise which ones appear safe to remove, with evidence and uncertainty. Use when a developer asks to audit, review, or identify cleanup candidates. This skill gives advice only and does not remove anything.
---

# Git Cleanup Adviser

Review branches and worktrees and explain which ones appear safe to remove. A worktree is a separate working folder connected to the same Git repository. The default action is advice only. Never remove a branch or worktree as part of an audit. A later, separate request to remove an item is required before taking that action.

## Choose the destination branch

Read the repository instructions and identify the branch where completed work is expected to land. Use the developer's named destination when supplied. Otherwise, use the repository instructions or branch configuration when they make the destination clear. If there are several reasonable choices, ask which destination to use before judging whether work is included. State the destination branch in the report.

Read repository instructions for branches that must be kept. Do not assume that a branch name is protected or unprotected based only on its name. Include the current branch and any branch used by an active worktree in the report.

## Collect the evidence

Start with read-only Git commands:

```bash
git status --short --branch
git worktree list --porcelain
git branch --all --verbose --verbose --no-abbrev
```

For each local branch and each worktree, inspect the relevant branch and directory. Do not treat a worktree and its branch as one decision: a worktree can have local files to preserve even when its branch's commits are included, and a branch checked out in a worktree cannot be removed while that worktree remains.

For a worktree, inspect its full path with:

```bash
git -C <worktree-path> status --short --branch --untracked-files=all
git -C <worktree-path> submodule status --recursive
```

Look for staged changes, unstaged changes, untracked files, and submodule changes. If a submodule is present, inspect its working directory as well. If a worktree cannot be read, its state is unknown.

For a branch, compare its commits with the destination branch. First check whether its tip is already part of the destination branch's history. If it is not, inspect the commits that differ and compare their changes:

```bash
git merge-base --is-ancestor <branch> <destination>
git log --oneline --decorate <destination>..<branch>
git cherry <destination> <branch>
```

An unmerged commit list alone does not prove that work is missing: a change may have reached the destination through a squash (combining several commits into one) or another equivalent commit. In `git cherry` output, `-` means Git found an equivalent change in the destination, and `+` means it did not. Inspect the differing commits, including commits that combine two or more earlier lines of work, and report any uncertainty. Commit comparison cannot prove that two changes have the same purpose or effect in every case.

For remote branches, distinguish the branch on the remote server from the local reference that records the last known remote state. That local reference may be stale. When network access is available, `git ls-remote --heads <remote>` can check which branch tips currently exist on the remote without updating local references. If the remote cannot be checked, or the needed commit is not present locally for comparison, mark the result as needing inspection. When available, check whether a branch has an open pull request or merge request and whether the remote protects the branch. If these facts cannot be checked, say so. Do not fetch or prune as part of the default audit.

## Give separate recommendations

Report local branches, remote branches, and worktrees in separate rows. Do not recommend removing the main checkout from which the audit is being run. For each row, give one recommendation:

- **Deleteable**: the available evidence shows that no work needs preserving, the branch is not protected, and any branch is not checked out in a remaining worktree.
- **Keep**: there is unique work, a local change, a protected-branch rule, or another clear reason to retain the item.
- **Needs inspection**: evidence is missing, remote information may be stale, a worktree cannot be inspected, or commit equivalence is uncertain.

For every recommendation, state the evidence in plain words. For a worktree, report its path, branch or detached state, local changes, and whether its commits are included in the destination. For a branch, report whether its commits are included, whether it is checked out, whether it is protected, and whether its remote state was checked. Do not call an item deleteable just because its branch name is old, its pull request is closed, or its latest commit looks familiar.

Finish with a short note that the report is an assessment of the state observed at that time. Do not run branch deletion, worktree removal, remote deletion, pruning, or cleanup commands during the audit.
