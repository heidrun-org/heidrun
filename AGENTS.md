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

The folder `docs/agents_rules` holds all the rules that every agent follows. Read the glossary before you change the code, and keep the glossary up to date when a word changes. The rules of the user interface are split by topic into many small files: read only the files that match the part that you change, and keep them up to date when a rule changes.

- The glossary, in the folder `docs/agents_rules/glossary`: the definition of each word that the project uses for one of its parts, and the official name "coding agent" for Claude Code, Codex, and Antigravity. Use these words, and no other word, in the code, in the documents, and in the conversations. Read the files that match the part that you change:
  - [index.md](docs/agents_rules/glossary/index.md): the list of the files of the glossary.
  - [workspaces_tabs_and_panes.md](docs/agents_rules/glossary/workspaces_tabs_and_panes.md): the workspace, the tab, the pane, the coding agent, the tab bar, the viewport, the pinned pane, the column of pinned panes, and the usage wheel.
  - [sidebars.md](docs/agents_rules/glossary/sidebars.md): the left sidebar, the right sidebar, the sidebar section, the Clipboard, Launchers, Source control, Code hosting, and File explorer sidebar sections, the launcher, the sidebar icon bar, the Files window, the large Git window, and the Left sidebar enable disable button.
  - [chats.md](docs/agents_rules/glossary/chats.md): the chat, the chat session, the Past chats sidebar section, and the Chats sort dropdown menu.
  - [coding_agent_configuration.md](docs/agents_rules/glossary/coding_agent_configuration.md): the coding agent configuration, the memory file, the subagent, the skill, and the removed configuration item. Read it when you change the tables `memory_files`, `subagents`, or `skills` of the package `data_layer_coding_agents`.
  - [dynamic_topics.md](docs/agents_rules/glossary/dynamic_topics.md): the definition of each word of the dynamic topics of the Past chats sidebar section: the dynamic topic, the raw dynamic topic, the clustered dynamic topic, the translation table, the dynamic topic source information, the dynamic topic extraction, and the dynamic topic bar. Read it when you change the Past chats sidebar section or the dynamic topics.
  - [code_hosting.md](docs/agents_rules/glossary/code_hosting.md): the definition of each word of the search in the Code hosting sidebar section: the search line, the search field, and the saved search. Read it when you change the Code hosting sidebar section.
  - [status_bar.md](docs/agents_rules/glossary/status_bar.md): the status bar, the status bar section, the information card, and the Workspace status bar section.
  - [guards.md](docs/agents_rules/glossary/guards.md): the definition of each word of the guards: the guard, the built-in guard, the project guard, the action, the line, the guard window, the confirmation window, and the Guards section of the Settings window. Read it when you change the guards, the guard window, the confirmation window, or the Guards section.
  - [pane_focus_history.md](docs/agents_rules/glossary/pane_focus_history.md): the definition of each word of the navigation through the panes that had the focus: the top bar, the pane focus history, the Back button, and the Forward button. Read it when you change the top bar or the focus of the panes.
  - [heidrun_mobile.md](docs/agents_rules/glossary/heidrun_mobile.md): the definition of each word of Heidrun Mobile: Heidrun Mobile, the mobile website, the mobile server, the pairing key, the bottom bar, the plain terminal on the phone, the macro button, and the microphone button. Read it when you change the packages `mobile_website` or `mobile_server`.
  - [person_work.md](docs/agents_rules/glossary/person_work.md): the definition of each word of the statistic of the work of one person: the Work of one person tab, its source, the Git history, the AI cost, the workspace selector, the unit of the AI cost, the person, the person chooser, the time range, the day, the totals, the average per day, and the bar chart. Read it when you change the tab "Work of one person" of the Statistics window.
  - [statistics_charts.md](docs/agents_rules/glossary/statistics_charts.md): the definition of the chart legend and of the chart information card, which every chart of the Statistics window has. Read it when you add or change a chart of the Statistics window.
  - [macros.md](docs/agents_rules/glossary/macros.md): the definition of each word of the macros: the macro, the hard-coded macro, the personal macro, the personal macro file, the project macro, and the command line `heidrun_ctrl`. Read it when you change the macros or the command line `heidrun_ctrl`.
  - [user_activity.md](docs/agents_rules/glossary/user_activity.md): the definition of each word of the activity of the developer in front of Heidrun: the user activity time, the action, the cool down, the active period, the user activity record, the User activity sidebar section, the Statistics window, the User activity tab, the histogram of the user activity time, and the slot. Read it when you change the detection of the activity of the developer, its sidebar section, or the Statistics window.
  - [issue_fix_workflow.md](docs/agents_rules/glossary/issue_fix_workflow.md): the definition of each word of the Issue Fix Workflow: the Issue Fix Workflow, the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, the Issue Fix Completion, the added request, the related added request, and the unrelated added request. Read it when you change the section "Issue Fix Workflow" of this file.
  - [voice_input.md](docs/agents_rules/glossary/voice_input.md): the definition of each word of the voice input: the voice input, the push-to-talk button, the level bars, the Whisper model, and the Voice input section of the Settings window. Read it when you change the voice input or the package `voice_input`.
  - [data_layer_operation_log.md](docs/agents_rules/glossary/data_layer_operation_log.md): the definition of each word of the operation log of the data layer: the operation, the operation log, the start event and the completion event, the caller, the kind, the workload, the nested operation, the pattern, the unfinished operation, the replay, the snapshot, and the isolated database. Read it when you change the operation log or the command `heidrun_data operations`.
- [docs/agents_rules/data_layer_operation_log.md](docs/agents_rules/data_layer_operation_log.md): the rule that every public function of the four data layer packages and of `heidrun_data` is recorded in the operation log with the package `data_layer_operation_log`, what the log never does (change a result, hide an error, hold a secret), the measure, and the replay. Read this file each time that you add or change an operation of a data layer package or of `heidrun_data`.
- [docs/agents_rules/github_and_gitlab_support.md](docs/agents_rules/github_and_gitlab_support.md): the rule that every support added for GitHub is also added for GitLab, the words "pull request" and "merge request", and the matching `gh` and `glab` commands. Read this file each time that you add or change a support for GitHub, or a `gh` command in a document.
- [docs/agents_rules/issue_fix_implementation.md](docs/agents_rules/issue_fix_implementation.md): the rules of the part Issue Fix Implementation: the two kinds of added request, the comment on the issue, the new issue, and the description of the pull request. Read this file each time that the developer asks for more work that the issue does not describe.
- [docs/agents_rules/data_layer_access.md](docs/agents_rules/data_layer_access.md): the rule that the Past chats sidebar section and the Statistics window get all their data through the packages of the folder `packages/data_layers`, with the table of the synchronize commands and the read commands, the exceptions, the audit of the bypasses, and the check of the package `data_layer_boundary_checker`. Read this file each time that you change the Past chats sidebar section, the Statistics window, or a package of the data layer, and never read a chat session file, start `git`, `gh`, or `glab`, make a network request, or run SQL for this data in the desktop application or in the web page.

The rules of the user interface: where each part goes, and how each part works. Each file starts with the part that it covers.

- The window, in the folder `docs/agents_rules/user_interface/window`:
  - [layout.md](docs/agents_rules/user_interface/window/layout.md): the layout of the window, the rules of the layout, the text that must stay on one line, and the files.
  - [colors_and_scroll_bars.md](docs/agents_rules/user_interface/window/colors_and_scroll_bars.md): the colors and the scroll bars.
  - [abbreviated_times.md](docs/agents_rules/user_interface/window/abbreviated_times.md): the circled question mark after each abbreviated time, such as "Just now", and its title with the exact time.
  - [statistics_window.md](docs/agents_rules/user_interface/window/statistics_window.md): the item "Statistics" of the More menu, the Statistics window, its tab list, and where the data of the tab "User activity" comes from.
  - [statistics_charts.md](docs/agents_rules/user_interface/window/statistics_charts.md): the rules that every chart of the Statistics window follows: a chart legend, and a chart information card in HTML with an arrow that points to the bar under the pointer. Read it each time that you add or change a chart of the Statistics window, and add the same legend, the same card, and the same tests to a new chart.
  - [statistics_user_activity.md](docs/agents_rules/user_interface/window/statistics_user_activity.md): the tab "User activity" of the Statistics window: the time range, the slot length, the workspaces, the histogram of the user activity time, and its tests.
  - [statistics_user_activity_stacked_bars.md](docs/agents_rules/user_interface/window/statistics_user_activity_stacked_bars.md): the stacked bars of the histogram of the tab "User activity": the parts, the colors of the workspaces, the legend, the chart information card, and its tests.
  - [statistics_person_work.md](docs/agents_rules/user_interface/window/statistics_person_work.md): the tab "Work of one person" of the Statistics window: the source (Git history or AI cost), the unit, the person chooser, the time range, the totals, the bar chart of each day, and its tests.
  - [statistics_person_work_inputs.md](docs/agents_rules/user_interface/window/statistics_person_work_inputs.md): the inputs of the tab "Work of one person": the two columns, the labels, the small buttons, the source, the metric, the person chooser, and the time range.
  - [statistics_person_work_legend_filter.md](docs/agents_rules/user_interface/window/statistics_person_work_legend_filter.md): the filter of the chart legend of the tab "Work of one person": a click on a name, one filter for each chart, and the memory of the filter between two runs.
  - [statistics_person_work_workspace.md](docs/agents_rules/user_interface/window/statistics_person_work_workspace.md): the workspace selector of the tab "Work of one person": the buttons with a checkbox, the first choice, the sums of several workspaces, what a change reads, and its tests.
  - [statistics_person_work_slots.md](docs/agents_rules/user_interface/window/statistics_person_work_slots.md): the slot length of the tab "Work of one person": the buttons of each time range, the slots (hours, days of 23 and 25 hours), the labels and the titles of the bar chart, and its tests.
  - [statistics_git_history.md](docs/agents_rules/user_interface/window/statistics_git_history.md): the source "Git history" of the tab "Work of one person": what counts, and where its data comes from.
  - [statistics_ai_cost.md](docs/agents_rules/user_interface/window/statistics_ai_cost.md): the source "AI cost" of the tab "Work of one person": what counts, the unit (US dollars or tokens), the cost of each hour of a chat, the chats with no known price, where its data comes from, and its tests.
  - [statistics_totals.md](docs/agents_rules/user_interface/window/statistics_totals.md): the lines added and deleted, and the average per day under each total, of the tab "Work of one person": what they are, how the value is written, where the calculation is, and the tests.
  - [settings_guards.md](docs/agents_rules/user_interface/window/settings_guards.md): the Guards section of the Settings window: the list of the project guards and the built-in guards, the guard window with its field "Try a command", and the button "Change this guard" of the confirmation window.
  - [settings_information_cards.md](docs/agents_rules/user_interface/window/settings_information_cards.md): the rule that every option of the Settings window has a circled question mark and an information card, the layout of the card, the rows of a list, and the tests. Read it each time that you add or change an option of the Settings window.
  - [find_new_skills_window.md](docs/agents_rules/user_interface/window/find_new_skills_window.md): the window "Find new skills": its four lines, the three sources (skills.sh, Local folder, Code hosting), the information cards, and the rows of the result.
  - [settings_voice_input.md](docs/agents_rules/user_interface/window/settings_voice_input.md): the Voice input section of the Settings window, the download of a Whisper model, the push-to-talk button (a long press and a click), the level bars, the microphone permission, and the tests. Read it each time that you change the voice input.
  - [status_bar.md](docs/agents_rules/user_interface/window/status_bar.md): the status bar and the menu of the status item.
  - [status_bar_git.md](docs/agents_rules/user_interface/window/status_bar_git.md): the Git branch section of the status bar: the branch picker, the synchronization with the upstream branch, the fetch in the background, and the counts.
  - [window_state_and_start.md](docs/agents_rules/user_interface/window/window_state_and_start.md): the position and size of the window, the last state of each option, the splash screen, the notice of the missing programs Herdr and ngrok, and the goat sounds.
- Heidrun Mobile, in the folder `docs/agents_rules/user_interface/heidrun_mobile`:
  - [screens.md](docs/agents_rules/user_interface/heidrun_mobile/screens.md): the screens of the mobile website (the welcome page, the Dashboard, Needs you, Panes, the screen of one pane with the macro button and the microphone button, and Launchers), the screen of a plain terminal (read-only), and the guards of the phone.
- The workspaces, the tabs, and the panes, in the folder `docs/agents_rules/user_interface/workspaces_tabs_and_panes`:
  - [workspace.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/workspace.md): the workspace.
  - [tabs.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/tabs.md): the tabs.
  - [panes.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/panes.md): the panes, the colors of Codex in a pane, and the state "Needs you".
  - [composition_bar.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/composition_bar.md): the composition bar under the focused pane: the drop of images, the toggle button of the header, the plus button, the text input, the push-to-talk button, the button "Send", the paste in the focused pane, and the big view of the images.
  - [pane_focus_history.md](docs/agents_rules/user_interface/workspaces_tabs_and_panes/pane_focus_history.md): the pane focus history, and the Back button and the Forward button of the top bar.
- The sidebars, in the folder `docs/agents_rules/user_interface/sidebars`:
  - [sidebars.md](docs/agents_rules/user_interface/sidebars/sidebars.md): the sidebars and the clipboard.
  - [source_control.md](docs/agents_rules/user_interface/sidebars/source_control.md): the Source control sidebar section.
  - [code_hosting.md](docs/agents_rules/user_interface/sidebars/code_hosting.md): the Code hosting sidebar section: the header buttons, the icon, the two lists, the rows, the information card, and the cache.
  - [code_hosting_search.md](docs/agents_rules/user_interface/sidebars/code_hosting_search.md): the search line of each list of the Code hosting sidebar section, the saved searches, and the windows "Save this search" and "Edit the saved search".
  - [files.md](docs/agents_rules/user_interface/sidebars/files.md): the File explorer sidebar section.
  - [needs_you_workspaces.md](docs/agents_rules/user_interface/sidebars/needs_you_workspaces.md): the list of workspaces at the bottom of the Needs you sidebar section, and the heading "Needs you" of the section "Sidebars" of the Settings window.
  - [user_activity.md](docs/agents_rules/user_interface/sidebars/user_activity.md): the User activity sidebar section, the detection of the activity of the developer, and the user activity records.
- The Past chats sidebar section, in the folder `docs/agents_rules/user_interface/sidebars/chats`:
  - [chats_list.md](docs/agents_rules/user_interface/sidebars/chats/chats_list.md): the list of chats, the buttons "Show more" and "Show less", and the refresh of the list.
  - [chats_header_and_sort.md](docs/agents_rules/user_interface/sidebars/chats/chats_header_and_sort.md): the two button groups at the top, the views, and the Chats sort dropdown menu.
  - [chat_summary.md](docs/agents_rules/user_interface/sidebars/chats/chat_summary.md): the three lines of the summary of a chat, how the program reads the summary, the tokens, and the estimated cost, its cache, and the width of an information card.
  - [past_chats_settings_section.md](docs/agents_rules/user_interface/sidebars/chats/past_chats_settings_section.md): the heading "Past chats" of the section "Sidebars" of the Settings window, with the delay between two reads of the chats.
  - The information cards of a chat, in the folder `docs/agents_rules/user_interface/sidebars/chats/information_cards`:
    - [files_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/files_line.md): the files line and its information card.
    - [references_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/references_line.md): the references line and its information card.
    - [dates_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/dates_line.md): the dates line and its information card, with the tokens and the estimated cost of the chat.
    - [worktrees_line.md](docs/agents_rules/user_interface/sidebars/chats/information_cards/worktrees_line.md): the worktrees line and its information card.
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
- Related rules: [Glossary of Heidrun](../agents_rules/glossary/index.md)

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

Every issue fix in this repository has four parts: the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, then the Issue Fix Completion. In the Issue Fix Setup, you prepare the work. In the Issue Fix Implementation, you make the change. In the Issue Fix Review, the developer tests the change. Each time that the developer asks for a change in the Issue Fix Review, the work goes back to the Issue Fix Implementation. Example of an issue fix: remove the folder `docs/issues`. Every issue fix is made in a temporary worktree, always, and never in the main checkout.

The Issue Fix Setup starts when the developer asks you to fix an issue, for example "fix the issue 35". The developer gives the number of the issue. If the developer does not give the number, ask for it. Creating the GitHub issue is not a step of the Issue Fix Workflow. See the section "GitHub and GitLab" for how to create an issue.

### Issue Fix Setup

1. Read the issue.
2. Rename the chat according to its content.
   - The identifier of this chat is in the environment variable `CLAUDE_CODE_HOST_SESSION_ID`. Read it with `echo $CLAUDE_CODE_HOST_SESSION_ID`, then give it as `session_id` to the tool `mcp__ccd_session_mgmt__set_session_title`.
   - Never search for this chat in the list of sessions: this chat is often missing from the list. Never tell the developer that the rename is not possible before you read the variable.
   - For Codex, or when the variable is empty, skip this step and say so in one line.
3. Create a temporary worktree for the fix. Always create it. Never make the change in the main checkout, and never create only a temporary branch without a worktree. Name the temporary branch after the fix and the issue number, for example `remove-docs-issues-35`.
   - To create the temporary worktree, run `pnpm worktree:create <name>` at the root of the main checkout, where `<name>` is the name of the temporary branch. Never create a worktree with `git worktree add`. The command `pnpm worktree:create` also clones the compiled Rust files of the main checkout into the worktree, so the first build in the worktree is much faster and uses much less disk space. Build the main checkout before you create a worktree. At the end, the command runs `pnpm install --frozen-lockfile` in the new worktree, so the worktree has a `node_modules` folder and `pnpm dev` runs at once. Do not run `pnpm install` by hand after the command. When the installation fails, the command prints the error and exits with a non-zero code, and the worktree stays.
   - Work only in the folder of the temporary worktree, `.claude/worktrees/<name>`. Read, edit, write, build, test, and run every file there, and never in the main checkout.

### Issue Fix Implementation

The Issue Fix Implementation starts when the Issue Fix Setup is done. It starts again each time that the developer asks for a change in the Issue Fix Review ([issue 610](https://github.com/heidrun-org/heidrun/issues/610)).

1. Make the change in the temporary worktree. Every commit message mentions the issue number.
2. When the developer asks for more work that the issue does not describe, this work is an added request. Follow [docs/agents_rules/issue_fix_implementation.md](docs/agents_rules/issue_fix_implementation.md). In short:
   - A related added request stays in the same issue and in the same temporary worktree. When the work is done, add one comment to the issue that lists what the developer asked, what changed, and which files changed.
   - An unrelated added request becomes a new issue, with its own temporary worktree. Ask the developer before you create the new issue.
3. When the change is done, start the Issue Fix Review.

### Issue Fix Review

The Issue Fix Review starts when the Issue Fix Implementation is done. Without it, the developer cannot run the application, cannot observe the result, and cannot validate the change ([issue 500](https://github.com/heidrun-org/heidrun/issues/500)). The Issue Fix Review has two separate messages ([issue 526](https://github.com/heidrun-org/heidrun/issues/526)). Never put the two messages in one message.

The first message asks the developer to review. Always do these steps, in this order:

1. Tell the developer to look at the result.
2. Give the command line that launches the application in the temporary worktree, in its own `bash` code block:
   ```bash
   cd <path of the temporary worktree> && pnpm dev
   ```
3. Say in one or two short lines what to look at, so that the developer can validate the change.
4. Stop. The first message has no question and no button, and it says nothing about the pull request (on GitLab, the merge request) or about the merge. Write the command line in the closing text of the message, never before a question box, so that the developer always sees it.

The developer runs the application, then says that the result is reviewed. The second message comes only after that. It asks one question: whether the result is good. It does not ask about the pull request or about the merge.

- Each time that the developer asks for a change, go back to the Issue Fix Implementation. Then give the command line again, and start again with the first message.
- Never start the Issue Fix Completion (the last commit, the pull request, the merge, and the closing of the issue) before the developer says that the result is good.

### Issue Fix Completion

The Issue Fix Completion starts when the developer says that the result of the Issue Fix Review is good.

1. Make the last commit. It uses `fixes #<issue number>` in its message.
2. Create a pull request (on GitLab, a merge request) from the temporary branch. Its description lists each added request, as [docs/agents_rules/issue_fix_implementation.md](docs/agents_rules/issue_fix_implementation.md) says.
3. Merge the pull request (on GitLab, the merge request) into the personal development branch of the developer, for example `dev_jerome` or `dev_eric`.
4. Delete the temporary branch, locally and on the remote repository. Remove the temporary worktree.
5. Close the issue.
6. Rename the chat according to its content.

## GitHub and GitLab

Every command for GitHub in this section has a matching command for GitLab, as [docs/agents_rules/github_and_gitlab_support.md](docs/agents_rules/github_and_gitlab_support.md) requires. This repository is on GitHub, so use the `gh` command here. Use the `glab` command only for a repository on GitLab.

### Creating an issue

Create an issue with the `gh` command: `gh issue create --title "<title>" --body "<body>"`. On GitLab, use the `glab` command: `glab issue create --title "<title>" --description "<body>"`. If you have screenshots related to the issue, attach them in the same command, as described in the section "Attaching an image to an issue". Write the text of the issue as the section "Writing the text of an issue" says.

### Attaching an image to an issue

Attach every screenshot, image, or video related to an issue with the `--attach` flag of the `gh` command. The flag uploads the file to GitHub and adds it to the issue. The flag takes a file path, and an optional alt text after `#`. Repeat the flag to attach several files, up to 50 files per command.

- When you create the issue: `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'`
- When the issue already exists: `gh issue edit <issue number> --attach './screenshot.png#Alt text'`

On GitLab, the `--attach` option of the `glab` command works in the same way, but it is experimental, and it takes a file path without alternative text.

- When you create the issue: `glab issue create --title "<title>" --description "<body>" --attach './screenshot.png'`
- When the issue already exists: `glab issue update <issue number> --attach './screenshot.png'`

Never commit an image to the repository, and never push an image to a branch, only to show it in an issue. If you need a screenshot in a specific place in the body, write `![Alt text](screenshot.png)` in the body, and the `--attach` flag rewrites the reference to the uploaded file.

### Writing the text of an issue

These two rules apply to the body of an issue, and to every comment that you write in an issue.

- Every file name of the repository that you write in the text of an issue is a link to the file. Write the file name as the label of the link, and the address of the file on GitHub as the target, for example `[HOW_TO_RELEASE.md](https://github.com/heidrun-org/heidrun/blob/main/HOW_TO_RELEASE.md)`. Link to the branch `main`, or to the branch that holds the file when `main` does not have the file yet. On GitLab, the address of a file has the form `https://<host>/<group>/<project>/-/blob/main/<path>`.
- Every issue that you write in the text of an issue is its own bullet that starts with a dash, and the bullet holds only the plain address of the issue, for example `- https://github.com/heidrun-org/heidrun/issues/506`. GitHub changes such a bullet into the title, the state, and the number of the issue. A numbered list, a link with a label, or an issue number inside a sentence shows only the number. Write the words that explain the issues above the list, not inside the bullet. On GitLab, write each issue as its own bullet in the same way, with a plus sign after the reference, for example `- #506+`, so that GitLab shows the title.

## Starting Heidrun to test it or to take a screenshot

Always start Heidrun with the command line option `--no-splash-screen` when you start it to test it, and above all when you take a screenshot. Without the option, the splash screen covers the application for 3 seconds after the main window appears, so a screenshot taken in this time shows the splash screen and not the application, and you wait for nothing.

- In development, run `pnpm dev -- -- --no-splash-screen` at the root of the repository or of the worktree. The command `tauri dev` gives the arguments after its second `--` to the application.
- For the built application on macOS, run `open -a Heidrun --args --no-splash-screen` while Heidrun is not running.
- The rules of the splash screen are in [docs/agents_rules/user_interface/window/window_state_and_start.md](docs/agents_rules/user_interface/window/window_state_and_start.md), in the section "Splash screen".

## Environment variables

The file `.env.example` at the root of the repository lists and explains every environment variable that the application reads. A developer copies it to the file `.env`, which Git ignores, and removes the comment sign of each variable that the developer wants. A development build of the application loads the file `.env` at the start, with the module `packages/apps/desktop_tauri/src/environment_file.rs`. A release build never loads it. A variable that is already set in the shell keeps the value of the shell.

- When you add code that reads an environment variable, add the variable to `.env.example` in the same change: a block of comments that says what the variable does, its default value, and its accepted values, then the variable on one commented-out line.
- Keep every variable of `.env.example` commented out, so that a copy of the file changes nothing.
- The Rust test of the module `environment_file` fails when `.env.example` and the code do not list the same variables.

## Tests

- `pnpm test` at the repository root runs the tests of every package, and exits with a non-zero code when a test fails.
- The script `test` of every package that uses Vitest is `vitest run --minWorkers=1 --maxWorkers=2`, so that Vitest starts at most two worker processes at the same time, and the computer of the developer stays fast. Vitest 2 needs both options: the default minimum is the number of processor cores minus one, and Vitest stops with an error when the minimum is higher than the maximum. Give both options to every new package that uses Vitest.
- `pnpm --filter web_frontend test` runs the Vitest tests of the package `packages/apps/web_frontend`. The test files sit next to the code, and are named `*.test.ts`.
- `pnpm --filter desktop_tauri test` builds the package `mobile_website`, then runs `cargo test` for the package `packages/apps/desktop_tauri`. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter website_public test` runs the Vitest tests of the package `packages/auxiliary/website_public`: the configuration, the pages, the page of shortcuts, the identity texts, the macOS quarantine message in the release text and the developer documents, the splash image component, the favicon, the link preview cards (the Open Graph tags, the X card tags, and the card image), and a complete build of the website. The test files sit in the folder `tests`.
- `pnpm --filter coding_agent_cli test` runs `cargo test` for the package `packages/auxiliary/coding_agent_cli`, with fake `claude` and `codex` commands. The tests of the command line sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter mobile_website test` runs the Vitest tests of the package `packages/auxiliary/mobile_website`: the Needs you screen, the Panes screen, the screen of one pane with the macro button and the microphone button, the Launchers screen, the bottom bar, the confirmation sheet, the pairing key and the calls to the mobile server, the address of each screen, the colors of the output, the development server with its fake computer, and the rules of a page under a strict content security policy. The tests start the whole page against a fake computer, and the test files sit in the folder `tests`. `pnpm --filter mobile_website build` builds the website. `pnpm --filter mobile_website dev` starts a development server that reloads the page when a file changes, with a fake computer, or with the real desktop application when the variables `MOBILE_API_TARGET` and `MOBILE_API_HOST` (the host name of the tunnel) are set.
- `pnpm --filter mobile_server test` builds the package `mobile_website`, then runs `cargo test` for the package `packages/auxiliary/mobile_server`: the checks of a request (the header Host, which must be the host name of the tunnel, the header Origin, the pairing key, and the lock after ten bad keys), the closed list of methods, the routes with a fake handler, the files of the mobile website with their types, the file `mobile.json`, the finding of the program `ngrok`, the reading of the address of the tunnel, and the life of the server on the loopback address, with a fake `ngrok` program. One more test opens a real tunnel, so it runs only by hand with `cargo test live_ -- --ignored`. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_code_hosting test` runs `cargo test` for the package `packages/data_layers/data_layer_code_hosting`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the two JSON schemas, the SQLite file, the reading of the pages of GitHub with a fake GitHub, the modes initialize and update, and the read-only query. The tests of the command line use a fake `gh` command and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_source_control test` runs `cargo test` for the package `packages/data_layers/data_layer_source_control`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the JSON schema, the SQLite file, the reading of the commits of a real Git repository, the modes initialize and update, and the read-only query. The tests of the command line use a real Git repository in a temporary folder and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_user_activity test` runs `cargo test` for the package `packages/data_layers/data_layer_user_activity`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the JSON schema, the SQLite file, the reading of the file of user activity records, the modes initialize and update, and the read-only query. The tests of the command line use a fake file of user activity records in a temporary folder and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_coding_agents test` runs `cargo test` for the package `packages/data_layers/data_layer_coding_agents`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the reading of the chat session files of Claude Code and of Codex, the cache of the scans, the reading of the memory files, the subagents, and the skills with their headers, the four JSON schemas, the SQLite file with its link tables and the three tables of the configuration of the coding agent, the mark of a removed file, the tokens of each minute (the table, the index and its query plan, the write that changes only the rows that changed, the chat session that two files hold, the folder and the workspaces that overlap, the days of a time zone with a day of 23 or 25 hours), the model prices (the versions, the fetch that fails, the refresh once a day), the view with the cost (a model with no price has no cost, and the prices of the cached tokens that fall back to the input price), the modes initialize and update, and the read-only query. The tests of the command line use fake folders of the two coding agents, a fake home folder, and a real Git repository with a fake remote, and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter heidrun_data test` runs `cargo test` for the package `packages/data_layers/heidrun_data`: the four sources and their fixed order, the command `operations` (the actions info, summary, list, replay, snapshot, and overhead, the usage patterns, the operations that never ended, the replay of a query on a snapshot, the replay of a synchronization in an isolated file that never touches the real file, the log that cannot be written, and the programs that write the log together), the commands `update`, `initialize`, `query`, `sources`, `schema`, `usage` (the tokens and the cost by minute, hour, and day, in a time zone), and `read` with the history of one file, the limit added to a query, the output formats, the errors as JSON, the lock of the SQLite file, and the file `SKILL.md` compared with the help and the schema. The tests of the command line use a real Git repository in a temporary folder, a fake `gh` command, fake folders of the two coding agents with one memory file, one skill in the repository, a fake home folder, and a fake file of user activity records, and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_operation_log test` runs `cargo test` for the package `packages/data_layers/data_layer_operation_log`: the record format and its version, the removal of the secrets from a text, a field, and an address, the SQL statement without its values, the file that grows to 8 MiB and is replaced, the lines that two threads write together, the events that cannot be written and are reported by the next event, the nesting of the operations, the operation that panics or is dropped, the reading of the file with the unfinished operations (running or interrupted), the filters, the groups and the percentiles, and the measure of the cost of the log (a budget of 1 millisecond and 2 KiB for an operation). The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter voice_input test` runs `cargo test` for the package `packages/auxiliary/voice_input`: the conversion of the audio of the microphone to 16 kilohertz and one channel, the list of the 12 Whisper models, the download of a model with a fake server (a complete download, a download that stops early, a missing file, and no server), the cleaning of the text of Whisper, the refusal of an unknown language, and a spoken sentence changed into text with the real model `tiny`, which the first run downloads once from Hugging Face into the folder of the build, with the logs of Whisper that go to a file (the rotation of a large file, and the lines of the real model in the file). One test records the real microphone and runs only by hand with `cargo test live_ -- --ignored`. The building of the package needs `cmake`. The tests of the integration sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter heidrun_ctrl test` runs `cargo test` for the package `packages/auxiliary/heidrun_ctrl`: the three kinds of macro, the file of the personal macros, the keys `prompts` and `launchers` of the file `.heidrun/config.json` with their other keys kept (and the old key `actions`), the four orders list, add, update, and delete on the macros and on the launchers with their errors, the launcher of the kind Coding agent kept intact, the output formats markdown and json, the arguments of the command line, and the file `SKILL.md` compared with the help, with its examples run. The tests of the command line use a temporary `HEIDRUN_DIR` and a temporary project and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter change_log_generator test` runs the Vitest tests of the package `packages/dev_tools/change_log_generator`: the range of the pull requests, the heading, the place of a section in the file, and the command line. The test files sit in the folder `tests`.
- `pnpm --filter worktree_tools test` runs the Vitest tests of the package `packages/dev_tools/worktree_tools`: the creation of a worktree with the clone of the compiled Rust files, the cleaning of the old target folders, and the two command lines. The test files sit in the folder `tests`.
- `pnpm --filter video_recorder test` runs the Vitest tests of the package `packages/dev_tools/video_recorder`: the calculation of the cut and of `clicks.json`, the command line `video:cut` with a real `ffmpeg`, and the click logger script. The test files sit in the folder `tests`.
- `pnpm --filter install_script_tests test` runs the Vitest tests of the package `packages/dev_tools/install_script_tests`: the script `scripts/install.sh`, run with a fake `curl`, a fake `hdiutil`, a fake `ditto`, a fake `uname`, and a fake `pgrep`, in a temporary folder in place of `/Applications`. It checks the copy, the eject, the deletion of the temporary folder, and the message of each stop. The test files sit in the folder `tests`.
- `pnpm --filter agents_rules_checker test` runs the Vitest tests of the package `packages/dev_tools/agents_rules_checker`: the maximum size of a file in the folder `docs/agents_rules` and in all its subfolders, as the section "Agent rules" gives it. The test files sit in the folder `tests`.
- `pnpm --filter data_layer_boundary_checker test` runs the Vitest tests of the package `packages/dev_tools/data_layer_boundary_checker`: the check that the Past chats sidebar section and the Statistics window get all their data through the packages of the folder `packages/data_layers` (the Rust files of the folders `past_chats` and `statistics` of the desktop application, the files outside these folders that name a package of the data layer, the manifest `Cargo.toml`, and the web page files of the two parts), run on the real repository, and the bypass tests that add each kind of forbidden code to a copy of the files and prove that the check fails. The test files sit in the folder `tests`.
- `pnpm --filter multi_layer_graph test` runs the Vitest tests of the package `packages/experiments/multi_layer_graph`: the reading of a temporary SQLite file with the tables of the data layer packages, the finding of `#N` and `Fixes #N` in a text, the building of the multi-layer graph, the command line, and the degree, the neighbors, the search, and the markup of the panels of the page. The test files sit in the folder `tests`.
- `pnpm --filter parallax_dino_runner test` runs the Vitest tests of the package `packages/experiments/parallax_dino_runner`: the lane change and the jump of the dinosaur, the touch between the dinosaur and the things, the shots and the size change of the rocks, the ammunition and the crates, the size and the lane of the thing of each commit, the generator of the commits and the crates, the end of a run at the newest commit, the file `commits.json` and the fake commits, the script that reads the Git history of a real Git repository in a temporary folder and gives the lanes, the static build with relative addresses and no network address, the speed and the score, the parallax layers, the random numbers with a seed, the world of the game with its commands and its runs, and the shape of the pixel pictures. The test files sit in the folder `tests`.
- `pnpm --filter promotional_videos test` runs the Vitest tests of the package `packages/experiments/promotional_videos`: the scenario "the dinosaur hits a boulder" played with the rules of the game on a fixture of 40 commits, the keys of the commands, and the filter graph of `ffmpeg` (the comic words, the crossfade of the intro, the delay of the recorded sound, the fade-out of the intro music, the end of the outro music at its last silence, and the fade to the outro). The tests also read the reports of `ffmpeg` that find the last silence of a music file, and they compare the document `data/scenarios/video_game_first.scenario.md` with the scenario of the code. The tests start no browser. The test files sit in the folder `tests`.
- When you add a feature, add the tests that match the feature in the same change. When you fix a bug, add a test that fails without the fix.
