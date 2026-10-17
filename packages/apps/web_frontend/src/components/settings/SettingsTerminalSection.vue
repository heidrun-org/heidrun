<script setup lang="ts">
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import { FONTS, FONT_DEFAULT, FONT_MAX, FONT_MIN, resetZoom, settings, zoom } from "../../stores/settings";
import { t } from "../../i18n/index";

/** The two mouse modes, in the order of the buttons. */
const MOUSE_MODES = [
  { id: "select", labelKey: "fontMenu.mouseSelect", titleKey: "fontMenu.mouseSelectTitle" },
  { id: "app", labelKey: "fontMenu.mouseApp", titleKey: "fontMenu.mouseAppTitle" },
] as const;

/** The blocks of the information card of the font, in the order of the card. */
const FONT_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.font.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.font.how" },
] as const;

/** The blocks of the information card of the font size, in the order of the card. */
const FONT_SIZE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.fontSize.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.fontSize.how" },
  { titleKey: "settingsHelp.keysTitle", textKey: "settingsHelp.fontSize.keys" },
] as const;

/** The blocks of the information card of the mouse behaviour, in the order of the card. */
const MOUSE_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.mouseMode.what" },
  { titleKey: "fontMenu.mouseSelect", textKey: "settingsHelp.mouseMode.select" },
  { titleKey: "fontMenu.mouseApp", textKey: "settingsHelp.mouseMode.app" },
] as const;
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="d-flex flex-column gap-2" data-option="font">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label m-0" for="font-family">{{ t("fontMenu.font") }}</label>
        <SettingsOptionHelp title-key="fontMenu.font" :blocks="FONT_HELP_BLOCKS" />
      </div>
      <select id="font-family" v-model="settings.fontId" class="form-control">
        <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
    </div>
    <div class="d-flex align-items-center gap-2" data-option="fontSize">
      <button :title="t('fontMenu.decreaseTitle')" type="button" class="btn" :class="{ 'opacity-50': settings.fontSize <= FONT_MIN }" :aria-label="t('fontMenu.decreaseLabel')" :disabled="settings.fontSize <= FONT_MIN" @click="zoom(-0.5)">A−</button>
      <span class="mono">{{ t("fontMenu.fontSize", { size: settings.fontSize }) }}</span>
      <button :title="t('fontMenu.increaseTitle')" type="button" class="btn" :class="{ 'opacity-50': settings.fontSize >= FONT_MAX }" :aria-label="t('fontMenu.increaseLabel')" :disabled="settings.fontSize >= FONT_MAX" @click="zoom(0.5)">A+</button>
      <button :title="t('fontMenu.resetTitle')" type="button" class="btn" @click="resetZoom()">{{ t("fontMenu.reset") }}</button>
      <SettingsOptionHelp title-key="fontMenu.fontSizeTitle" :blocks="FONT_SIZE_HELP_BLOCKS" />
    </div>
    <div v-if="settings.fontId === 'inconsolata-powerline'" class="form-text">
      {{ t("fontMenu.powerlineBefore") }}<span class="mono">brew install --cask font-inconsolata-for-powerline</span>{{ t("fontMenu.powerlineAfter") }}
    </div>
    <div class="form-control text-nowrap overflow-hidden" :style="{ fontFamily: FONTS.find((f) => f.id === settings.fontId)?.stack, fontSize: `${FONT_DEFAULT}px` }">
      ❯ flutter test → 12 passed <template v-if="settings.fontId === 'inconsolata-powerline'">  main </template>
    </div>
    <div class="d-flex flex-column gap-2" data-option="mouseMode">
      <div class="d-flex align-items-center gap-2">
        <h4 class="form-label m-0">{{ t("fontMenu.mouseLabel") }}</h4>
        <SettingsOptionHelp title-key="fontMenu.mouseLabel" :blocks="MOUSE_HELP_BLOCKS" />
      </div>
      <div class="btn-group" role="group" :aria-label="t('fontMenu.mouseLabel')">
        <label v-for="mode in MOUSE_MODES" :key="mode.id" class="btn-check btn-outline theme-secondary" :title="t(mode.titleKey)">
          <input v-model="settings.mouseMode" type="radio" name="mouse-mode" autocomplete="off" :value="mode.id" />
          {{ t(mode.labelKey) }}
        </label>
      </div>
    </div>
  </div>
</template>
