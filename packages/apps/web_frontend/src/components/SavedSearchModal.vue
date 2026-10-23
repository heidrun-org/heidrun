<script setup lang="ts">
// The window "Save this search" and the window "Edit the saved search" of the Code hosting sidebar section: one modal
// window that opens over the application. In the mode "save", it asks for the name of a search. In the mode "edit", it
// changes the name and the search of a saved search, or deletes it, after a confirmation dialog. It works for one list,
// and it shows the title of this list.
// - issue #378
// - issue #607
// - issue #822
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "./Icon.vue";
import { codeHosting, codeHostingGroupTitle, searchCodeHosting } from "../stores/code_hosting";
import {
  currentWorkspaceFolder,
  deleteSavedSearch,
  saveSearch,
  savedSearchesOfLevel,
  updateSavedSearch,
} from "../stores/code_hosting_searches";
import { askConfirm } from "../stores/confirm";
import { currentGit } from "../stores/git";
import { selectedWorkspace } from "../stores/session";
import { closeSavedSearchModal, savedSearchModal } from "../stores/saved_search_modal";
import { settings, type SavedSearchLevel } from "../stores/settings";
import { t } from "../i18n/index";

/** True for the window "Edit the saved search", false for the window "Save this search". */
const isEdit = savedSearchModal.mode === "edit";

/** The list that the window works for. */
const group = savedSearchModal.group;

/** The title of the list that the window works for: "Issues", "Pull requests", or "Merge requests". */
const groupTitle = codeHostingGroupTitle(group, codeHosting.forge);

/** The folder of the workspace that was selected when the window opened, or null when there is none. */
const workspaceFolder = currentWorkspaceFolder();

/** The name of the workspace that was selected when the window opened. */
const workspaceName = selectedWorkspace.value?.label ?? "";

/**
 * The saved searches of the list that the window works for, at one level.
 * @param ofLevel - the level
 * @returns the saved searches of this level, in the order of their buttons
 */
function savedSearches(ofLevel: SavedSearchLevel) {
  return savedSearchesOfLevel(group, ofLevel, workspaceFolder);
}

/** In the mode "edit": the name of the saved search that the window edits, as it was when the window opened. */
const editedName = savedSearchModal.name;

/** In the mode "edit": the level of the saved search that the window edits, as it was when the window opened. */
const editedLevel = savedSearchModal.level;

/** In the mode "edit": the saved search that the window edits, or undefined when it no longer exists. */
const editedSaved = savedSearches(editedLevel).find((saved) => saved.name === editedName);

/** The level that the developer chose with the two buttons "User" and "Workspace". */
const level = ref<SavedSearchLevel>(isEdit ? editedLevel : "user");

/** The sentence that tells where the saved search shows, for the chosen level. */
const levelHint = computed(() => {
  return level.value === "user"
    ? t("savedSearchModal.levelUserHint")
    : t("savedSearchModal.levelWorkspaceHint", { name: workspaceName });
});

/** The text of the field "Name". */
const nameText = ref(isEdit ? (editedSaved?.name ?? "") : "");

/** The text of the field "Search" in the mode "edit", and the search to keep in the mode "save". */
const queryText = ref(isEdit ? (editedSaved?.query ?? "") : savedSearchModal.query);

/** The field "Name", which has the focus when the window opens. */
const nameField = ref<HTMLInputElement>();

/** The name without the spaces around it. */
const cleanName = computed(() => nameText.value.trim());

/** The search without the spaces around it. */
const cleanQuery = computed(() => queryText.value.trim());

/** The place of the edited saved search in the list of its level, or -1 when it no longer exists. */
function editedIndex(): number {
  return savedSearches(editedLevel).findIndex((saved) => saved.name === editedName);
}

/** In the mode "edit": the reason why the window cannot save, or an empty text. */
const problem = computed((): string => {
  if (isEdit === false) {
    return "";
  }
  if (cleanName.value === "") {
    return t("savedSearchModal.problemNameEmpty");
  }
  if (cleanQuery.value === "") {
    return t("savedSearchModal.problemQueryEmpty");
  }
  const index = editedIndex();
  const isUsed = savedSearches(level.value).some((saved, savedIndex) => {
    const isEdited = level.value === editedLevel && savedIndex === index;
    return isEdited === false && saved.name === cleanName.value;
  });
  return isUsed ? t("savedSearchModal.problemNameUsed") : "";
});

/** The button "Save" works when the name is not empty and, in the mode "edit", when nothing else is wrong. */
const canSave = computed(() => (isEdit ? problem.value === "" : cleanName.value !== ""));

/** In the mode "save": another saved search has the name, so "Save" replaces its search. */
const isReplacing = computed(() => {
  return isEdit === false && savedSearches(level.value).some((saved) => saved.name === cleanName.value);
});

/**
 * Runs a search in the lists of the Code hosting sidebar section.
 * @param query - the search
 * @returns nothing
 */
async function runSearch(query: string): Promise<void> {
  await searchCodeHosting(currentGit.value?.root ?? null, group, query);
}

/**
 * Keeps the saved search. A new saved search runs at once. An edited saved search that was running runs again with its
 * new search.
 * @returns nothing
 */
async function submit(): Promise<void> {
  if (canSave.value === false) {
    return;
  }
  if (isEdit === false) {
    saveSearch(group, cleanName.value, cleanQuery.value, level.value, workspaceFolder);
    closeSavedSearchModal();
    if (codeHosting.search[group] !== cleanQuery.value) {
      await runSearch(cleanQuery.value);
    }
    return;
  }
  const index = editedIndex();
  if (index === -1) {
    closeSavedSearchModal();
    return;
  }
  const oldQuery = savedSearches(editedLevel)[index].query;
  const wasRunning = codeHosting.search[group] === oldQuery;
  updateSavedSearch(group, editedLevel, index, cleanName.value, cleanQuery.value, level.value, workspaceFolder);
  closeSavedSearchModal();
  if (wasRunning && cleanQuery.value !== oldQuery) {
    await runSearch(cleanQuery.value);
  }
}

/**
 * Deletes the edited saved search, after the confirmation dialog when the setting asks for it.
 * @returns nothing
 */
async function remove(): Promise<void> {
  if (settings.confirmSavedSearchDelete) {
    const isConfirmed = await askConfirm(
      t("savedSearchModal.deleteQuestion", { name: editedName }),
      t("savedSearchModal.deleteConfirm"),
    );
    if (isConfirmed === false) {
      return;
    }
  }
  const index = editedIndex();
  if (index !== -1) {
    deleteSavedSearch(group, editedLevel, index, workspaceFolder);
  }
  closeSavedSearchModal();
}

/**
 * Closes the window at the key Escape.
 * @param event - the key event
 */
function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeSavedSearchModal();
  }
}

onMounted(() => {
  if (isEdit && editedSaved === undefined) {
    closeSavedSearchModal();
    return;
  }
  window.addEventListener("keydown", onKey, true);
  nextTick(() => nameField.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeSavedSearchModal()">
    <form
      class="window-box"
      role="dialog"
      :aria-label="t(isEdit ? 'savedSearchModal.dialogLabelEdit' : 'savedSearchModal.dialogLabelSave')"
      @submit.prevent="submit"
    >
      <header>
        <h2>{{ t(isEdit ? "savedSearchModal.titleEdit" : "savedSearchModal.titleSave") }}</h2>
        <button
          type="button"
          class="btn icon close"
          :title="t('savedSearchModal.closeTitle')"
          :aria-label="t('savedSearchModal.closeLabel')"
          @click="closeSavedSearchModal()"
        >
          <Icon name="x-lg" />
        </button>
      </header>

      <div class="content">
        <div class="field-label">{{ t("savedSearchModal.list") }}</div>
        <div class="list-title" data-saved-search-list>{{ groupTitle }}</div>
        <div class="field-label">{{ t("savedSearchModal.level") }}</div>
        <div class="btn-group" role="group" :aria-label="t('savedSearchModal.level')">
          <label class="btn btn-check btn-outline theme-secondary">
            <input v-model="level" type="radio" name="saved-search-level" autocomplete="off" value="user" data-saved-search-level="user" />
            {{ t("savedSearchModal.levelUser") }}
          </label>
          <label class="btn btn-check btn-outline theme-secondary" :title="workspaceFolder === null ? t('savedSearchModal.levelWorkspaceMissing') : ''">
            <input
              v-model="level"
              type="radio"
              name="saved-search-level"
              autocomplete="off"
              value="workspace"
              data-saved-search-level="workspace"
              :disabled="workspaceFolder === null"
            />
            {{ t("savedSearchModal.levelWorkspace") }}
          </label>
        </div>
        <div class="form-text" data-saved-search-level-hint>{{ levelHint }}</div>
        <label class="field-label" for="saved-search-name">{{ t("savedSearchModal.name") }}</label>
        <input class="form-control" id="saved-search-name" ref="nameField" v-model="nameText" spellcheck="false" autocomplete="off" />
        <template v-if="isEdit">
          <label class="field-label" for="saved-search-query">{{ t("savedSearchModal.search") }}</label>
          <input id="saved-search-query" v-model="queryText" class="form-control mono" spellcheck="false" autocomplete="off" />
        </template>
        <template v-else>
          <div class="field-label">{{ t("savedSearchModal.search") }}</div>
          <code class="query" data-saved-search-query>{{ queryText }}</code>
        </template>
        <div v-if="problem !== ''" class="problem" role="alert">{{ problem }}</div>
        <div v-else-if="isReplacing" class="hint" role="status">{{ t("savedSearchModal.nameExists") }}</div>
        <div class="row">
          <button
            v-if="isEdit"
            type="button"
            class="btn delete"
            :title="t('savedSearchModal.deleteTitle')"
            @click="remove"
          >
            {{ t("savedSearchModal.delete") }}
          </button>
          <button type="button" class="btn" :title="t('savedSearchModal.cancelTitle')" @click="closeSavedSearchModal()">
            {{ t("savedSearchModal.cancel") }}
          </button>
          <button type="submit" class="btn primary" :title="t('savedSearchModal.saveTitle')" :disabled="canSave === false">
            {{ t("savedSearchModal.save") }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button:not(.btn)) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 57; background: var(--shadow); display: flex; align-items: center; justify-content: center; padding: 32px; }
.window-box {
  width: min(520px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px var(--shadow);
}
header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
h2 { flex: 1; margin: 0; font-size: var(--font-size); font-weight: 600; }
.content { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
.field-label { color: var(--muted); font-size: calc(var(--font-size) * 0.85); }
.list-title { font-weight: 600; }
.content input { height: 32px; }
.content input.mono { font-family: var(--mono); }
.query { padding: 6px 10px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); font-family: var(--mono); font-size: var(--font-size); overflow-wrap: anywhere; user-select: text; }
.problem { color: var(--fail); font-size: calc(var(--font-size) * 0.85); }
.hint { color: var(--muted); font-size: calc(var(--font-size) * 0.85); }
.row { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }
.delete { margin-right: auto; }
</style>
