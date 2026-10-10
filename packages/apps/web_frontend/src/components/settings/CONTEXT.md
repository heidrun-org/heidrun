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
- `SettingsAgentsSection.vue`: one switch per coding agent of `../../lib/agents.ts`, saved in the setting `ownedAgents`. The whole row of an agent is the switch: a click anywhere on the row, or the Space key or the Enter key on the focused row, changes it. A switched on agent means the user has a valid subscription or access for it. The status bar `../StatusBar.vue` shows the quota of a coding agent only when this agent is switched on, and it changes at once when a switch moves.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- The shared styles of the classes `keys`, `seg` and `sr` are defined in `SettingsModal.vue`, not in a section component.
- One section component per entry of the sidebar of `SettingsModal.vue`.

## Background
- The section Agents comes from [issue 122](https://github.com/heidrun-org/heidrun/issues/122). Every agent starts switched off. The whole row is the switch: [issue 139](https://github.com/heidrun-org/heidrun/issues/139).
- The Settings window replaces three buttons of the top bar: [issue 60](https://github.com/heidrun-org/heidrun/issues/60).
