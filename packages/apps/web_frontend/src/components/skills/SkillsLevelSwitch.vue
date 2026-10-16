<script setup lang="ts">
import SkillsHelpCard from "./SkillsHelpCard.vue";
import { settings } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="level">
    <div>
      <div class="title d-flex align-items-center gap-2">
        {{ t("settingsSkills.help_level_title") }}
        <SkillsHelpCard topic="level" />
      </div>
      <div class="keys">{{ t("settingsSkills.levelHelp") }}</div>
    </div>
    <div class="btn-group levelChoice" role="group" :aria-label="t('settingsSkills.levelLabel')">
      <label class="btn-check btn-outline theme-secondary">
        <input v-model="settings.skillsLevel" type="radio" name="skills-level" autocomplete="off" value="user" />
        {{ t("settingsSkills.levelUser") }}
      </label>
      <label class="btn-check btn-outline theme-secondary">
        <input v-model="settings.skillsLevel" type="radio" name="skills-level" autocomplete="off" value="workspace" />
        {{ t("settingsSkills.levelWorkspace") }}
      </label>
    </div>
  </div>
</template>

<style scoped>
.level { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.title { font-weight: 600; font-size: var(--font-size); }
.levelChoice { flex-shrink: 0; width: 280px; }
</style>
