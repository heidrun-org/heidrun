<script setup lang="ts">
import Icon from "../Icon.vue";
import { settings } from "../../stores/settings";
import { LANGUAGES, t } from "../../i18n/index";
</script>

<template>
  <div class="list" role="radiogroup" :aria-label="t('languageMenu.menuLabel')">
    <button
      v-for="o in LANGUAGES"
      :key="o.id"
      class="item"
      role="radio"
      :title="t('languageMenu.useLanguage', { language: o.label })"
      :aria-checked="settings.language === o.id"
      @click="settings.language = o.id"
    >
      <span class="label">{{ o.label }}</span>
      <Icon v-if="settings.language === o.id" name="check2" />
    </button>
  </div>
</template>

<style scoped>
.list { display: flex; flex-direction: column; gap: 2px; max-width: 280px; }
.item {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--text); font-size: 13px; text-align: left;
}
.item:hover { background: var(--hover); }
.label { flex: 1; }
</style>
