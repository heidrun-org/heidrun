# Directory Context: `/packages/experiments/coding_agent_plugin`

## Purpose
The temporary working folder for the plugin that groups the four shared skills: `issue_fix_workflow`, `bug_triage_workflow`, `git_cleanup_adviser`, and `context_md_system`.

## Key Exports & Entry Points
- `skills/`: the copy of the four skill folders.

## Rules
- Nothing outside `packages/experiments` imports this package.
- The folder `skills/` holds copies, so a change to a skill is made in `.agents/skills` first.
- The package is removed when the parent issue decides the shared place for the skills.

## Background
- The package comes from [issue #682](https://github.com/heidrun-org/heidrun/issues/682), the plan for a first step of [issue #658](https://github.com/heidrun-org/heidrun/issues/658).
