<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import SkillSearchResultRow from "./SkillSearchResultRow.vue";
import { resultKey, searchSkills, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

const SEARCH_DELAY_MS = 300;
let searchTimer = 0;

function onSearchInput(event: Event) {
  const query = (event.target as HTMLInputElement).value;
  skills.query = query;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => searchSkills(query), SEARCH_DELAY_MS);
}

onBeforeUnmount(() => window.clearTimeout(searchTimer));
</script>

<template>
  <input
    class="search"
    type="search"
    :value="skills.query"
    :placeholder="t('settingsSkills.searchPlaceholder')"
    :aria-label="t('settingsSkills.searchLabel')"
    @input="onSearchInput"
  />
  <p v-if="skills.searching" class="keys">{{ t("settingsSkills.searching") }}</p>
  <p v-else-if="skills.searchError !== ''" class="err">{{ skills.searchError }}</p>
  <p v-else-if="skills.searched && skills.results.length === 0" class="keys">{{ t("settingsSkills.noResult") }}</p>
  <div v-if="skills.results.length > 0" class="list">
    <SkillSearchResultRow v-for="result in skills.results" :key="resultKey(result)" :result="result" />
  </div>
</template>

<style scoped>
.search { height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text); font-size: var(--font-size); }
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: var(--font-size); }
</style>
