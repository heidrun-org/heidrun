# Directory Context: `/packages/apps/web_frontend/src/components/skills`

## Purpose
The parts of the two skills windows: the frame, the level switch, the notice, the list of installed skills, and the search on skills.sh. The windows `../InstalledSkillModal.vue` and `../FindNewSkillsModal.vue` put them together.

## Key Exports & Entry Points
- `../InstalledSkillModal.vue`: the window Installed skill. It lists the installed skills, and each one can be inspected or deleted. It has no level switch and no search.
- `../FindNewSkillsModal.vue`: the window Find new skills. It shows the level switch (User first, then Workspace), the notice, and the search on skills.sh. Each result can be inspected or installed. A skill is installed for the agents switched on in the section Agents of the Settings window. The level is saved in the settings.
- `../SkillFileModal.vue`: the window opened by the button "Inspect". It shows a SKILL.md file rendered or as highlighted source, and it sits above the two skills windows. Both skills windows open from the menu with three vertical dots of the top bar (`../MoreMenu.vue`) and from the command palette.
- `SkillsLevelSwitch.vue`: the choice between the workspace level and the user level.
- `SkillsNoAgentNotice.vue`: the notice with the button "Open Agents", shown when no coding agent is switched on.
- `SkillsWindow.vue`: the frame of both skills windows: the title, the question mark with the help text, the close button, the Escape key, and the loading of the skills. A skills window gives it a title, a help text, and its content in the slot.
- `InstalledSkillsList.vue`: the list of installed skills, one `InstalledSkillRow.vue` for each skill (inspect, add link, delete).
- `FindSkills.vue`: the search on skills.sh, one `SkillSearchResultRow.vue` for each result (inspect, install).
- `skills_section.css`: the styles of the lists and rows, shared by both row components.
- `skills_test_support.ts`: the fake backend and the helpers shared by the tests of this folder.

## Rules
- A component here reads and changes the state through `../../stores/skills.ts` and `../../stores/settings.ts`, and never calls `invoke` itself.
- The shared styles in `skills_section.css` start with `.skillsSection`, so they apply only inside a skills window.
- Each component has its own test file next to it. A test mounts only the component under test.

## Background
- The folder comes from the split of the section Skills of the Settings window: [issue 131](https://github.com/heidrun-org/heidrun/issues/131). The skills left the Settings window and became two windows: [issue 138](https://github.com/heidrun-org/heidrun/issues/138).
- The window Find new skills installs a skill with the command `skills_install` of `desktop_tauri/src/skills/install.rs`. The search uses the endpoint `https://skills.sh/api/search`, because the documented API `/api/v1` needs a Vercel OIDC token that a desktop application cannot have: [issue 34](https://github.com/heidrun-org/heidrun/issues/34).
