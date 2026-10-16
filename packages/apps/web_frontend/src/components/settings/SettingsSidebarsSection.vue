<script setup lang="ts">
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The choices of the delay after which the finished items disappear, in minutes, in the order of the buttons. 0 is never. */
const TTL_OPTIONS = [
  { v: 5, labelKey: "fontMenu.minutes5" },
  { v: 15, labelKey: "fontMenu.minutes15" },
  { v: 60, labelKey: "fontMenu.hour1" },
  { v: 0, labelKey: "fontMenu.never" },
];

/** The choices of the delay between two reads of the files of the chats, in seconds, in the order of the buttons. */
const REFRESH_CHOICES = [
  { seconds: 5, labelKey: "settingsPastChats.refresh5" },
  { seconds: 10, labelKey: "settingsPastChats.refresh10" },
  { seconds: 30, labelKey: "settingsPastChats.refresh30" },
  { seconds: 60, labelKey: "settingsPastChats.refresh60" },
] as const;

/** The choices of the delay of the fetch in the background, in minutes, in the order of the buttons. 0 is off. */
const GIT_FETCH_CHOICES = [
  { minutes: 0, labelKey: "settingsGeneral.gitFetchOff" },
  { minutes: 1, labelKey: "settingsGeneral.gitFetch1" },
  { minutes: 5, labelKey: "settingsGeneral.gitFetch5" },
  { minutes: 10, labelKey: "settingsGeneral.gitFetch10" },
  { minutes: 30, labelKey: "settingsGeneral.gitFetch30" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.needsYouTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.showWorkspacesInNeedsYou" :label="t('needsYouWorkspaces.showWorkspaces')" />
      <div class="form-text">{{ t("needsYouWorkspaces.showWorkspacesHelp") }}</div>
      <div>{{ t("fontMenu.finishedLabel") }}</div>
      <div class="btn-group" role="group" :aria-label="t('fontMenu.finishedLabel')">
        <label v-for="o in TTL_OPTIONS" :key="o.v" class="btn-check btn-outline theme-secondary" :title="t('fontMenu.finishedTitle')">
          <input v-model="settings.finishedTtl" type="radio" name="finished-ttl" autocomplete="off" :value="o.v" />
          {{ t(o.labelKey) }}
        </label>
      </div>
      <div class="form-text">{{ t("fontMenu.finishedHelp") }}</div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.pastChatsTitle") }}</h4>
      <div>{{ t("settingsPastChats.refreshLabel") }}</div>
      <div class="btn-group" role="group" :aria-label="t('settingsPastChats.refreshLabel')">
        <label v-for="choice in REFRESH_CHOICES" :key="choice.seconds" class="btn-check btn-outline theme-secondary">
          <input v-model="settings.chatsRefreshSeconds" type="radio" name="chats-refresh-seconds" autocomplete="off" :value="choice.seconds" />
          {{ t(choice.labelKey) }}
        </label>
      </div>
      <div class="form-text">{{ t("settingsPastChats.refreshHelp") }}</div>
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsSidebars.sourceControlTitle") }}</h4>
      <div>{{ t("settingsGeneral.gitFetchLabel") }}</div>
      <div class="btn-group" role="group" :aria-label="t('settingsGeneral.gitFetchLabel')">
        <label v-for="choice in GIT_FETCH_CHOICES" :key="choice.minutes" class="btn-check btn-outline theme-secondary">
          <input v-model="settings.gitFetchMinutes" type="radio" name="git-fetch-minutes" autocomplete="off" :value="choice.minutes" />
          {{ t(choice.labelKey) }}
        </label>
      </div>
      <div class="form-text">{{ t("settingsGeneral.gitFetchHelp") }}</div>
    </div>
  </div>
</template>
