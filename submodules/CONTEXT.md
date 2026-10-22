# Directory Context: `/submodules`

## Purpose
Independent repositories included in Heidrun as Git submodules at recorded commits.

## Key Exports & Entry Points
- `coding_agent_plugin/`: the independent repository of coding agent workflow skills and Jérôme Étienne’s personal coding style; see its own README.md and CONTEXT.md.

## Rules
- Each submodule keeps its own repository, history, and maintenance rules.
- Initialize submodules with `git submodule update --init --recursive` from the Heidrun checkout root.
- Make skill changes in `jeromeetienne/coding_agent_plugin`, then update Heidrun's recorded submodule commit when adopting a version.
- The submodules are outside the pnpm workspace and have no application build dependency.
- Existing skills in `.agents/skills` remain separate copies and are not synchronized automatically.

## Background
- https://github.com/heidrun-org/heidrun/issues/708
