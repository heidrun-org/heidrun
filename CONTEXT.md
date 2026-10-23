# Directory Context: `/`

## Purpose
The Heidrun repository contains the macOS application, its supporting packages, developer tools, and documentation.

## Key Exports & Entry Points
- `packages/`: the application, supporting packages, developer tools, and experiments.
- `scripts/`: repository maintenance, build, installation, and release commands; see its own CONTEXT.md.
- `submodules/`: independent repositories at recorded commits; see its own CONTEXT.md.
- [README.md](README.md): application overview and development setup.
- [AGENTS.md](AGENTS.md): project rules and development commands.
- Command to run the application: `pnpm dev`.
- Command to test the repository: `pnpm test`.

## Rules
- Git submodules stay outside the pnpm workspace packages.
- Initialize the recorded submodule commits with `git submodule update --init --recursive` after a pull.
- Shared skills are maintained in their independent repository; Heidrun's `.agents/skills` are separate installed copies.

## Background
- https://github.com/heidrun-org/heidrun/issues/708
