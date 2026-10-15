<script setup lang="ts">
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="d-flex flex-column gap-2">
    <SettingsSwitchRow v-model="settings.showWorkspacesInNeedsYou" :label="t('needsYouWorkspaces.showWorkspaces')" />
    <div class="form-text">{{ t("needsYouWorkspaces.showWorkspacesHelp") }}</div>
  </div>
</template>
