<script setup lang="ts">
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.askBeforeClosingTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.confirmWorkspaceClose" :label="t('settingsGeneral.confirmWorkspaceClose')" />
      <SettingsSwitchRow v-model="settings.confirmTabClose" :label="t('settingsGeneral.confirmTabClose')" />
      <SettingsSwitchRow v-model="settings.confirmPaneClose" :label="t('settingsGeneral.confirmPaneClose')" />
    </div>

    <div class="d-flex flex-column gap-2">
      <h4 class="form-label m-0">{{ t("settingsGeneral.askBeforeDeletingTitle") }}</h4>
      <SettingsSwitchRow v-model="settings.confirmSavedSearchDelete" :label="t('settingsGeneral.confirmSavedSearchDelete')" />
    </div>
  </div>
</template>
