---
name: context_md_system
description: Read, create, update, and verify the CONTEXT.md files of a repository, the short files that hold the purpose, the exports, and the rules of one folder. Use it before you edit or add a file in a folder, when you create a folder that holds source code, when you change the exported interface or the responsibility of a folder, when a CONTEXT.md file grows over 5500 bytes, and when you add a test that checks the CONTEXT.md files.
---

# CONTEXT.md system

A CONTEXT.md file sits in a folder of a repository. It tells a coding agent what the folder is for, what the folder offers to other folders, and what must not be broken. Each file covers its own folder, and the subfolders that have no CONTEXT.md file of their own. This skill names no detail of one repository, so the folder of this skill can be copied to another repository.

## Read the files

1. Before you edit or add a file in a folder, look for a CONTEXT.md file in this folder, then in each parent folder up to the root of the repository. Read the nearest file first.
2. A rule in the CONTEXT.md file of a subfolder overrides or narrows a rule of a parent folder, for the files inside the subfolder.
3. Follow the nearest file strictly for the boundaries between modules: the public exports, and the folders that must not import from each other.

## Create and update the files

1. New folder: when you create a folder that holds source code or components, create a CONTEXT.md file in it at once, from the template in the section "The template".
2. Maintenance: when you add a core file, change an exported interface, or change what a folder is responsible for, update the CONTEXT.md file of that folder in the same change, so that the file stays accurate.
3. Go all the way down: a CONTEXT.md file belongs in every source folder that has a distinct responsibility, not only in the top folder of a package or of a module. When a folder has subfolders that each have their own CONTEXT.md file, the parent file names each subfolder on one line and says what the subfolder is for. The parent file does not name the files inside the subfolder.

## Keep each file short

1. Limit in bytes, not in lines: each CONTEXT.md file stays under 5500 bytes. When a file goes over 5500 bytes, shrink it to 4500 bytes. A paragraph is written as one long line, so a count of lines measures nothing.
2. Write the rule, link the history: a rule is one sentence in the present tense that says what must hold now. The story of how the rule came to be true (the milestone, the experiment, the failure that proved it) stays in the issue tracker, and the rule keeps only a bare link to it. A CONTEXT.md file is never a changelog.
3. One place for each fact: when a fact already lives somewhere else (a naming document, a shared types package, another CONTEXT.md file), link to that place. Do not copy the fact, because the copy will disagree with the original.

## What goes in each section

1. Purpose: one or two sentences that say what the folder is responsible for.
2. Key Exports & Entry Points: what another folder or another package may import from this folder, and the one command that runs this folder, if there is one. This section is a list of exports, not a list of files. Never list every file of the folder, because a directory listing already shows them and the list goes out of date first. List individual files only when the folder has no public interface at all.
3. Rules: what must not be broken. Prefer a rule that names a boundary (which folder must not import which other folder), because a boundary is the thing that decays. A rule that says why it exists is worth several rules that only say what.
4. Background: the reasons and the links behind the rules, when a reason is too long to sit inside the rule itself.

## Verify the files

When a repository has so many CONTEXT.md files that reading all of them by hand is no longer practical, add a test that checks them. The test checks these points:

- Every package or workspace has a CONTEXT.md file.
- The folder path in the heading equals the folder where the file sits.
- All the section headings are present, in the order of the template.
- The limit of 5500 bytes holds.

The test never looks at the target of a markdown link: it does not check that a file path named in a file exists on disk, and it does not check that a relative link resolves.

## The template

Use this structure for a new CONTEXT.md file:

```markdown
# Directory Context: `/<relative-path>`

## Purpose
[One to two sentences describing what this folder handles]

## Key Exports & Entry Points
- `index.ts`: Main public interface for this module.
- `[subfolder]/`: [What that subfolder is for — see its own CONTEXT.md]
- Command to run this folder: `[command]`

## Rules
- Nothing here imports from [restricted-module].
- [Any specific local coding convention, one sentence, present tense]

## Background
- [Rule above] comes from [link to the issue or the document that proved it].
```
