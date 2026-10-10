<script setup lang="ts">
import Icon from "../../Icon.vue";
import { settings } from "../../../stores/settings";
import { inspectResult, installSkill, isInstalledAtLevel, isSkillBusy, resultKey, type SearchResult } from "../../../stores/skills";
import { t } from "../../../i18n/index";

defineProps<{ result: SearchResult }>();
</script>

<template>
  <div class="row">
    <div class="meta">
      <div class="name">{{ result.name }}</div>
      <div class="sub">{{ result.source }} · {{ t("settingsSkills.installs", { total: result.installs.toLocaleString() }) }}</div>
    </div>
    <button class="btn" @click="inspectResult(result)"><Icon name="eye" /> {{ t("settingsSkills.inspect") }}</button>
    <span v-if="isInstalledAtLevel(result)" class="place">{{ t("settingsSkills.installed") }}</span>
    <button
      v-else
      class="btn"
      :disabled="isSkillBusy(resultKey(result))"
      :aria-busy="isSkillBusy(resultKey(result))"
      :title="t(settings.skillsLevel === 'workspace' ? 'settingsSkills.installTitleWorkspace' : 'settingsSkills.installTitleUser')"
      @click="installSkill(result)"
    >
      <span v-if="isSkillBusy(resultKey(result))" class="spinner" aria-hidden="true"></span><Icon v-else name="download" />
      {{ t("settingsSkills.install") }}
    </button>
  </div>
</template>
