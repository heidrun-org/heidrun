<script setup lang="ts">
import { FONTS, FONT_MAX, FONT_MIN, resetZoom, settings, zoom } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="section">
    <label class="sr" for="font-family">{{ t("fontMenu.font") }}</label>
    <select id="font-family" v-model="settings.fontId">
      <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }}</option>
    </select>
    <div class="size">
      <button :title="t('fontMenu.decreaseTitle')" class="btn" :aria-label="t('fontMenu.decreaseLabel')" :disabled="settings.fontSize <= FONT_MIN" @click="zoom(-0.5)">A−</button>
      <span class="mono val">{{ t("fontMenu.fontSize", { size: settings.fontSize }) }}</span>
      <button :title="t('fontMenu.increaseTitle')" class="btn" :aria-label="t('fontMenu.increaseLabel')" :disabled="settings.fontSize >= FONT_MAX" @click="zoom(0.5)">A+</button>
      <button :title="t('fontMenu.resetTitle')" class="btn" @click="resetZoom()">{{ t("fontMenu.reset") }}</button>
    </div>
    <div v-if="settings.fontId === 'inconsolata-powerline'" class="keys">
      {{ t("fontMenu.powerlineBefore") }}<span class="mono">brew install --cask font-inconsolata-for-powerline</span>{{ t("fontMenu.powerlineAfter") }}
    </div>
    <div class="preview" :style="{ fontFamily: FONTS.find((f) => f.id === settings.fontId)?.stack, fontSize: `${settings.fontSize}px` }">
      ❯ flutter test → 12 passed <template v-if="settings.fontId === 'inconsolata-powerline'">  main </template>
    </div>
    <div class="keys"><kbd>⌘+</kbd> {{ t("fontMenu.keyIncrease") }} · <kbd>⌘−</kbd> {{ t("fontMenu.keyDecrease") }} · <kbd>⌘0</kbd> {{ t("fontMenu.keyDefault") }}</div>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: 10px; }
.size { display: flex; align-items: center; gap: 6px; }
.size .btn:disabled { opacity: 0.4; cursor: default; }
.val { min-width: 52px; text-align: center; color: var(--text); font-size: 12px; }
.preview {
  padding: 10px 12px; border-radius: 8px; background: var(--bg); color: var(--text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
