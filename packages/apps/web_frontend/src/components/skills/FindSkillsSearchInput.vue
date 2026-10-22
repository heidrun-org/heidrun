<script setup lang="ts">
import { onBeforeUnmount, useId } from "vue";
import Icon from "../Icon.vue";
import SkillsHelpCard from "./SkillsHelpCard.vue";
import { searchSkills, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

// The field of the source skills.sh: a search that starts when the developer stops typing.

const SEARCH_DELAY_MS = 300;
let searchTimer = 0;
const inputId = useId();
const helpId = useId();

function onSearchInput(event: Event) {
  const query = (event.target as HTMLInputElement).value;
  skills.query = query;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => searchSkills(query), SEARCH_DELAY_MS);
}

onBeforeUnmount(() => window.clearTimeout(searchTimer));
</script>

<template>
  <div class="d-flex flex-column gap-1">
    <div class="d-flex align-items-center gap-2">
      <label class="form-label m-0" :for="inputId">{{ t("settingsSkills.help_search_title") }}</label>
      <SkillsHelpCard topic="search" />
    </div>
    <div :id="helpId" class="form-text m-0">{{ t("settingsSkills.searchHelp") }}</div>
    <div class="searchField">
      <Icon name="search" class="searchIcon" />
      <input
        :id="inputId"
        class="form-control search"
        type="search"
        :value="skills.query"
        :placeholder="t('settingsSkills.searchPlaceholder')"
        :aria-describedby="helpId"
        @input="onSearchInput"
      />
    </div>
  </div>
</template>

<style scoped>
.searchField { position: relative; display: flex; align-items: center; }
.searchIcon { position: absolute; left: 10px; color: var(--muted); pointer-events: none; }
</style>
