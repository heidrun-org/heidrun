# User interface of Heidrun: Find new skills window

- Created: 16 October 2026
- Last updated: 18 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: coding agent configuration](../../glossary/coding_agent_configuration.md), [GitHub and GitLab support](../../github_and_gitlab_support.md)
- Related issue: [issue 289](https://github.com/heidrun-org/heidrun/issues/289), [issue 608](https://github.com/heidrun-org/heidrun/issues/608), [issue 609](https://github.com/heidrun-org/heidrun/issues/609), [issue 646](https://github.com/heidrun-org/heidrun/issues/646)

This file gives the rules of the window "Find new skills", which the item "Find new skills" of the More menu opens. The code of the window is in `packages/apps/web_frontend/src/components/skills`, and its backend is in `packages/apps/desktop_tauri/src/skills`.

## The four lines

The window has four lines, from the top to the bottom. Each line has a title, a circled question mark that opens an information card, and a visible label on each input.

1. "Installation level": the buttons "User" and "Workspace". The level is saved in the settings.
2. "Source of the skill": the buttons "skills.sh", "Local folder", and "Code hosting". The source is not saved: the window starts on "skills.sh".
3. The field of the chosen source, and only that field:
   - "skills.sh": a search field. The search starts 300 milliseconds after the last key typed.
   - "Local folder": a text field for the full path of a folder, and the button "Choose folder…" that opens the folder chooser of the system. The folder is checked 300 milliseconds after the last key typed, and at once when the chooser gives a folder.
   - "Code hosting": a text field for the web address of a skill folder on GitHub or GitLab. The address is read at each key typed, and GitHub or GitLab is asked only when the developer inspects or installs.
4. "Result": the rows of the result, each with the buttons "Inspect" and "Install". Before the first answer, the line says "No result yet."

## The information cards

- Each card uses the layout of [issue 608](https://github.com/heidrun-org/heidrun/issues/608): a title, then one block for each paragraph, with the placement "bottom-center".
- The texts of a card are in the files `settingsSkills.json` (English and French), under the keys `help_<line>_title`, `help_<line>_label`, `help_<line>_<block>_title`, and `help_<line>_<block>_text`. The blocks of each card are listed in `skills_help.ts`.
- The key Escape closes an open card first, and the window only at the second key.
- A new line of the window gets a circled question mark with a card, and a new input gets a visible label. The test `FindNewSkillsModal.test.ts` checks both.

## The sources

- A source keeps its own text, and a change of source shows the result of the field of the new source again.
- An answer that comes after the developer changed the text or the source never replaces the newest result.
- "skills.sh": the result rows show the number of installs. A web address typed here is only a search.
- "Local folder": one row, with the full path of the folder and the words "Local folder". The folder is copied to the installation level, and nothing is sent over the network. A folder with no file `SKILL.md` gives an error and no row.
- "Code hosting": one row for a GitHub folder or a GitLab folder, with the words "GitHub folder" or "GitLab folder". A text that is not the web address of a skill folder gives an error and no row. Every support for GitHub is also a support for GitLab, as [github_and_gitlab_support.md](../../github_and_gitlab_support.md) requires. Only a public repository works.

## The installed skills

- An installed skill from a local folder shows "Local folder · <full path>" as its origin. An installed skill from GitLab shows "GitLab · <project>".
- The origin file `.heidrun_origin.json` of a local folder has an empty `source` and a `folder_path`.
