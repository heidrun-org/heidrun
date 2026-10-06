<script setup lang="ts">
const TTL_OPTIONS = [
  { v: 5, label: "5 min" },
  { v: 15, label: "15 min" },
  { v: 60, label: "1 h" },
  { v: 0, label: "Jamais" },
];
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import { FONTS, FONT_MAX, FONT_MIN, resetZoom, settings, zoom } from "../stores/settings";

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
    <button class="icon-btn" :class="{ on: open }" aria-label="Réglages du terminal" title="Police et souris du terminal" @click="open = !open">
      <Icon name="text" />
    </button>
    <div v-if="open" class="menu" role="dialog" aria-label="Police du terminal">
      <div class="eyebrow">Terminal</div>
      <label class="sr" for="font-family">Police</label>
      <select id="font-family" v-model="settings.fontId">
        <option v-for="f in FONTS" :key="f.id" :value="f.id">{{ f.label }}</option>
      </select>
      <div class="size">
        <button class="btn" aria-label="Réduire la police" :disabled="settings.fontSize <= FONT_MIN" @click="zoom(-0.5)">A−</button>
        <span class="mono val">{{ settings.fontSize }} px</span>
        <button class="btn" aria-label="Agrandir la police" :disabled="settings.fontSize >= FONT_MAX" @click="zoom(0.5)">A+</button>
        <button class="btn" @click="resetZoom()">Réinitialiser</button>
      </div>
      <div v-if="settings.fontId === 'inconsolata-powerline'" class="keys">
        Police à installer sur le Mac (<span class="mono">brew install --cask font-inconsolata-for-powerline</span>
        ou la version Nerd Font). Sans elle, l’app prend Inconsolata, sans les symboles Powerline.
      </div>
      <div class="preview" :style="{ fontFamily: FONTS.find((f) => f.id === settings.fontId)?.stack, fontSize: `${settings.fontSize}px` }">
        ❯ flutter test → 12 passed <template v-if="settings.fontId === 'inconsolata-powerline'">  main </template>
      </div>
      <div class="keys"><kbd>⌘+</kbd> agrandir · <kbd>⌘−</kbd> réduire · <kbd>⌘0</kbd> par défaut</div>
      <div class="eyebrow sep">Souris</div>
      <div class="seg" role="radiogroup" aria-label="Comportement de la souris">
        <button role="radio" :aria-checked="settings.mouseMode === 'select'" :class="{ on: settings.mouseMode === 'select' }" @click="settings.mouseMode = 'select'">Sélectionner du texte</button>
        <button role="radio" :aria-checked="settings.mouseMode === 'app'" :class="{ on: settings.mouseMode === 'app' }" @click="settings.mouseMode = 'app'">Souris pour l’app</button>
      </div>
      <div class="keys">
        <template v-if="settings.mouseMode === 'select'">Glisser sélectionne, <kbd>⌘C</kbd> copie. La molette et les clics ne vont plus à Herdr.</template>
        <template v-else>Molette et clics vont à Herdr et aux agents. <kbd>⌥</kbd> + glisser pour sélectionner.</template>
      </div>
      <div class="eyebrow sep">Éléments terminés</div>
      <div class="seg" role="radiogroup" aria-label="Masquer les éléments terminés après">
        <button
          v-for="o in TTL_OPTIONS"
          :key="o.v"
          role="radio"
          :aria-checked="settings.finishedTtl === o.v"
          :class="{ on: settings.finishedTtl === o.v }"
          @click="settings.finishedTtl = o.v"
        >{{ o.label }}</button>
      </div>
      <div class="keys">Les travaux terminés (Activité, cartes « À traiter ») disparaissent après ce délai. Les agents bloqués restent.</div>
      <div class="eyebrow sep">Notifications</div>
      <label class="nrow">
        <span>Rappel si un agent reste bloqué</span>
        <select v-model.number="settings.notifBlockedMin">
          <option :value="0">jamais</option>
          <option :value="2">2 min</option>
          <option :value="5">5 min</option>
          <option :value="10">10 min</option>
          <option :value="30">30 min</option>
        </select>
      </label>
      <label class="nrow"><span>Contexte d’un agent au-delà de 80 %</span><input v-model="settings.notifContext" type="checkbox" /></label>
      <label class="nrow"><span>Quota Claude au-delà de 80 % puis 95 %</span><input v-model="settings.notifQuota" type="checkbox" /></label>
      <label class="nrow"><span>Résumé de la journée à</span><input v-model.lazy="settings.notifEvening" class="time" placeholder="18:30" /></label>
      <label class="nrow">
        <span>Heures calmes</span>
        <span class="range"><input v-model.lazy="settings.quietFrom" class="time" placeholder="20:00" /> → <input v-model.lazy="settings.quietTo" class="time" placeholder="08:00" /></span>
      </label>
      <div class="keys">Pendant les heures calmes, aucune notification n’est envoyée. Laisse vide pour désactiver.</div>
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
  border: 1px solid #33383e; background: var(--field); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
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
