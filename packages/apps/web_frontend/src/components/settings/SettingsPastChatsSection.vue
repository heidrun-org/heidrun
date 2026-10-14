<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The choices of the delay between two reads of the files of the chats, in seconds, in the order of the buttons. */
const REFRESH_CHOICES = [
  { seconds: 5, labelKey: "settingsPastChats.refresh5" },
  { seconds: 10, labelKey: "settingsPastChats.refresh10" },
  { seconds: 30, labelKey: "settingsPastChats.refresh30" },
  { seconds: 60, labelKey: "settingsPastChats.refresh60" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <div>{{ t("settingsPastChats.refreshLabel") }}</div>
    <div class="btn-group" role="group" :aria-label="t('settingsPastChats.refreshLabel')">
      <label v-for="choice in REFRESH_CHOICES" :key="choice.seconds" class="btn-check btn-outline theme-secondary">
        <input v-model="settings.chatsRefreshSeconds" type="radio" name="chats-refresh-seconds" autocomplete="off" :value="choice.seconds" />
        {{ t(choice.labelKey) }}
      </label>
    </div>
    <div class="form-text">{{ t("settingsPastChats.refreshHelp") }}</div>
  </div>
</template>
