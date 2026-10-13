# Release notes

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 337](https://github.com/heidrun-org/heidrun/issues/337)

This folder holds the text of the GitHub releases of Heidrun.

The file `prefix.md` is the start of the text of every release, and it is the same for every release. The release script `scripts/release_dmg.ts` reads it. The command `pnpm docs:identity` writes the description of Heidrun in it, so the file `prefix.md` has no metadata header. A notes file for one version, for example `v0.2.0.md`, goes in this folder too.
