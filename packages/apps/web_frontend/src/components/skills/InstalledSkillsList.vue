<script setup lang="ts">
import InstalledSkillRow from "./InstalledSkillRow.vue";
import { installedKey, skills } from "../../stores/skills";
import { t } from "../../i18n/index";
</script>

<template>
  <p v-if="skills.installed.length === 0" class="keys">{{ t("settingsSkills.installedEmpty") }}</p>
  <div v-else class="list">
    <InstalledSkillRow v-for="skill in skills.installed" :key="installedKey(skill)" :skill="skill" />
  </div>
</template>
