# Directory Context: `/packages/dev_tools/documentation_by_ai/src`

## Purpose
Assemble current documentation inputs, make one writing call and build once for human review.

## Key Exports & Entry Points
- `index.ts`: the sole package interface, exporting DocumentationGeneration, DocumentationOptions and DocumentationInput.
- `cli.ts`: Commander command parsing; invoked only by an explicit command.
- `documentation_generation.ts`: exclusive lock, execution stages and run records.
- `documentation_inputs.ts`: current source inventory and initial input fingerprints.
- `documentation_prompt.ts`: assembled request from the maintained prompt and current scope.
- `documentation_process.ts`: argument-array process execution and raw output retention.
- `documentation_types.ts`: shared option and input shapes.

## Rules
- Nothing imports executable historical experiment runners or judge code.
- External commands use argument arrays without a shell.
- Failure stops the operation without another writing call or output restoration.
- Runtime imports from outside the package are Node built-ins and Commander only.

## Background
- [Package behavior](../README.md).
