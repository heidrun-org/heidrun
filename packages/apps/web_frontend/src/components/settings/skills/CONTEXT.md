# Directory Context: `/packages/apps/web_frontend/src/components/settings/skills`

## Purpose
The parts of the section Skills of the Settings window: the level switch, the notice, the list of installed skills, and the search on skills.sh. The section `../SettingsSkillsSection.vue` puts them together.

## Key Exports & Entry Points
- `SkillsLevelSwitch.vue`: the choice between the workspace level and the user level.
- `SkillsNoAgentNotice.vue`: the notice with the button "Open Agents", shown when no coding agent is switched on.
- `SkillsFold.vue`: a heading that folds its content. It holds no state: the parent gives `open` and receives `toggle`.
- `InstalledSkillsList.vue`: the foldable list of installed skills, one `InstalledSkillRow.vue` for each skill (inspect, add link, delete).
- `FindSkills.vue`: the foldable search on skills.sh, one `SkillSearchResultRow.vue` for each result (inspect, install).
- `skills_section.css`: the styles of the lists and rows, shared by both row components.
- `skills_test_support.ts`: the fake backend and the helpers shared by the tests of this folder.

## Rules
- A component here reads and changes the state through `../../../stores/skills.ts` and `../../../stores/settings.ts`, and never calls `invoke` itself.
- The shared styles in `skills_section.css` start with `.skillsSection`, so they apply only inside the section.
- Each component has its own test file next to it. A test mounts only the component under test.

## Background
- The folder comes from the split of `SettingsSkillsSection.vue`: [issue 131](https://github.com/heidrun-org/heidrun/issues/131).
