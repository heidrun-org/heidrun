<script setup lang="ts">
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="level">
    <div>
      <div class="title">{{ t("settingsSkills.levelTitle") }}</div>
      <div class="keys">{{ t("settingsSkills.levelHelp") }}</div>
    </div>
    <div class="seg levelChoice" role="radiogroup" :aria-label="t('settingsSkills.levelLabel')">
      <button
        role="radio"
        :aria-checked="settings.skillsLevel === 'user'"
        :class="{ on: settings.skillsLevel === 'user' }"
        @click="settings.skillsLevel = 'user'"
      >{{ t("settingsSkills.levelUser") }}</button>
      <button
        role="radio"
        :aria-checked="settings.skillsLevel === 'workspace'"
        :class="{ on: settings.skillsLevel === 'workspace' }"
        @click="settings.skillsLevel = 'workspace'"
      >{{ t("settingsSkills.levelWorkspace") }}</button>
    </div>
  </div>
</template>

<style scoped>
.level { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.title { font-weight: 600; font-size: var(--font-size); }
.levelChoice { flex-shrink: 0; width: 280px; }
</style>
