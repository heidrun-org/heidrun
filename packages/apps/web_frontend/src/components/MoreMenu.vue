<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import { state } from "../stores/session";
import { openSettings } from "../stores/settings";
import { openFindNewSkillsModal, openInstalledSkillModal } from "../stores/skills";
import { t } from "../i18n/index";

const open = ref(false);
const root = ref<HTMLElement>();

function chooseShortcutsHelp() {
  open.value = false;
  state.shortcutsOpen = true;
}

function chooseInstalledSkill() {
  open.value = false;
  openInstalledSkillModal();
}

function chooseFindNewSkills() {
  open.value = false;
  openFindNewSkillsModal();
}

function chooseSettings() {
  open.value = false;
  openSettings();
}

function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));
</script>

<template>
  <div ref="root" class="wrap">
    <button
      class="icon-btn"
      :class="{ on: open }"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="t('moreMenu.buttonLabel')"
      :title="t('moreMenu.buttonTitle')"
      @click="open = !open"
    >
      <Icon name="three-dots-vertical" />
    </button>
    <div v-if="open" class="menu" role="menu" :aria-label="t('moreMenu.menuLabel')">
      <button class="item" role="menuitem" :title="t('moreMenu.shortcutsHelpTitle')" @click="chooseShortcutsHelp()">
        <Icon name="question-lg" />
        <span class="label">{{ t("moreMenu.shortcutsHelpLabel") }}</span>
        <kbd>⌘/</kbd>
      </button>
      <div class="divider" role="separator"></div>
      <div class="group" role="group" aria-labelledby="more-menu-skills">
        <div id="more-menu-skills" class="heading">{{ t("moreMenu.skillsHeading") }}</div>
        <button class="item" role="menuitem" :title="t('moreMenu.installedSkillTitle')" @click="chooseInstalledSkill()">
          <Icon name="list-check" />
          <span class="label">{{ t("moreMenu.installedSkillLabel") }}</span>
        </button>
        <button class="item" role="menuitem" :title="t('moreMenu.findNewSkillsTitle')" @click="chooseFindNewSkills()">
          <Icon name="search" />
          <span class="label">{{ t("moreMenu.findNewSkillsLabel") }}</span>
        </button>
      </div>
      <div class="divider" role="separator"></div>
      <button class="item" role="menuitem" :title="t('moreMenu.settingsTitle')" @click="chooseSettings()">
        <Icon name="gear" />
        <span class="label">{{ t("moreMenu.settingsLabel") }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.wrap { position: relative; }
.icon-btn {
  width: 30px; height: 30px; border-radius: 8px; border: 0; background: transparent;
  color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.icon-btn:hover { background: var(--hover); color: var(--text); }
.icon-btn.on { color: var(--text-2); background: var(--field); }
.menu {
  position: absolute; right: 0; top: 38px; min-width: 240px; z-index: 30; padding: 6px; border-radius: 12px;
  border: 1px solid var(--line-modal); background: var(--field); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
  display: flex; flex-direction: column; gap: 2px;
}
.item {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border: none; border-radius: 8px;
  background: transparent; color: var(--text); font-size: var(--font-size); text-align: left;
}
.item:hover { background: var(--hover); }
.label { flex: 1; white-space: nowrap; }
.group { display: flex; flex-direction: column; gap: 2px; }
.heading { padding: 6px 10px 2px; color: var(--muted); font-size: calc(var(--font-size) * 0.9); font-weight: 600; }
.divider { height: 1px; margin: 4px 6px; background: var(--line); }
.item kbd { font-family: var(--mono); color: var(--faint); }
</style>
