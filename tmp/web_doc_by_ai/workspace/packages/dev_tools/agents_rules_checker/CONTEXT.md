# Directory Context: `/tmp/web_doc_by_ai/workspace/packages/dev_tools/agents_rules_checker`

## Purpose
A full npm package that holds the test of the maximum size of a file of the agent rules. The test fails when a file in the folder `docs/agents_rules`, or in one of its subfolders, is larger than the maximum size.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the class `AgentsRulesSize` and the type `TooLargeFile`.
- `src/agents_rules_size.ts`: the class `AgentsRulesSize`, which reads the maximum size in the file `AGENTS.md`, lists the files of a folder and of its subfolders, and finds the files that are too large.
- `tests/`: the Vitest tests. `tests/temporary_folder.ts` creates temporary folders, and only the tests import it.
- Command to test this folder: `pnpm --filter agents_rules_checker test`

## Rules
- The maximum size of a file of the agent rules is written only in the file `AGENTS.md`, in the sentence that starts with "The maximum size of a file". This package reads the number there and never copies it.
- The test looks at every file in the folder `docs/agents_rules`, in all its subfolders, and not only at the files with the extension `.md`.
- No package in `packages/apps` imports this package.

## Background
- The package was created by [issue #304](https://github.com/heidrun-org/heidrun/issues/304), which split the file `user_interface.md` into many small files.
