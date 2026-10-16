<script setup lang="ts">
// The guard window: it opens over the Settings window. In the mode "new" it adds a guard to the project, in the mode "edit" it
// changes one, and in the mode "view" it shows a built-in guard, with no button to save: the developer reads the criteria of the
// guard and tries a command. The field "Try a command" tells which line of the guard matches the command.
// - issue #596
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import DialogCloseButton from "./DialogCloseButton.vue";
import Icon from "./Icon.vue";
import { builtInGuardLines, DEFAULT_GUARDS, projectGuardList, tryCommand } from "../lib/guards";
import {
  checkGuardDraft,
  draftFromGuard,
  emptyDraft,
  GUARD_ACTIONS,
  GUARD_MATCH_TYPES,
  toProjectGuard,
  type GuardDraft,
} from "../lib/guards_edit";
import { closeGuardWindow, guardWindow } from "../stores/guard_window";
import { currentProject, saveProjectGuard } from "../stores/project";
import { state as session } from "../stores/session";
import { t } from "../i18n/index";

/** The mode of the window when it opened: a window that is open never changes its mode. */
const mode = guardWindow.mode;

/** True in the mode "view": every field is read only, and the window has no button to save. */
const isReadOnly = mode === "view";

/** In the mode "view": the built-in guard that the window shows. */
const builtIn = isReadOnly ? DEFAULT_GUARDS.find((guard) => guard.whyKey === guardWindow.builtInKey) : undefined;

/** In the mode "edit": the name of the guard that the window edits, as it was when the window opened. Null in the other modes. */
const originalName = mode === "edit" ? guardWindow.name : null;

/** The guards of the project, as the file holds them. */
const guardsConfig = computed(() => currentProject.value?.config.guards);

/** The flags of the regular expressions of the lines: a built-in guard has its own flags, and a guard of the project ignores the case. */
const flags = builtIn === undefined ? "i" : builtInGuardLines(builtIn).flags;

/** The draft that the first state of the window shows. */
function firstDraft(): GuardDraft {
  if (builtIn !== undefined) {
    return {
      name: t(builtIn.whyKey),
      description: t(builtIn.whatKey).replace(/`/g, ""),
      action: "confirm",
      matches: builtInGuardLines(builtIn).matches,
    };
  }
  const edited = projectGuardList(guardsConfig.value).find((guard) => guard.name === originalName);
  return edited === undefined ? emptyDraft() : draftFromGuard(edited);
}

/** What the fields hold. */
const draft = reactive<GuardDraft>(firstDraft());

/** The field "Name", which has the focus when the window opens. */
const nameField = ref<HTMLInputElement>();

/** The field "Try a command", which has the focus when the window shows a built-in guard. */
const tryField = ref<HTMLInputElement>();

/** The text of the field "Try a command". */
const tryText = ref("");

/** The problems that are shown only after the developer presses "Save guard" once: an empty name, an empty line, a used name. */
const hasTriedSave = ref(false);

const problems = computed(() => checkGuardDraft(draft, guardsConfig.value, originalName));

const title = computed(() => t(mode === "new" ? "guardModal.titleNew" : mode === "edit" ? "guardModal.titleEdit" : "guardModal.titleView"));

/** The result of the command of the field "Try a command" for each line, or null while the field is empty. */
const tryResult = computed(() => {
  if (tryText.value.trim() === "") {
    return null;
  }
  return tryCommand(
    tryText.value,
    draft.matches.map((match) => ({ type: match.type, text: match.text.trim() })),
    flags,
  );
});

/** The sentence under the field "Try a command". */
const tryMessage = computed(() => {
  if (tryResult.value === null) {
    return "";
  }
  const firstMatch = tryResult.value.lineResults.indexOf("match");
  if (firstMatch === -1) {
    return t("guardModal.tryNoMatch");
  }
  return t(draft.action === "block" ? "guardModal.tryMatchBlock" : "guardModal.tryMatchConfirm", { number: firstMatch + 1 });
});

/** The sentences about the lines that are a regular expression that cannot be read, while the field "Try a command" is filled. */
const tryInvalidMessages = computed(() => {
  const results = tryResult.value?.lineResults ?? [];
  return results.flatMap((result, index) => (result === "invalid" ? [t("guardModal.tryInvalid", { number: index + 1 })] : []));
});

/** The error under a line: a regular expression that cannot be read shows at once, and an empty line shows after the first save. */
function lineError(index: number): string {
  const problem = problems.value.lines[index];
  if (problem === null || problem === undefined) {
    return "";
  }
  if (problem.reason === "invalid") {
    return t("guardModal.errorLineInvalid", { detail: problem.detail });
  }
  return hasTriedSave.value ? t("guardModal.errorLineEmpty") : "";
}

/** The error under the field "Name", shown after the first save. */
const nameError = computed(() => {
  if (hasTriedSave.value === false || problems.value.name === null) {
    return "";
  }
  return t(problems.value.name === "empty" ? "guardModal.errorNameEmpty" : "guardModal.errorNameUsed");
});

function addLine(): void {
  draft.matches.push({ type: "contains", text: "" });
}

function removeLine(index: number): void {
  draft.matches.splice(index, 1);
}

/**
 * Saves the guard in the file `.heidrun/config.json` and closes the window. Nothing is saved while the draft has a problem.
 * @returns nothing
 */
async function save(): Promise<void> {
  if (isReadOnly) {
    return;
  }
  hasTriedSave.value = true;
  const workspaceId = session.selectedWorkspaceId;
  if (problems.value.isValid === false || workspaceId === null) {
    return;
  }
  const isSaved = await saveProjectGuard(workspaceId, toProjectGuard(draft), originalName);
  if (isSaved) {
    closeGuardWindow();
  }
}

/**
 * Closes the window at the key Escape. The Settings window below does not see the key.
 * @param event - the key event
 */
function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeGuardWindow();
  }
}

onMounted(() => {
  if (mode === "edit" && projectGuardList(guardsConfig.value).some((guard) => guard.name === originalName) === false) {
    closeGuardWindow();
    return;
  }
  window.addEventListener("keydown", onKey, true);
  nextTick(() => (isReadOnly ? tryField.value : nameField.value)?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeGuardWindow()">
    <dialog class="dialog dialog-lg dialog-instant dialog-nonmodal" open aria-labelledby="guard-window-title" data-field="guard-window">
      <div class="dialog-header">
        <div id="guard-window-title" class="dialog-title me-auto" role="heading" aria-level="2">{{ title }}</div>
        <DialogCloseButton :title="t('guardModal.closeTitle')" :label="t('guardModal.closeLabel')" @click="closeGuardWindow()" />
      </div>
      <form class="dialog-body d-flex flex-column gap-3 overflow-y-auto" @submit.prevent="save">
        <div class="form-field">
          <label class="form-label" for="guard-name">{{ t("guardModal.name") }}</label>
          <input
            id="guard-name"
            ref="nameField"
            v-model="draft.name"
            class="form-control"
            :class="{ 'is-invalid': nameError !== '' }"
            :disabled="isReadOnly"
            spellcheck="false"
            autocomplete="off"
          />
          <small v-if="nameError !== ''" class="form-text text-danger-emphasis" role="alert" data-field="name-error">{{ nameError }}</small>
        </div>

        <div class="form-field">
          <label class="form-label" for="guard-description">{{ t("guardModal.description") }}</label>
          <textarea id="guard-description" v-model="draft.description" class="form-control" rows="2" :disabled="isReadOnly"></textarea>
          <small v-if="isReadOnly === false" class="form-text">{{ t("guardModal.descriptionHelp") }}</small>
        </div>

        <div class="form-field" role="radiogroup" aria-labelledby="guard-action-label">
          <span id="guard-action-label" class="form-label">{{ t("guardModal.action") }}</span>
          <div v-for="item in GUARD_ACTIONS" :key="item.action" class="form-field">
            <input
              :id="`guard-action-${item.action}`"
              v-model="draft.action"
              class="radio"
              type="radio"
              name="guard-action"
              :value="item.action"
              :disabled="isReadOnly"
            />
            <div class="form-field-content">
              <label :for="`guard-action-${item.action}`" class="fw-medium">{{ t(item.labelKey) }}</label>
              <small class="form-text">{{ t(item.helpKey) }}</small>
            </div>
          </div>
        </div>

        <div class="form-field" data-field="lines">
          <span class="form-label">{{ t("guardModal.matches") }}</span>
          <small class="form-text">{{ t(isReadOnly ? "guardModal.matchesHelpBuiltIn" : "guardModal.matchesHelp") }} {{ t(flags.includes("i") ? "guardModal.caseIgnored" : "guardModal.caseMatters") }}</small>
          <template v-for="(match, index) in draft.matches" :key="index">
            <div class="d-flex align-items-center gap-2" data-field="line">
              <select
                v-model="match.type"
                class="form-control w-auto"
                :aria-label="t('guardModal.lineType', { number: index + 1 })"
                :disabled="isReadOnly"
              >
                <option v-for="item in GUARD_MATCH_TYPES" :key="item.type" :value="item.type">{{ t(item.labelKey) }}</option>
              </select>
              <input
                v-model="match.text"
                class="form-control flex-fill"
                :class="{ 'font-monospace': match.type === 'regex', 'is-invalid': lineError(index) !== '' }"
                :aria-label="t('guardModal.lineText', { number: index + 1 })"
                :disabled="isReadOnly"
                spellcheck="false"
                autocomplete="off"
              />
              <span
                v-if="tryResult !== null && tryResult.lineResults[index] === 'match'"
                class="text-success-emphasis"
                role="img"
                :aria-label="t('guardModal.lineMatches', { number: index + 1 })"
                :title="t('guardModal.lineMatches', { number: index + 1 })"
                data-field="line-match"
              >
                <Icon name="check-lg" />
              </span>
              <button
                v-if="isReadOnly === false"
                type="button"
                class="btn"
                :aria-label="t('guardModal.removeLine', { number: index + 1 })"
                :title="t('guardModal.removeLine', { number: index + 1 })"
                :disabled="draft.matches.length === 1"
                @click="removeLine(index)"
              >
                <Icon name="trash" />
              </button>
            </div>
            <small v-if="lineError(index) !== ''" class="form-text text-danger-emphasis text-break" role="alert" data-field="line-error">{{ lineError(index) }}</small>
          </template>
          <div v-if="isReadOnly === false">
            <button type="button" class="btn" data-field="add-line" @click="addLine()"><Icon name="plus-lg" /> {{ t("guardModal.addLine") }}</button>
          </div>
        </div>

        <div class="form-field border-top pt-2" data-field="try">
          <label class="form-label" for="guard-try">{{ t("guardModal.try") }}</label>
          <input id="guard-try" ref="tryField" v-model="tryText" class="form-control font-monospace" spellcheck="false" autocomplete="off" />
          <small v-if="tryMessage !== ''" class="form-text" :class="tryResult?.isMatch === true ? 'text-success-emphasis' : 'text-body-secondary'" role="status" data-field="try-message">{{ tryMessage }}</small>
          <small v-for="message in tryInvalidMessages" :key="message" class="form-text text-danger-emphasis" data-field="try-invalid">{{ message }}</small>
        </div>

        <div v-if="isReadOnly" class="alert theme-secondary" role="note" data-field="built-in-note">{{ t("guardModal.builtInNote") }}</div>
        <small v-if="hasTriedSave && problems.hasNoLine" class="form-text text-danger-emphasis" role="alert">{{ t("guardModal.errorNoLine") }}</small>
      </form>
      <div class="dialog-footer">
        <button type="button" class="btn" data-field="cancel" @click="closeGuardWindow()">{{ t(isReadOnly ? "guardModal.close" : "guardModal.cancel") }}</button>
        <button v-if="isReadOnly === false" type="button" class="btn theme-primary" data-field="save" @click="save()">{{ t("guardModal.save") }}</button>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); }
</style>
