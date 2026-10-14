# Heidrun

<!-- identity:start -->
<!-- Generated from data/identity.json: pnpm docs:identity -->

Keep your agents working. Know which one needs you.

<!-- identity:end -->

This file gives the rules for working on this repository. The file `README.md` describes the application itself.

## Project memory

This file is read by Claude Code (through `CLAUDE.md`) and by Codex.

- The branch `dev_jerome` is the personal development branch of Jérôme Étienne. Jérôme's work goes on `dev_jerome`.
- **NEVER delete or remove the branches `dev`, `dev_jerome`, or `dev_eric`. Never, in any case, locally or on the remote repository.** These branches are permanent. When you merge a pull request (on GitLab, a merge request) from one of these branches, never use the option `--delete-branch` of `gh pr merge`, and never use the option `--remove-source-branch` of `glab mr merge`. Delete only a temporary branch of the Issue Fix Workflow.
- The branch `dev_eric` is the personal development branch of Eric. Eric's work goes on `dev_eric`.
- Each developer works on the personal development branch of that developer only. Never put the work of Jérôme on `dev_eric`, and never put the work of Eric on `dev_jerome`.

## Agent rules

The folder `docs/agents_rules` holds all the rules that every agent follows. Read the glossary before you change the code. The rules of the user interface are split by topic into many small files: read only the files that match the part that you change, and keep them up to date when a rule changes.

- [docs/agents_rules/glossary.md](docs/agents_rules/glossary.md): the definition of each word that the project uses for one of its parts. Use these words, and no other word, in the code, in the documents, and in the conversations.
- [docs/agents_rules/glossary_code_hosting.md](docs/agents_rules/glossary_code_hosting.md): the definition of each word of the search in the Code hosting sidebar section: the search field, and the saved search. Read it with the glossary when you change the Code hosting sidebar section.
- [docs/agents_rules/glossary_pane_focus_history.md](docs/agents_rules/glossary_pane_focus_history.md): the definition of each word of the navigation through the panes that had the focus: the top bar, the pane focus history, the Back button, and the Forward button. Read it with the glossary when you change the top bar or the focus of the panes.
- [docs/agents_rules/github_and_gitlab_support.md](docs/agents_rules/github_and_gitlab_support.md): the rule that every support added for GitHub is also added for GitLab, the words "pull request" and "merge request", and the matching `gh` and `glab` commands. Read this file each time that you add or change a support for GitHub, or a `gh` command in a document.

The rules of the user interface: where each part goes, and how each part works. Each file starts with the part that it covers.

- The window, in the folder `docs/agents_rules/user_interface/window`:
  - [layout.md](docs/agents_rules/user_interface/window/layout.md): the layout of the window, the rules of the layout, the text that must stay on one line, and the files.
  - [colors_and_scroll_bars.md](docs/agents_rules/user_interface/window/colors_and_scroll_bars.md): the colors and the scroll bars.
  - [status_bar.md](docs/agents_rules/user_interface/window/status_bar.md): the status bar and the menu of the status item.
  - [status_bar_git.md](docs/agents_rules/user_interface/window/status_bar_git.md): the Git branch section of the status bar: the branch picker, the synchronization with the upstream branch, and the counts.
  - [window_state_and_start.md](docs/agents_rules/user_interface/window/window_state_and_start.md): the position and size of the window, the last state of each option, the splash screen, and the goat sounds.
- The workspaces, the tabs, and the panes, in the folder `docs/agents_rules/user_interface/workspaces_tabs_and_panes`:
  - [workspace.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/workspace.md): the workspace.
  - [tabs.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/tabs.md): the tabs.
  - [panes.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/panes.md): the panes and the state "Needs you".
  - [pane_focus_history.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/pane_focus_history.md): the pane focus history, and the Back button and the Forward button of the top bar.
- The sidebars, in the folder `docs/agents_rules/user_interface/sidebars`:
  - [sidebars.md](docs/agents_rules/user_interface/sidebars/sidebars.md): the sidebars and the notes.
  - [source_control.md](docs/agents_rules/user_interface/sidebars/source_control.md): the Source control sidebar section.
  - [code_hosting.md](docs/agents_rules/user_interface/sidebars/code_hosting.md): the Code hosting sidebar section: the header buttons, the icon, the two lists, the rows, the information card, and the cache.
  - [code_hosting_search.md](docs/agents_rules/user_interface/sidebars/code_hosting_search.md): the search field of the Code hosting sidebar section, the saved searches, and the windows "Save this search" and "Edit the saved search".
  - [files.md](docs/agents_rules/user_interface/sidebars/files.md): the Files sidebar section.
- The Chats sidebar section, in the folder `docs/agents_rules/user_interface/sidebars/chats`:
  - [chats_list.md](docs/agents_rules/user_interface/sidebars/chats/chats_list.md): the list of chats, the buttons "Show more" and "Show less", and the refresh of the list.
  - [chats_header_and_sort.md](docs/agents_rules/user_interface/sidebars/chats/chats_header_and_sort.md): the two button groups at the top, the views, and the Chats sort dropdown menu.
  - [chat_summary.md](docs/agents_rules/user_interface/sidebars/chats/chat_summary.md): the three lines of the summary of a chat, how the program reads the summary, its cache, and the width of an information card.
  - The information cards of a chat, in the folder `docs/agents_rules/user_interface/sidebars/chats/information_cards`:
    - [files_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/files_line.md): the files line and its information card.
    - [references_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/references_line.md): the references line and its information card.
    - [dates_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/dates_line.md): the dates line and its information card.
  - The dynamic topics, in the folder `docs/agents_rules/user_interface/sidebars/chats/dynamic_topics`:
    - [settings_section.md](docs/agents_rules/user_interface/sidebars/chats/dynamic_topics/settings_section.md): the section "Dynamic topics" of the Settings window.
    - [clusters.md](docs/agents_rules/user_interface/sidebars/chats/dynamic_topics/clusters.md): the clustered dynamic topics, the translation table, and the button "Rebuild the clusters".
    - [display.md](docs/agents_rules/user_interface/sidebars/chats/dynamic_topics/display.md): the dynamic topics on the row of each chat, and the dynamic topic bar.
    - [extraction_methods.md](docs/agents_rules/user_interface/sidebars/chats/dynamic_topics/extraction_methods.md): the methods "Keyword" and "Language model", and their caches.

The maximum size of a file in the folder `docs/agents_rules`, and in all its subfolders, is 10000 bytes. When a file is larger, split it by topic into smaller files, and list the new files here. The test of the package `agents_rules_checker` fails when a file is larger.

## Documentation metadata

Every documentation file in the folder `docs`, and in all its subfolders, has a metadata header immediately after its title.

- The header has these lines, in this order:
  - `Created`: the date on which the file was created.
  - `Last updated`: the date of the last change of the file.
  - `Status`: one short phrase that says what the file is, for example "Maintained index for agents and tools".
  - `Related framing`: a link to the document that sets the frame of this file, for example the project instructions.
  - `Related rules`: a link to each rule file that applies to this file. Add this line only when a rule file applies.
  - `Related issue`: a link to the GitHub issue that this file comes from. Add this line only when an issue exists.
- Write each date as day, month name, and year, for example `13 October 2026`.
- Update `Last updated` in every change of the file, and keep the date accurate.
- Write each link as a relative link that works from the folder of the file.
- The file `docs/release_notes/prefix.md` has no header. The release script copies this file into the text of every GitHub release, so a header would appear in every release.

Example, for the file `docs/team_collaboration_process/index.md`:

```markdown
# Team collaboration process index

- Created: 4 October 2026
- Last updated: 8 October 2026
- Status: Maintained index for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../agents_rules/glossary.md)

This file lists the files and the subfolders of this folder, for agents and tools.

- [README.md](README.md): the overview of this folder, for people.
- [team_workflow.md](team_workflow.md): the way several developers work on one repository.
```

## Documentation folders

Every folder in the folder `docs`, at every depth, has two files that describe the folder. The folder `docs` itself has them too.

- `README.md` is for people. It says in plain words what the folder is for, and how to read the files of the folder. It has the metadata header, and its `Status` is "Maintained overview for people".
- `index.md` is for agents and tools. It has the metadata header, and its `Status` is "Maintained index for agents and tools". After the header, it has one introduction sentence, then one bullet for each file and each subfolder of the folder, in this form: a relative link, a colon, and one sentence that says what the file or the subfolder holds. The bullet for a subfolder links to the file `index.md` of that subfolder. The bullet for `README.md` is included. The file does not repeat the content of the files that it lists.
- When you add, rename, move, or delete a file or a subfolder of the folder `docs`, update the file `index.md` of its folder in the same change.
- When you create a new folder in the folder `docs`, create its two files in the same change, and add a bullet for the new folder in the file `index.md` of its parent folder.

## Issue Fix Workflow

Every issue fix in this repository has two parts: the Issue Fix Setup, then the Issue Fix Completion. Between the two parts, you make the change and the developer tests it. Example of an issue fix: remove the folder `docs/issues`. Every issue fix is made in a temporary worktree, always, and never in the main checkout.

The Issue Fix Setup starts when the developer asks you to fix an issue, for example "fix the issue 35". The developer gives the number of the issue. If the developer does not give the number, ask for it. Creating the GitHub issue is not a step of the Issue Fix Workflow. See the section "GitHub and GitLab" for how to create an issue.

### Issue Fix Setup

1. Read the issue.
2. Create a temporary worktree for the fix. Always create it. Never make the change in the main checkout, and never create only a temporary branch without a worktree. Name the temporary branch after the fix and the issue number, for example `remove-docs-issues-35`.
   - To create the temporary worktree, run `pnpm worktree:create <name>` at the root of the main checkout, where `<name>` is the name of the temporary branch. Never create a worktree with `git worktree add`. The command `pnpm worktree:create` also clones the compiled Rust files of the main checkout into the worktree, so the first build in the worktree is much faster and uses much less disk space. Build the main checkout before you create a worktree. At the end, the command runs `pnpm install --frozen-lockfile` in the new worktree, so the worktree has a `node_modules` folder and `pnpm dev` runs at once. Do not run `pnpm install` by hand after the command. When the installation fails, the command prints the error and exits with a non-zero code, and the worktree stays.
   - Work only in the folder of the temporary worktree, `.claude/worktrees/<name>`. Read, edit, write, build, test, and run every file there, and never in the main checkout.
3. Make the change in the temporary worktree. Every commit message mentions the issue number.

### Issue Fix Completion

The Issue Fix Completion starts when the developer is satisfied with the change.

1. Make the last commit. It uses `fixes #<issue number>` in its message.
2. Create a pull request (on GitLab, a merge request) from the temporary branch.
3. Merge the pull request (on GitLab, the merge request) into the personal development branch of the developer, for example `dev_jerome` or `dev_eric`.
4. Delete the temporary branch, locally and on the remote repository. Remove the temporary worktree.
5. Close the issue.

## GitHub and GitLab

Every command for GitHub in this section has a matching command for GitLab, as [docs/agents_rules/github_and_gitlab_support.md](docs/agents_rules/github_and_gitlab_support.md) requires. This repository is on GitHub, so use the `gh` command here. Use the `glab` command only for a repository on GitLab.

### Creating an issue

Create an issue with the `gh` command: `gh issue create --title "<title>" --body "<body>"`. On GitLab, use the `glab` command: `glab issue create --title "<title>" --description "<body>"`. If you have screenshots related to the issue, attach them in the same command, as described in the section "Attaching an image to an issue".

### Attaching an image to an issue

Attach every screenshot, image, or video related to an issue with the `--attach` flag of the `gh` command. The flag uploads the file to GitHub and adds it to the issue. The flag takes a file path, and an optional alt text after `#`. Repeat the flag to attach several files, up to 50 files per command.

- When you create the issue: `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'`
- When the issue already exists: `gh issue edit <issue number> --attach './screenshot.png#Alt text'`

On GitLab, the `--attach` option of the `glab` command works in the same way, but it is experimental, and it takes a file path without alternative text.

- When you create the issue: `glab issue create --title "<title>" --description "<body>" --attach './screenshot.png'`
- When the issue already exists: `glab issue update <issue number> --attach './screenshot.png'`

Never commit an image to the repository, and never push an image to a branch, only to show it in an issue. If you need a screenshot in a specific place in the body, write `![Alt text](./screenshot.png)` in the body, and the `--attach` flag rewrites the reference to the uploaded file.

## Updating the user documentation

- The user documentation of the public website is written by a coding agent, never by hand. Run `pnpm docs:update_by_ai` to update it. The command and its rules are in [packages/dev_tools/documentation_updater/CONTEXT.md](packages/dev_tools/documentation_updater/CONTEXT.md).
- Documentation generation reads Git history and leaves generated files uncommitted. The script and its coding agent never stage files, create or switch branches, write commits, push, merge, or create a pull request or merge request. The developer handles those actions outside this process.
- When you add, change, or remove a feature, change the rule files in `docs/agents_rules/user_interface`. The coding agent writes the documentation from these rules, so a rule that is missing or old makes a documentation page wrong.

## Starting Heidrun to test it or to take a screenshot

Always start Heidrun with the command line option `--no-splash-screen` when you start it to test it, and above all when you take a screenshot. Without the option, the splash screen covers the application for 3 seconds after the main window appears, so a screenshot taken in this time shows the splash screen and not the application, and you wait for nothing.

- In development, run `pnpm dev -- -- --no-splash-screen` at the root of the repository or of the worktree. The command `tauri dev` gives the arguments after its second `--` to the application.
- For the built application on macOS, run `open -a Heidrun --args --no-splash-screen` while Heidrun is not running.
- The rules of the splash screen are in [docs/agents_rules/user_interface/window/window_state_and_start.md](docs/agents_rules/user_interface/window/window_state_and_start.md), in the section "Splash screen".

## Tests

- `pnpm test` at the repository root runs the tests of every package, and exits with a non-zero code when a test fails.
- `pnpm --filter web_frontend test` runs the Vitest tests of the package `packages/apps/web_frontend`. The test files sit next to the code, and are named `*.test.ts`.
- `pnpm --filter desktop_tauri test` runs `cargo test` for the package `packages/apps/desktop_tauri`. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter website_public test` runs the Vitest tests of the package `packages/auxiliary/website_public`: the configuration, the pages, the page of shortcuts, the identity texts, the splash image component, the favicon, and a complete build of the website. The test files sit in the folder `tests`.
- `pnpm --filter raw_coding_agent_cli test` runs the Vitest tests of the package `packages/auxiliary/raw_coding_agent_cli`, with fake `claude` and `codex` commands. The test files sit in the folder `tests`.
- `pnpm --filter change_log_generator test` runs the Vitest tests of the package `packages/dev_tools/change_log_generator`: the range of the pull requests, the heading, the place of a section in the file, and the command line. The test files sit in the folder `tests`.
- `pnpm --filter worktree_tools test` runs the Vitest tests of the package `packages/dev_tools/worktree_tools`: the creation of a worktree with the clone of the compiled Rust files, the cleaning of the old target folders, and the two command lines. The test files sit in the folder `tests`.
- `pnpm --filter video_recorder test` runs the Vitest tests of the package `packages/dev_tools/video_recorder`: the calculation of the cut and of `clicks.json`, the command line `video:cut` with a real `ffmpeg`, and the click logger script. The test files sit in the folder `tests`.
- `pnpm --filter agents_rules_checker test` runs the Vitest tests of the package `packages/dev_tools/agents_rules_checker`: the maximum size of a file in the folder `docs/agents_rules` and in all its subfolders, as the section "Agent rules" gives it. The test files sit in the folder `tests`.
- When you add a feature, add the tests that match the feature in the same change. When you fix a bug, add a test that fails without the fix.
