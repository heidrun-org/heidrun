# Directory Context: `/packages/dev_tools/agents_rules_checker`

## Purpose
A full npm package that holds the test of the maximum size of a file of the agent rules. The test fails when a file in the folder `docs/agents_rules`, or in one of its subfolders, is larger than the maximum size. It also holds the test of the skill `issue_fix_workflow`: the skill must stay general, and the file `AGENTS.md` must give the values that the skill reads. It also holds the test of the skill `context_md_system`, and the test of the skills `docs_folder_system` and `docs_folder_agents_rules_system`: each skill must stay general, and the file `AGENTS.md` and the folder `.claude/skills` must lead to it.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the classes `AgentsRulesSize`, `IssueFixSkill`, and `SkillValues`, and the type `TooLargeFile`.
- `src/agents_rules_size.ts`: the class `AgentsRulesSize`, which reads the maximum size in the file `AGENTS.md`, lists the files of a folder and of its subfolders, and finds the files that are too large.
- `src/issue_fix_skill.ts`: the class `IssueFixSkill`, which finds the details of one repository in the skill, and the values that the section "Issue Fix Workflow values" of the file `AGENTS.md` does not give.
- `src/skill_values.ts`: the class `SkillValues`, which finds the values that a section of the file `AGENTS.md` does not give, and the values that a skill does not name. The class `IssueFixSkill` uses it.
- `tests/context_md_skill.test.ts` and `tests/docs_folder_skills.test.ts`: the tests of the skills `context_md_system`, `docs_folder_system`, and `docs_folder_agents_rules_system`. They reuse the class `IssueFixSkill` to find the details of this repository.
- `tests/`: the Vitest tests. `tests/temporary_folder.ts` creates temporary folders, and only the tests import it.
- Command to test this folder: `pnpm --filter agents_rules_checker test`

## Rules
- The maximum size of a file of the agent rules is written only in the file `AGENTS.md`, on the line `- Maximum size of a file:` of the section "Docs folder agents rules system values". This package reads the number there and never copies it.
- The test looks at every file in the folder `docs/agents_rules`, in all its subfolders, and not only at the files with the extension `.md`.
- The skill `issue_fix_workflow` is copied to other repositories, so the test fails when the skill names a branch, a command, or a tool of this repository. The details of this repository belong in the section "Issue Fix Workflow values" of the file `AGENTS.md`.
- The skills `context_md_system`, `docs_folder_system`, and `docs_folder_agents_rules_system` are copied to other repositories in the same way, so the test fails when a skill names a detail of this repository.
- No package in `packages/apps` imports this package.

## Background
- The package was created by [issue #304](https://github.com/heidrun-org/heidrun/issues/304), which split the file `user_interface.md` into many small files.
- The test of the skill `issue_fix_workflow` comes from [issue #656](https://github.com/heidrun-org/heidrun/issues/656).
- The test of the skill `context_md_system` comes from [issue #676](https://github.com/heidrun-org/heidrun/issues/676).
- The test of the skills `docs_folder_system` and `docs_folder_agents_rules_system` comes from [issue #811](https://github.com/heidrun-org/heidrun/issues/811).
