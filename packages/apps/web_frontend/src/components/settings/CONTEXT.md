# Directory Context: `/packages/apps/web_frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsTerminalSection.vue`: the font, and the font size that zooms the whole window.
- `SettingsMouseSection.vue`: the mouse mode.
- `SettingsFinishedItemsSection.vue`: the delay after which finished items disappear.
- `SettingsNotificationsSection.vue`: the notification settings.
- `SettingsGeneralSection.vue`: the language of the user interface the time format (automatic, 12-hour, 24-hour), and the working days.
- `SettingsMobileAccessSection.vue`: the mobile access switch, the QR code and the paired devices.
- `SettingsAgentsSection.vue`: one switch per coding agent of `../../lib/agents.ts`, saved in the setting `ownedAgents`. A switched on agent means the user has a valid subscription or access for it.
- `SettingsSkillsSection.vue`: the section Skills. It loads the installed skills and puts together the parts of the subfolder `skills/`. A skill is installed for the agents switched on in the section Agents. The button "Inspect" opens the window `../SkillModal.vue`, which shows a SKILL.md file rendered or as highlighted source. The two foldable parts remember their state, and the level, in the settings.
- `skills/`: the parts of the section Skills: level switch, notice, list of installed skills, search. See its own CONTEXT.md.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- The shared styles of the classes `keys`, `seg` and `sr` are defined in `SettingsModal.vue`, not in a section component.
- One section component per entry of the sidebar of `SettingsModal.vue`.

## Background
- The section Agents comes from [issue 122](https://github.com/heidrun-org/heidrun/issues/122). Every agent starts switched off.
- The section Skills installs a skill with the command `skills_install` of `desktop_tauri/src/skills/install.rs`. The search uses the endpoint `https://skills.sh/api/search`, because the documented API `/api/v1` needs a Vercel OIDC token that a desktop application cannot have: [issue 34](https://github.com/heidrun-org/heidrun/issues/34).
- The Settings window replaces three buttons of the top bar: [issue 60](https://github.com/heidrun-org/heidrun/issues/60).
