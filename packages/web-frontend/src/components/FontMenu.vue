<script setup lang="ts">
const TTL_OPTIONS = [
  { v: 5, labelKey: "fontMenu.minutes5" },
  { v: 15, labelKey: "fontMenu.minutes15" },
  { v: 60, labelKey: "fontMenu.hour1" },
  { v: 0, labelKey: "fontMenu.never" },
];
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import { FONTS, FONT_MAX, FONT_MIN, resetZoom, settings, zoom } from "../stores/settings";
import { t } from "../i18n/index";

const open = ref(false);
const root = ref<HTMLElement>();

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));
</script>

<template>
  <div ref="root" class="wrap">
    <button class="icon-btn" :class="{ on: open }" :aria-label="t('fontMenu.buttonLabel')" :title="t('fontMenu.buttonTitle')" @click="open = !open">
      <Icon name="type" />
    </button>
    <div v-if="open" class="menu" role="dialog" :aria-label="t('fontMenu.menuLabel')">
      <div class="eyebrow">{{ t("fontMenu.terminal") }}</div>
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
      <div class="eyebrow sep">{{ t("fontMenu.mouse") }}</div>
      <div class="seg" role="radiogroup" :aria-label="t('fontMenu.mouseLabel')">
        <button :title="t('fontMenu.mouseSelectTitle')" role="radio" :aria-checked="settings.mouseMode === 'select'" :class="{ on: settings.mouseMode === 'select' }" @click="settings.mouseMode = 'select'">{{ t("fontMenu.mouseSelect") }}</button>
        <button :title="t('fontMenu.mouseAppTitle')" role="radio" :aria-checked="settings.mouseMode === 'app'" :class="{ on: settings.mouseMode === 'app' }" @click="settings.mouseMode = 'app'">{{ t("fontMenu.mouseApp") }}</button>
      </div>
      <div class="keys">
        <template v-if="settings.mouseMode === 'select'">{{ t("fontMenu.mouseSelectHelpBefore") }}<kbd>⌘C</kbd>{{ t("fontMenu.mouseSelectHelpAfter") }}</template>
        <template v-else>{{ t("fontMenu.mouseAppHelpBefore") }}<kbd>⌥</kbd>{{ t("fontMenu.mouseAppHelpAfter") }}</template>
      </div>
      <div class="eyebrow sep">{{ t("fontMenu.finished") }}</div>
      <div class="seg" role="radiogroup" :aria-label="t('fontMenu.finishedLabel')">
        <button :title="t('fontMenu.finishedTitle')"
          v-for="o in TTL_OPTIONS"
          :key="o.v"
          role="radio"
          :aria-checked="settings.finishedTtl === o.v"
          :class="{ on: settings.finishedTtl === o.v }"
          @click="settings.finishedTtl = o.v"
        >{{ t(o.labelKey) }}</button>
      </div>
      <div class="keys">{{ t("fontMenu.finishedHelp") }}</div>
      <div class="eyebrow sep">{{ t("fontMenu.notifications") }}</div>
      <label class="nrow">
        <span>{{ t("fontMenu.notifyBlocked") }}</span>
        <select v-model.number="settings.notifBlockedMin">
          <option :value="0">{{ t("fontMenu.neverLower") }}</option>
          <option :value="2">{{ t("fontMenu.minutes", { minutes: 2 }) }}</option>
          <option :value="5">{{ t("fontMenu.minutes", { minutes: 5 }) }}</option>
          <option :value="10">{{ t("fontMenu.minutes", { minutes: 10 }) }}</option>
          <option :value="30">{{ t("fontMenu.minutes", { minutes: 30 }) }}</option>
        </select>
      </label>
      <label class="nrow"><span>{{ t("fontMenu.notifyContext") }}</span><input v-model="settings.notifContext" type="checkbox" /></label>
      <label class="nrow"><span>{{ t("fontMenu.notifyQuota") }}</span><input v-model="settings.notifQuota" type="checkbox" /></label>
      <label class="nrow"><span>{{ t("fontMenu.notifyEvening") }}</span><input v-model.lazy="settings.notifEvening" class="time" placeholder="18:30" /></label>
      <label class="nrow">
        <span>{{ t("fontMenu.quietHours") }}</span>
        <span class="range"><input v-model.lazy="settings.quietFrom" class="time" placeholder="20:00" /> → <input v-model.lazy="settings.quietTo" class="time" placeholder="08:00" /></span>
      </label>
      <div class="keys">{{ t("fontMenu.quietHoursHelp") }}</div>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: relative; }
.nrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--text-2); }
.nrow select, .nrow .time { height: 26px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text); font-size: 12px; padding: 0 6px; }
.nrow .time { width: 58px; text-align: center; font-family: var(--mono); }
.nrow input[type="checkbox"] { accent-color: var(--done); }
.range { display: flex; align-items: center; gap: 4px; }
.icon-btn {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--text-2); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.icon-btn:hover, .icon-btn.on { background: var(--hover); color: var(--text); }
.menu {
  position: absolute; right: 0; top: 38px; width: 300px; z-index: 30; padding: 14px; border-radius: 12px;
  border: 1px solid var(--line-modal); background: var(--field); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  display: flex; flex-direction: column; gap: 10px; max-height: calc(100vh - 80px); overflow-y: auto;
}
select {
  height: 34px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text);
  padding: 0 10px; font-size: 13px;
}
.size { display: flex; align-items: center; gap: 6px; }
.size .btn:disabled { opacity: 0.4; cursor: default; }
.val { min-width: 52px; text-align: center; color: var(--text); font-size: 12px; }
.preview {
  padding: 10px 12px; border-radius: 8px; background: var(--bg); color: var(--text-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.keys { font-size: 11px; color: var(--muted); line-height: 1.5; }
.sep { margin-top: 6px; }
.seg { display: flex; padding: 3px; border-radius: 9px; background: var(--bg); gap: 3px; }
.seg button {
  flex: 1; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--muted);
  font-size: 12px; font-weight: 500;
}
.seg button.on { background: var(--hover); color: var(--text); }
kbd { font-family: var(--mono); color: var(--text-2); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
