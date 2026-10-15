<script setup lang="ts">
import { onBeforeUnmount, useId } from "vue";
import Icon from "../Icon.vue";
import SkillSearchResultRow from "./SkillSearchResultRow.vue";
import { resultKey, searchSkills, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

const SEARCH_DELAY_MS = 300;
let searchTimer = 0;
const hintId = useId();

function onSearchInput(event: Event) {
  const query = (event.target as HTMLInputElement).value;
  skills.query = query;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => searchSkills(query), SEARCH_DELAY_MS);
}

onBeforeUnmount(() => window.clearTimeout(searchTimer));
</script>

<template>
  <div class="searchField">
    <Icon name="search" class="searchIcon" />
    <input
      class="search"
      type="search"
      :value="skills.query"
      :placeholder="t('settingsSkills.searchPlaceholder')"
      :aria-label="t('settingsSkills.searchLabel')"
      :aria-describedby="hintId"
      @input="onSearchInput"
    />
  </div>
  <p :id="hintId" class="hint">{{ t("settingsSkills.searchHint") }}</p>
  <p v-if="skills.searching" class="keys">{{ t("settingsSkills.searching") }}</p>
  <p v-else-if="skills.searchError !== ''" class="err">{{ skills.searchError }}</p>
  <p v-else-if="skills.searched && skills.results.length === 0" class="keys">{{ t("settingsSkills.noResult") }}</p>
  <div v-if="skills.results.length > 0" class="list">
    <SkillSearchResultRow v-for="result in skills.results" :key="resultKey(result)" :result="result" />
  </div>
</template>

<style scoped>
.searchField { position: relative; display: flex; align-items: center; }
.searchIcon { position: absolute; left: 10px; color: var(--muted); pointer-events: none; }
.hint { margin: -4px 0 0; color: var(--muted); font-size: var(--font-size); }
.search { flex: 1; min-width: 0; height: 34px; padding: 0 10px 0 32px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text); font-size: var(--font-size); }
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: var(--font-size); }
</style>
