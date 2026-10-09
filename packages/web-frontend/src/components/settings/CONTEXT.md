# Directory Context: `/packages/web-frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsTerminalSection.vue`: the font and the font size of the terminal.
- `SettingsMouseSection.vue`: the mouse mode.
- `SettingsFinishedItemsSection.vue`: the delay after which finished items disappear.
- `SettingsNotificationsSection.vue`: the notification settings.
- `SettingsLanguageSection.vue`: the language of the user interface.
- `SettingsMobileAccessSection.vue`: the mobile access switch, the QR code and the paired devices.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- The shared styles of the classes `keys`, `seg` and `sr` are defined in `SettingsModal.vue`, not in a section component.
- One section component per entry of the sidebar of `SettingsModal.vue`.

## Background
- The Settings window replaces three buttons of the top bar: [issue 60](https://github.com/heidrun-org/heidrun/issues/60).
