<script setup lang="ts">
import { FONTS, FONT_DEFAULT, FONT_MAX, FONT_MIN, resetZoom, settings, zoom } from "../../stores/settings";
import { t } from "../../i18n/index";
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div>
      <label class="form-label" for="font-family">{{ t("fontMenu.font") }}</label>
      <select id="font-family" v-model="settings.fontId" class="form-control">
        <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
    </div>
    <div class="d-flex align-items-center gap-2">
      <button :title="t('fontMenu.decreaseTitle')" type="button" class="btn" :class="{ 'opacity-50': settings.fontSize <= FONT_MIN }" :aria-label="t('fontMenu.decreaseLabel')" :disabled="settings.fontSize <= FONT_MIN" @click="zoom(-0.5)">A−</button>
      <span class="mono">{{ t("fontMenu.fontSize", { size: settings.fontSize }) }}</span>
      <button :title="t('fontMenu.increaseTitle')" type="button" class="btn" :class="{ 'opacity-50': settings.fontSize >= FONT_MAX }" :aria-label="t('fontMenu.increaseLabel')" :disabled="settings.fontSize >= FONT_MAX" @click="zoom(0.5)">A+</button>
      <button :title="t('fontMenu.resetTitle')" type="button" class="btn" @click="resetZoom()">{{ t("fontMenu.reset") }}</button>
    </div>
    <div v-if="settings.fontId === 'inconsolata-powerline'" class="form-text">
      {{ t("fontMenu.powerlineBefore") }}<span class="mono">brew install --cask font-inconsolata-for-powerline</span>{{ t("fontMenu.powerlineAfter") }}
    </div>
    <div class="form-control text-nowrap overflow-hidden" :style="{ fontFamily: FONTS.find((f) => f.id === settings.fontId)?.stack, fontSize: `${FONT_DEFAULT}px` }">
      ❯ flutter test → 12 passed <template v-if="settings.fontId === 'inconsolata-powerline'">  main </template>
    </div>
    <div class="form-text"><kbd class="mono">⌘+</kbd> {{ t("fontMenu.keyIncrease") }} · <kbd class="mono">⌘−</kbd> {{ t("fontMenu.keyDecrease") }} · <kbd class="mono">⌘0</kbd> {{ t("fontMenu.keyDefault") }}</div>
  </div>
</template>
