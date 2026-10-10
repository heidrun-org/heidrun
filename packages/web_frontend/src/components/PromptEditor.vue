<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import { currentProject } from "../stores/project";
import { toast } from "../stores/session";
import { VARIABLES, addPrompt, projectPrompts, promptEditor, prompts, removePrompt, updatePrompt } from "../stores/prompts";
import { t } from "../i18n/index";

const NEW = "__new__";

/** The selector value of a template: where it is kept, then its id. */
const choices = computed(() => [
  ...projectPrompts.value.map((template) => ({ value: `project:${template.id}`, fromProject: true, template })),
  ...prompts.personal.map((template) => ({ value: `personal:${template.id}`, fromProject: false, template })),
]);

const selected = ref<string>(NEW);
const label = ref("");
const description = ref("");
const text = ref("");
const inProject = ref(false);

const isNew = computed(() => selected.value === NEW);

function fillFields() {
  const choice = choices.value.find((c) => c.value === selected.value);
  if (choice === undefined) {
    label.value = "";
    description.value = "";
    text.value = "";
    return;
  }
  label.value = choice.template.label;
  description.value = choice.template.description;
  text.value = choice.template.text;
}

watch(selected, fillFields);

function startNew() {
  selected.value = NEW;
  fillFields();
}

async function save() {
  if (text.value.trim() === "") {
    toast(t("promptEditor.textRequired"));
    return;
  }
  try {
    if (isNew.value) {
      const id = await addPrompt(label.value, description.value, text.value, inProject.value);
      selected.value = `${inProject.value ? "project" : "personal"}:${id}`;
      toast(inProject.value ? t("promptEditor.addedToProject") : t("promptEditor.saved"));
      return;
    }
    const choice = choices.value.find((c) => c.value === selected.value)!;
    await updatePrompt(choice.template.id, choice.fromProject, label.value, description.value, text.value);
    toast(t("promptEditor.saved"));
  } catch (error) {
    toast(String(error));
  }
}

function discard() {
  fillFields();
}

async function remove() {
  const choice = choices.value.find((c) => c.value === selected.value);
  if (choice === undefined) {
    return;
  }
  await removePrompt(choice.template.id, choice.fromProject);
  startNew();
}

function close() {
  promptEditor.open = false;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
  const first = choices.value[0];
  if (first !== undefined) {
    selected.value = first.value;
  }
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown, true));
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div class="dialog" role="dialog" aria-labelledby="prompt-editor-title">
      <header>
        <h2 id="prompt-editor-title">{{ t("promptEditor.title") }}</h2>
        <button class="close" type="button" :aria-label="t('promptEditor.close')" :title="t('promptEditor.close')" @click="close"><Icon name="x-lg" /></button>
      </header>

      <label class="lab" for="prompt-editor-select">{{ t("promptEditor.template") }}</label>
      <div class="row">
        <select id="prompt-editor-select" v-model="selected" class="field grow">
          <option :value="NEW">{{ t("promptEditor.newOption") }}</option>
          <option v-for="choice in choices" :key="choice.value" :value="choice.value">
            {{ choice.template.label }}{{ choice.fromProject ? ` (${t("promptEditor.project")})` : "" }}
          </option>
        </select>
        <button type="button" class="btn" :title="t('promptEditor.newTitle')" @click="startNew"><Icon name="plus-lg" /> {{ t("promptEditor.new") }}</button>
      </div>

      <label class="lab" for="prompt-editor-label">{{ t("promptEditor.labelField") }}</label>
      <input id="prompt-editor-label" v-model="label" class="field" autocomplete="off" spellcheck="false" />

      <label class="lab" for="prompt-editor-description">{{ t("promptEditor.description") }}</label>
      <input id="prompt-editor-description" v-model="description" class="field" autocomplete="off" spellcheck="false" />

      <label class="lab" for="prompt-editor-text">{{ t("promptEditor.text") }}</label>
      <textarea id="prompt-editor-text" v-model="text" class="field text" rows="7" spellcheck="false"></textarea>
      <div class="vars mono" :title="t('promptEditor.variablesTitle')">{{ VARIABLES.join(" ") }}</div>

      <label v-if="isNew && currentProject" class="check"><input v-model="inProject" type="checkbox" />{{ t("promptEditor.inProject") }}</label>

      <footer>
        <ConfirmButton v-if="!isNew" icon="trash" :label="t('promptEditor.deleteLabel')" :confirm-label="t('promptEditor.deleteConfirm')" :question="t('promptEditor.delete')" @confirm="remove" />
        <span class="grow"></span>
        <button type="button" class="btn lg" :title="t('promptEditor.discardTitle')" @click="discard">{{ t("promptEditor.discard") }}</button>
        <button type="button" class="btn lg primary" @click="save">{{ t("promptEditor.save") }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.dialog {
  width: min(520px, 100%); max-height: 100%; overflow-y: auto; padding: 20px; border-radius: 14px; background: var(--panel);
  border: 1px solid var(--line-modal); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; gap: 6px;
}
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.close { border: none; background: transparent; color: var(--muted); width: 26px; height: 26px; border-radius: 6px; }
.close:hover { background: var(--hover); color: var(--text); }
.lab { font-size: var(--font-size); color: var(--text-2); margin-top: 6px; }
.row { display: flex; gap: 8px; }
.grow { flex: 1; min-width: 0; }
.field {
  height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--text); outline: none; font: inherit; font-size: var(--font-size);
}
.field.text { height: auto; padding: 8px 10px; line-height: 20px; resize: vertical; }
.vars { font-size: var(--font-size); color: var(--faint); }
.check { display: flex; align-items: center; gap: 6px; font-size: var(--font-size); color: var(--text-2); margin-top: 6px; }
footer { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
footer :deep(.confirm) {
  height: 36px; padding: 0 12px; border-radius: 10px; font-size: var(--font-size); color: var(--blocked);
  border: none; background: transparent;
}
footer :deep(.confirm:hover) { background: var(--blocked); color: #fff; }
</style>
