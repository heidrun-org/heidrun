# Documentation experiment instructions

Read README.md and process/HANDOFF.md first. This folder is a parked experiment, not a production integration or issue completion.

- Only write inside tmp/web_doc_by_ai. Keep the real website, normal root scripts and application packages unchanged.
- Generator and judge runs never stage, change branches, commit, push, create pull requests, merge or deploy.
- The user separately authorised preserving this experiment through issue 407, a temporary worktree, a commit and a pull request; merging and deployment remain unauthorised.
- Work on the Files sidebar rule only until the user expands the scope.
- Use workspace entry points, whose repositoryPath is their own source-tree root. Never execute old scripts from history or results: some target the old worktree or have historical Git-writing behaviour.
- No model call starts as part of parking. Future model calls need the resumed task to authorise them.
- Keep raw prompts, answers, settings, input fingerprints and verification limits for every evaluation.
- Do not hand-edit the generated user pages; use the writer when a documentation change is authorised.
- Preserve the two live-confirmed findings in the handoff. A high average does not override blockers or verification limits.
- Never modify memories or remove original worktrees as part of this parked experiment.
