<script setup lang="ts">
import SkillsHelpCard from "./SkillsHelpCard.vue";
import { SKILL_SOURCES, setSkillSource, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

// The line "Source of the skill" of the window Find new skills: the choice between the three ways to find a skill. The field
// below the line, and the result, follow the choice.

/** The text of the button of each source. */
const SOURCE_LABELS = {
  skillsSh: "settingsSkills.sourceSkillsSh",
  localFolder: "settingsSkills.sourceLocalFolder",
  codeHosting: "settingsSkills.sourceCodeHosting",
} as const;
</script>

<template>
  <div class="source">
    <div>
      <div class="title d-flex align-items-center gap-2">
        {{ t("settingsSkills.help_source_title") }}
        <SkillsHelpCard topic="source" />
      </div>
      <div class="keys">{{ t("settingsSkills.sourceHelp") }}</div>
    </div>
    <div class="btn-group sourceChoice" role="group" :aria-label="t('settingsSkills.sourceLabel')">
      <label v-for="source in SKILL_SOURCES" :key="source" class="btn btn-check btn-outline theme-secondary">
        <input
          type="radio"
          name="skills-source"
          autocomplete="off"
          :value="source"
          :checked="skills.source === source"
          @change="setSkillSource(source)"
        />
        {{ t(SOURCE_LABELS[source]) }}
      </label>
    </div>
  </div>
</template>

<style scoped>
.source { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.title { font-weight: 600; font-size: var(--font-size); }
.sourceChoice { flex-shrink: 0; }
</style>
