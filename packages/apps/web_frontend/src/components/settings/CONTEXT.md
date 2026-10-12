# Directory Context: `/packages/apps/web_frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsTerminalSection.vue`: the font, and the font size that zooms the whole window.
- `SettingsMouseSection.vue`: the mouse mode.
- `SettingsFinishedItemsSection.vue`: the delay after which finished items disappear.
- `SettingsNotificationsSection.vue`: the notification settings, and the checkbox that shows or hides the status item in the macOS menu bar (the setting `showStatusItem`, handled by `../../stores/statusItem.ts`).
- `SettingsGeneralSection.vue`: the language of the user interface the time format (automatic, 12-hour, 24-hour), the working days, and the checkbox "Keep agents running after quit" (the setting `keepAgentsRunningAfterQuit`, sent to the Rust side by `../../stores/settings.ts`).
- `SettingsMobileAccessSection.vue`: the mobile access switch, the QR code and the paired devices.
- `SettingsAgentsSection.vue`: one switch per coding agent of `../../lib/agents.ts`, saved in the setting `ownedAgents`. The whole row of an agent is the switch: a click anywhere on the row, or the Space key or the Enter key on the focused row, changes it. A switched on agent means the user has a valid subscription or access for it. The status bar `../StatusBar.vue` shows the quota of a coding agent only when this agent is switched on, and it changes at once when a switch moves.
- `SettingsDynamicTopicsSection.vue`: the choice "Extraction method", two radio buttons ("Keyword" and "Language model", which is disabled until that method is built), saved in the setting `dynamicTopicExtraction`. The Chats sidebar section `../ChatsPanel.vue` reads it. It also holds the switch "Enable clustered dynamic topics" (the setting `clusteredDynamicTopics`), the button "Rebuild the clusters", and the line that says why the last call gave no cluster (the store `../../stores/topic_clusters.ts`). The help of the two parts is in two information cards, each one opened by a circled question mark (`../InformationCard.vue` with the placement "bottom").

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- The shared styles of the classes `keys`, `seg` and `sr` are defined in `SettingsModal.vue`, not in a section component.
- One section component per entry of the sidebar of `SettingsModal.vue`.

## Background
- The section Agents comes from [issue 122](https://github.com/heidrun-org/heidrun/issues/122). Every agent starts switched off. The whole row is the switch: [issue 139](https://github.com/heidrun-org/heidrun/issues/139).
- The Settings window replaces three buttons of the top bar: [issue 60](https://github.com/heidrun-org/heidrun/issues/60).
- The checkbox "Keep agents running after quit" comes from [issue 175](https://github.com/heidrun-org/heidrun/issues/175).
- The section Dynamic topics comes from [issue 260](https://github.com/heidrun-org/heidrun/issues/260).
- The switch "Clustered dynamic topics" comes from [issue 265](https://github.com/heidrun-org/heidrun/issues/265).
- The two information cards that replace the help paragraphs of the section Dynamic topics come from [issue 266](https://github.com/heidrun-org/heidrun/issues/266).
