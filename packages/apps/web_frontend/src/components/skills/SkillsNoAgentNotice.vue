<script setup lang="ts">
import { openAgentsSection } from "../../stores/skills";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="notice">
    <span>{{ t("settingsSkills.noAgent") }}</span>
    <button class="btn" @click="openAgentsSection">{{ t("settingsSkills.openAgents") }}</button>
  </div>
</template>

<style scoped>
.notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--tint-warn); color: var(--text-2); font-size: var(--font-size); line-height: 1.5; }
</style>
