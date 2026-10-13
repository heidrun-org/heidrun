<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The three commands that the pane of a new tab can run, in the order of the buttons. */
const COMMANDS = [
  { id: "terminal", labelKey: "settingsNewTab.terminalLabel", titleKey: "settingsNewTab.terminalTitle" },
  { id: "claude", labelKey: "settingsNewTab.claudeLabel", titleKey: "settingsNewTab.claudeTitle" },
  { id: "codex", labelKey: "settingsNewTab.codexLabel", titleKey: "settingsNewTab.codexTitle" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <h4 class="h6 fw-semibold text-body-secondary mb-0">{{ t("settingsNewTab.commandTitle") }}</h4>
    <div class="seg" role="radiogroup" :aria-label="t('settingsNewTab.commandTitle')">
      <button
        v-for="command in COMMANDS"
        :key="command.id"
        role="radio"
        :title="t(command.titleKey)"
        :aria-checked="settings.newTabCommand === command.id"
        :class="{ on: settings.newTabCommand === command.id }"
        @click="settings.newTabCommand = command.id"
      >
        {{ t(command.labelKey) }}
      </button>
    </div>
    <div class="keys">{{ t("settingsNewTab.help") }}</div>
  </div>
</template>
