<script setup lang="ts">
import { onBeforeUnmount, onMounted, useId, watch } from "vue";
import Icon from "../Icon.vue";
import { selectedWorkspace } from "../../stores/session";
import { loadSkills, skills } from "../../stores/skills";
import { t } from "../../i18n/index";

defineProps<{
  title: string;
  /** The text of the tooltip that opens from the question mark next to the title. */
  help: string;
}>();
const emit = defineEmits<{ close: [] }>();

const titleId = useId();
const helpId = useId();

onMounted(loadSkills);
// The skills of the workspace level follow the selected workspace.
watch(() => selectedWorkspace.value?.workspace_id, loadSkills);

function onKey(e: KeyboardEvent) {
  // The window of a SKILL.md file is above this window: it takes the Escape key.
  if (skills.view !== null) {
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("close");
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="emit('close')">
    <div class="dialog" role="dialog" :aria-labelledby="titleId">
      <header>
        <div class="heading">
          <h2 :id="titleId">{{ title }}</h2>
          <span class="help">
            <button class="helpButton" type="button" :aria-label="t('settingsSkills.helpLabel')" :aria-describedby="helpId"><Icon name="question-circle" /></button>
            <span :id="helpId" class="tip" role="tooltip">{{ help }}</span>
          </span>
        </div>
        <button :title="t('settingsSkills.closeTitle')" class="close" :aria-label="t('settingsSkills.closeLabel')" @click="emit('close')"><Icon name="x-lg" /></button>
      </header>
      <div class="pane skillsSection">
        <slot />
      </div>
    </div>
  </div>
</template>

<style src="./skills_section.css"></style>

<style scoped>
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog {
  width: min(640px, 100%); height: min(560px, calc(100vh - 48px)); display: flex; flex-direction: column; overflow: hidden; border-radius: 14px;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 0; }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.heading { display: flex; align-items: center; gap: 8px; }
.help { position: relative; display: inline-flex; }
.helpButton { width: 24px; height: 24px; border-radius: 50%; color: var(--muted); font-size: var(--font-size); cursor: help; }
.helpButton:hover, .helpButton:focus-visible { color: var(--text); }
.tip {
  display: none; position: absolute; top: calc(100% + 6px); left: 0; z-index: 2; width: 340px; padding: 10px 12px; border-radius: 10px;
  background: var(--raised); border: 1px solid var(--line-strong); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
  color: var(--text-2); font-size: var(--font-size); font-weight: 400; line-height: 1.5;
}
.help:hover .tip, .help:focus-within .tip { display: block; }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: calc(var(--font-size) * 1.5); }
.close:hover { background: var(--hover); color: var(--text); }
.pane { flex: 1; min-height: 0; padding: 14px 22px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.pane :deep(.keys) { font-size: var(--font-size); color: var(--muted); line-height: 1.5; }
.pane :deep(.seg) { display: flex; padding: 3px; border-radius: 9px; background: var(--bg); gap: 3px; }
.pane :deep(.seg button) {
  flex: 1; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--muted);
  font-size: var(--font-size); font-weight: 500;
}
.pane :deep(.seg button.on) { background: var(--hover); color: var(--text); }
</style>
