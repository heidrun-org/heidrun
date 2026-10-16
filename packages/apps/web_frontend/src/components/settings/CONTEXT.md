# Directory Context: `/packages/apps/web_frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsSwitchRow.vue`: one Bootstrap switch with its label, bound with `v-model`. The slot after the label holds an information card. Every boolean setting uses it.
- `SettingsGeneralSection.vue`: the language and the time format (button groups of radio inputs), and the working days (button group of checkbox inputs).
- `SettingsTerminalSection.vue`: the font, the font size that zooms the whole window, and the mouse behaviour (`mouseMode`).
- `SettingsAgentsSection.vue`: the section "Coding agents". One switch per coding agent of `../../lib/agents.ts`, saved in `ownedAgents` (the whole row is the label of its switch, and `../StatusBar.vue` shows the quota of a coding agent only when its switch is on), the default command of a new tab (`newTabCommand`, started by the plus button of `../TabBar.vue` through `../../stores/newPane.ts`), and the heading "Quit" with the switch `keepAgentsRunningAfterQuit` and its information card.
- `SettingsConfirmationsSection.vue`: the headings "Ask before closing" (workspace, tab, pane) and "Ask before deleting" (saved search). The settings are read by `../WorkspaceStatusSummary.vue`, `../TabBar.vue`, `../PaneCard.vue`, `../SavedSearchModal.vue`, and `../../stores/settings.ts`.
- `SettingsGuardsSection.vue`: the section "Guards". One list of the project guards, then the built-in guards (label "Hardcoded", switch, written in the list `disabled` of the key `guards` of `.heidrun/config.json`). It opens `../GuardModal.vue` through `../../stores/guard_window.ts`. The changes are written by `../../stores/project.ts` and built by `../../lib/guards_edit.ts`. The button "Change this guard" of `../DangerModal.vue` opens the section through `../../stores/guards.ts`.
- `SettingsNotificationsSection.vue`: the notification settings, and the switch for the status item in the macOS menu bar (`showStatusItem`, handled by `../../stores/statusItem.ts`).
- `SettingsSidebarsSection.vue`: one heading for each sidebar section. "Needs you": the switch `showWorkspacesInNeedsYou` (`../NeedsYouWorkspaces.vue`, placed by `../ToHandlePanel.vue`) and the delay after which finished items disappear (`finishedTtl`). "Past chats": the delay between two reads of the chats (`chatsRefreshSeconds`, read by `../ChatsPanel.vue`). "Source control": the delay of the Git fetch in the background (`gitFetchMinutes`, read by `../../stores/git_background_fetch.ts`).
- `SettingsDynamicTopicsSection.vue`: the switch `dynamicTopics` (first control; off: no dynamic topic bar, no label, no computation, no call, read by `../ChatsPanel.vue` and by the stores `dynamic_topics.ts`, `language_model_topics.ts`, `topic_clusters.ts`), the extraction method (`dynamicTopicExtraction`), the switch `clusteredDynamicTopics`, the button "Rebuild the clusters", and the lines that say why the last call gave nothing. Two information cards (`../InformationCard.vue`, placement "bottom") hold the help.
- `SettingsMobileAccessSection.vue`: the mobile access switch, the QR code and the paired devices.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- One section component per entry of the sidebar of `SettingsModal.vue`. A setting lives in the section of its topic, never in a section of its own.
- The Settings window writes no style rule except the dark layer behind it and the QR code box. Every control is a Bootstrap component or a Bootstrap utility class. The test `../../settings_bootstrap.test.ts` checks it.
- A boolean setting is a Bootstrap switch, never a checkbox: the Bootstrap part `check` is not loaded, because other components use the class name `check` for their own labels.

## Background
- The Settings window is rebuilt with Bootstrap in [issue 412](https://github.com/heidrun-org/heidrun/issues/412), after [issue 141](https://github.com/heidrun-org/heidrun/issues/141) and [issue 189](https://github.com/heidrun-org/heidrun/issues/189).
- Sections: Agents [122](https://github.com/heidrun-org/heidrun/issues/122) and [139](https://github.com/heidrun-org/heidrun/issues/139), New tab [328](https://github.com/heidrun-org/heidrun/issues/328), Dynamic topics [260](https://github.com/heidrun-org/heidrun/issues/260), [265](https://github.com/heidrun-org/heidrun/issues/265), [266](https://github.com/heidrun-org/heidrun/issues/266), [272](https://github.com/heidrun-org/heidrun/issues/272), [422](https://github.com/heidrun-org/heidrun/issues/422).
- Git fetch in the background [432](https://github.com/heidrun-org/heidrun/issues/432).
- The eleven sections are cut down to eight, with each setting in the section of its topic, in [issue 556](https://github.com/heidrun-org/heidrun/issues/556). The identifier `agents` stays the identifier of the section "Coding agents". The section "Guards" is the ninth, in [issue 596](https://github.com/heidrun-org/heidrun/issues/596).
- Settings: the window replaces three top bar buttons [60](https://github.com/heidrun-org/heidrun/issues/60), "Keep agents running" [175](https://github.com/heidrun-org/heidrun/issues/175), "Ask before closing" [309](https://github.com/heidrun-org/heidrun/issues/309) and [333](https://github.com/heidrun-org/heidrun/issues/333).
