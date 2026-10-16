<script setup lang="ts">
import FindSkillsCodeHosting from "./FindSkillsCodeHosting.vue";
import FindSkillsLocalFolder from "./FindSkillsLocalFolder.vue";
import FindSkillsSearchInput from "./FindSkillsSearchInput.vue";
import SkillSearchResultRow from "./SkillSearchResultRow.vue";
import SkillsHelpCard from "./SkillsHelpCard.vue";
import SkillsSourceSwitch from "./SkillsSourceSwitch.vue";
import { resultKey, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

// The content of the window Find new skills under the line "Installation level": the line "Source of the skill", the field of
// the chosen source, and the line "Result" with its rows.
</script>

<template>
  <SkillsSourceSwitch />
  <FindSkillsSearchInput v-if="skills.source === 'skillsSh'" />
  <FindSkillsLocalFolder v-else-if="skills.source === 'localFolder'" />
  <FindSkillsCodeHosting v-else />
  <div class="d-flex flex-column gap-2">
    <div class="d-flex align-items-center gap-2">
      <h4 class="form-label m-0">{{ t("settingsSkills.help_result_title") }}</h4>
      <SkillsHelpCard topic="result" />
    </div>
    <p v-if="skills.searching" class="keys">{{ t("settingsSkills.searching") }}</p>
    <p v-else-if="skills.searchError !== ''" class="err">{{ skills.searchError }}</p>
    <p v-else-if="skills.searched && skills.results.length === 0" class="keys">{{ t("settingsSkills.noResult") }}</p>
    <p v-else-if="skills.results.length === 0" class="keys">{{ t("settingsSkills.resultEmpty") }}</p>
    <div v-if="skills.results.length > 0" class="list">
      <SkillSearchResultRow v-for="result in skills.results" :key="resultKey(result)" :result="result" />
    </div>
  </div>
</template>

<style scoped>
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: var(--font-size); }
</style>
