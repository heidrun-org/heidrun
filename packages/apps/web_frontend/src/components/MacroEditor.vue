<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { askConfirm } from "../stores/confirm";
import { currentProject } from "../stores/project";
import { toast } from "../stores/session";
import { VARIABLES, addMacro, macroEditor, macros, projectMacros, removeMacro, updateMacro } from "../stores/macros";
import { t } from "../i18n/index";

const NEW = "__new__";

/** The selector value of a macro: where it is kept, then its id. */
const choices = computed(() => [
  ...projectMacros.value.map((macro) => ({ value: `project:${macro.id}`, fromProject: true, macro })),
  ...macros.personal.map((macro) => ({ value: `personal:${macro.id}`, fromProject: false, macro })),
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
  label.value = choice.macro.label;
  description.value = choice.macro.description;
  text.value = choice.macro.text;
}

watch(selected, fillFields);

function startNew() {
  selected.value = NEW;
  fillFields();
}

async function save() {
  if (text.value.trim() === "") {
    toast(t("macroEditor.textRequired"));
    return;
  }
  try {
    if (isNew.value) {
      const id = await addMacro(label.value, description.value, text.value, inProject.value);
      selected.value = `${inProject.value ? "project" : "personal"}:${id}`;
      toast(inProject.value ? t("macroEditor.addedToProject") : t("macroEditor.saved"));
      return;
    }
    const choice = choices.value.find((c) => c.value === selected.value)!;
    await updateMacro(choice.macro.id, choice.fromProject, label.value, description.value, text.value);
    toast(t("macroEditor.saved"));
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
  await removeMacro(choice.macro.id, choice.fromProject);
  startNew();
}

async function askRemove() {
  if (await askConfirm(t("macroEditor.delete"), t("macroEditor.deleteConfirm"))) {
    await remove();
  }
}

function close() {
  macroEditor.open = false;
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
  <div class="overlay" role="dialog" aria-labelledby="macro-editor-title" @mousedown.self="close">
    <div class="dialog">
      <div class="dialog-header d-flex align-items-center justify-content-between">
        <div id="macro-editor-title" class="fw-semibold" role="heading" aria-level="2">{{ t("macroEditor.title") }}</div>
        <button type="button" class="btn-close" :aria-label="t('macroEditor.close')" :title="t('macroEditor.close')" @click="close"></button>
      </div>

      <div class="dialog-body">
        <div class="mb-3">
          <label class="form-label" for="macro-editor-select">{{ t("macroEditor.macro") }}</label>
          <div class="d-flex align-items-center gap-2">
            <select id="macro-editor-select" v-model="selected" class="form-control">
              <option :value="NEW">{{ t("macroEditor.newOption") }}</option>
              <option v-for="choice in choices" :key="choice.value" :value="choice.value">
                {{ choice.macro.label }}{{ choice.fromProject ? ` (${t("macroEditor.project")})` : "" }}
              </option>
            </select>
            <button type="button" class="btn" :title="t('macroEditor.newTitle')" @click="startNew"><Icon name="plus-lg" /> {{ t("macroEditor.new") }}</button>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label" for="macro-editor-label">{{ t("macroEditor.labelField") }}</label>
          <input id="macro-editor-label" v-model="label" class="form-control" autocomplete="off" spellcheck="false" />
        </div>

        <div class="mb-3">
          <label class="form-label" for="macro-editor-description">{{ t("macroEditor.description") }}</label>
          <input id="macro-editor-description" v-model="description" class="form-control" autocomplete="off" spellcheck="false" />
        </div>

        <div class="mb-3">
          <label class="form-label" for="macro-editor-text">{{ t("macroEditor.text") }}</label>
          <textarea id="macro-editor-text" v-model="text" class="form-control" rows="7" spellcheck="false"></textarea>
          <div class="form-text mono" :title="t('macroEditor.variablesTitle')">{{ VARIABLES.join(" ") }}</div>
        </div>

        <div v-if="isNew && currentProject" class="d-flex align-items-center gap-2">
          <input id="macro-editor-in-project" v-model="inProject" type="checkbox" />
          <label for="macro-editor-in-project">{{ t("macroEditor.inProject") }}</label>
        </div>
      </div>

      <div class="dialog-footer d-flex align-items-center justify-content-end gap-2">
        <button v-if="!isNew" type="button" class="btn text-danger-emphasis me-auto" :title="t('macroEditor.delete')" @click="askRemove"><Icon name="trash" /> {{ t("macroEditor.deleteLabel") }}</button>
        <button type="button" class="btn lg" :title="t('macroEditor.discardTitle')" @click="discard">{{ t("macroEditor.discard") }}</button>
        <button type="button" class="btn lg primary" @click="save">{{ t("macroEditor.save") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.dialog {
  width: min(500px, 100%); max-height: 100%; display: flex; flex-direction: column; overflow: auto;
  border-radius: var(--radius-7); background: var(--bg-body); color: var(--fg-body);
  border: 1px solid var(--border-color-translucent); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
.dialog-header { padding: 1rem; border-bottom: 1px solid var(--border-color-translucent); }
.dialog-body { padding: 1rem; }
.dialog-footer { padding: 1rem; border-top: 1px solid var(--border-color-translucent); }
</style>
