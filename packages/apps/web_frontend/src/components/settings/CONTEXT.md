# Directory Context: `/packages/apps/web_frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsSwitchRow.vue`: one Bootstrap switch with its label, bound with `v-model`. The slot after the label holds the circled question mark. Every boolean setting uses it.
- `SettingsOptionHelp.vue`: the circled question mark of an option and its information card (`../InformationCard.vue`, placement "bottom"). The properties are the key of the name of the option and the blocks, each one a key of a title and a key of a text. The texts are in the locale file `settingsHelp.json`.
- `SettingsGeneralSection.vue`: the language and the time format (button groups of radio inputs), and the working days (button group of checkbox inputs).
- `SettingsTerminalSection.vue`: the font, the font size that zooms the whole window, and the mouse behaviour (`mouseMode`).
- `SettingsAgentsSection.vue`: the section "Coding agents". One switch per coding agent of `../../lib/agents.ts`, saved in `ownedAgents` (the whole row is the label of its switch), the default command of a new tab (`newTabCommand`), and the switch `keepAgentsRunningAfterQuit`.
- `SettingsConfirmationsSection.vue`: the headings "Ask before closing" (workspace, tab, pane) and "Ask before deleting" (saved search).
- `SettingsGuardsSection.vue`: the section "Guards": one list of the project guards, then the built-in guards. It opens `../GuardModal.vue` through `../../stores/guard_window.ts`. The changes are written by `../../stores/project.ts`.
- `SettingsNotificationsSection.vue`: the notification settings, and the switch `showStatusItem` (`../../stores/statusItem.ts`).
- `SettingsSidebarsSection.vue`: one heading for each sidebar section: "Needs you" (`showWorkspacesInNeedsYou`, `finishedTtl`), "Past chats" (`chatsRefreshSeconds`), and "Source control" (`gitFetchMinutes`).
- `SettingsDynamicTopicsSection.vue`: the switch `dynamicTopics`, the extraction method (`dynamicTopicExtraction`), the switch `clusteredDynamicTopics`, and the button "Rebuild the clusters".
- `SettingsMobileAccessSection.vue`: the mobile access switch, the switch `mobileTerminalTyping`, the QR code, and the paired devices.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- One section component per entry of the sidebar of `SettingsModal.vue`. A setting lives in the section of its topic, never in a section of its own.
- The Settings window writes no style rule except the dark layer behind it and the QR code box. Every control is a Bootstrap component or a Bootstrap utility class. The test `../../settings_bootstrap.test.ts` checks it.
- A boolean setting is a Bootstrap switch, never a checkbox: the Bootstrap part `check` is not loaded, because other components use the class name `check` for their own labels.
- Every option has the attribute `data-option` and a `SettingsOptionHelp`. The help text of an option is inside its information card, never on the page. A new option goes in the list of `settings_information_cards.test.ts`, which fails when an option has no card. The rules are in [settings_information_cards.md](../../../../../../docs/agents_rules/user_interface/window/settings_information_cards.md).
- The circled question mark of a row that is a `label` is inside a `span` with `@click.capture.prevent`, so that a click on it does not switch the row.

## Background
- The Settings window is rebuilt with Bootstrap in [issue 412](https://github.com/heidrun-org/heidrun/issues/412). The eight sections come from [issue 556](https://github.com/heidrun-org/heidrun/issues/556), and the section "Guards" is the ninth, in [issue 596](https://github.com/heidrun-org/heidrun/issues/596).
- The first information cards are in [issue 266](https://github.com/heidrun-org/heidrun/issues/266), and every option has one since [issue 608](https://github.com/heidrun-org/heidrun/issues/608).
- Git fetch in the background [432](https://github.com/heidrun-org/heidrun/issues/432). Dynamic topics [260](https://github.com/heidrun-org/heidrun/issues/260) and [422](https://github.com/heidrun-org/heidrun/issues/422).
