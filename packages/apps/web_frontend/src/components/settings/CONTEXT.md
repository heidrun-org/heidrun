# Directory Context: `/packages/apps/web_frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsSwitchRow.vue`: one Bootstrap switch with its label, bound with `v-model`. The slot after the label holds an information card. Every boolean setting uses it.
- `SettingsGeneralSection.vue`: the language and the time format (button groups of radio inputs), the working days (button group of checkbox inputs), the headings "Ask before closing" (workspace, tab, pane), "Ask before deleting" (saved search), "Quit" (`keepAgentsRunningAfterQuit`, with an information card), and "Git" (`gitFetchMinutes`, a button group of five radio inputs, read by `../../stores/git_background_fetch.ts`). The settings are read by `../WorkspaceStatusSummary.vue`, `../TabBar.vue`, `../PaneCard.vue`, `../SavedSearchModal.vue`, and `../../stores/settings.ts`.
- `SettingsTerminalSection.vue`: the font, and the font size that zooms the whole window.
- `SettingsNewTabSection.vue`: the setting `newTabCommand`, a button group of three radio inputs. The plus button of `../TabBar.vue` starts this command, through `../../stores/newPane.ts`.
- `SettingsMouseSection.vue`: the mouse mode.
- `SettingsFinishedItemsSection.vue`: the delay after which finished items disappear.
- `SettingsNeedsYouSection.vue`: the switch `showWorkspacesInNeedsYou`: the list of workspaces at the bottom of the Needs you sidebar section (`../NeedsYouWorkspaces.vue`, placed by `../ToHandlePanel.vue`). [Issue 417](https://github.com/heidrun-org/heidrun/issues/417).
- `SettingsNotificationsSection.vue`: the notification settings, and the switch for the status item in the macOS menu bar (`showStatusItem`, handled by `../../stores/statusItem.ts`).
- `SettingsMobileAccessSection.vue`: the mobile access switch, the QR code and the paired devices.
- `SettingsAgentsSection.vue`: one switch per coding agent of `../../lib/agents.ts`, saved in `ownedAgents`. The whole row is the label of its switch. `../StatusBar.vue` shows the quota of a coding agent only when its switch is on.
- `SettingsPastChatsSection.vue`: the setting `chatsRefreshSeconds`, a button group of four radio inputs (5, 10, 30, or 60 seconds), the delay between two reads of the chats, read by `../ChatsPanel.vue`. [Issue 442](https://github.com/heidrun-org/heidrun/issues/442).
- `SettingsDynamicTopicsSection.vue`: the switch `dynamicTopics` (first control; off: no dynamic topic bar, no label, no computation, no call, read by `../ChatsPanel.vue` and by the stores `dynamic_topics.ts`, `language_model_topics.ts`, `topic_clusters.ts`), the extraction method (`dynamicTopicExtraction`, read by `../ChatsPanel.vue`), the switch `clusteredDynamicTopics`, the button "Rebuild the clusters", and the lines that say why the last call gave nothing. Two information cards (`../InformationCard.vue`, placement "bottom") hold the help.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- One section component per entry of the sidebar of `SettingsModal.vue`.
- The Settings window writes no style rule except the dark layer behind it and the QR code box. Every control is a Bootstrap component or a Bootstrap utility class. The test `../../settings_bootstrap.test.ts` checks it.
- A boolean setting is a Bootstrap switch, never a checkbox: the Bootstrap part `check` is not loaded, because other components use the class name `check` for their own labels.

## Background
- The Settings window is rebuilt with Bootstrap in [issue 412](https://github.com/heidrun-org/heidrun/issues/412), after [issue 141](https://github.com/heidrun-org/heidrun/issues/141) and [issue 189](https://github.com/heidrun-org/heidrun/issues/189).
- Sections: Agents [122](https://github.com/heidrun-org/heidrun/issues/122) and [139](https://github.com/heidrun-org/heidrun/issues/139), New tab [328](https://github.com/heidrun-org/heidrun/issues/328), Dynamic topics [260](https://github.com/heidrun-org/heidrun/issues/260), [265](https://github.com/heidrun-org/heidrun/issues/265), [266](https://github.com/heidrun-org/heidrun/issues/266), [272](https://github.com/heidrun-org/heidrun/issues/272), [422](https://github.com/heidrun-org/heidrun/issues/422).
- Git fetch in the background [432](https://github.com/heidrun-org/heidrun/issues/432).
- Settings: the window replaces three top bar buttons [60](https://github.com/heidrun-org/heidrun/issues/60), "Keep agents running" [175](https://github.com/heidrun-org/heidrun/issues/175), "Ask before closing" [309](https://github.com/heidrun-org/heidrun/issues/309) and [333](https://github.com/heidrun-org/heidrun/issues/333).
