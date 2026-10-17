<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch, ref } from "vue";
import Icon from "../Icon.vue";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import { builtInGuardLines, DEFAULT_GUARDS, projectGuardList, type GuardId } from "../../lib/guards";
import { GUARD_ACTIONS, GUARD_MATCH_TYPES, guardIdText, isBuiltInGuardEnabled } from "../../lib/guards_edit";
import type { GuardAction } from "../../lib/project_config";
import { guardFocus } from "../../stores/guards";
import { openEditGuardWindow, openNewGuardWindow, openViewGuardWindow } from "../../stores/guard_window";
import { currentProject, loadProject, project, removeProjectGuard, setBuiltInGuardEnabled } from "../../stores/project";
import { state as session } from "../../stores/session";
import { t } from "../../i18n/index";

// The guards of the project of the selected workspace, in one list: the guards of the project first, then the hardcoded guards,
// which are the built-in guards. Both kinds look the same, and a hardcoded guard has the label "Hardcoded". The developer adds
// and edits a guard of the project in the guard window, and reads a hardcoded guard in the same window. A switch turns a hardcoded
// guard off for the project. Every change writes the file `.heidrun/config.json` at once.

/** One row of the list. */
type GuardRow = {
  /** The text that finds the row, from `guardIdText`. */
  idText: string;
  /** True for a guard of the project, false for a hardcoded guard. */
  isProjectGuard: boolean;
  /** The name of a guard of the project, or the key of a hardcoded guard. */
  key: string;
  /** The name: the name of a guard of the project, or the reason of a hardcoded guard. */
  name: string;
  action: GuardAction;
  /** The description, cut at its backquotes: the parts between two backquotes are commands. */
  descriptionParts: { text: string; isCommand: boolean }[];
  /** The lines of the guard, with the key of the text of the type of each line. */
  lines: { typeKey: string; text: string }[];
  /** True when the guard is on. A guard of the project is always on. */
  isOn: boolean;
  isFocused: boolean;
};

/** The blocks of the information card of the guards of the project, in the order of the card. */
const PROJECT_GUARDS_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.projectGuards.what" },
  { titleKey: "settingsHelp.howTitle", textKey: "settingsHelp.projectGuards.how" },
] as const;

/** The blocks of the information card of a hardcoded guard, in the order of the card. */
const BUILT_IN_GUARDS_HELP_BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.builtInGuards.what" },
  { titleKey: "settingsHelp.readTitle", textKey: "settingsHelp.builtInGuards.read" },
  { titleKey: "settingsHelp.switchTitle", textKey: "settingsHelp.builtInGuards.switch" },
] as const;

const rootElement = ref<HTMLElement>();
const workspaceId = computed(() => session.selectedWorkspaceId ?? null);
const loadError = computed(() => (workspaceId.value === null ? undefined : project.errors[workspaceId.value]));
const guardsConfig = computed(() => currentProject.value?.config.guards);
/** The file `.heidrun/config.json` is valid, so a change can be written without losing the content of the file. */
const isEditable = computed(() => loadError.value === undefined);

/** Cuts a text at its backquotes: the parts between two backquotes are commands, written in a monospace font. */
function splitCommands(text: string): { text: string; isCommand: boolean }[] {
  return text
    .split("`")
    .map((part, index) => ({ text: part, isCommand: index % 2 === 1 }))
    .filter((part) => part.text !== "");
}

function typeKeyOf(type: string): string {
  return GUARD_MATCH_TYPES.find((item) => item.type === type)?.labelKey ?? "guards.matchRegex";
}

function isFocused(guard: GuardId): boolean {
  return guardFocus.guard !== null && guardIdText(guardFocus.guard) === guardIdText(guard);
}

const projectRows = computed((): GuardRow[] =>
  projectGuardList(guardsConfig.value).map((guard) => {
    const guardId: GuardId = { kind: "project", name: guard.name };
    return {
      idText: guardIdText(guardId),
      isProjectGuard: true,
      key: guard.name,
      name: guard.name,
      action: guard.action,
      descriptionParts: splitCommands(guard.description ?? ""),
      lines: guard.matches.map((match) => ({ typeKey: typeKeyOf(match.type), text: match.text })),
      isOn: true,
      isFocused: isFocused(guardId),
    };
  }),
);

const builtInRows = computed((): GuardRow[] =>
  DEFAULT_GUARDS.map((guard) => {
    const guardId: GuardId = { kind: "builtin", key: guard.whyKey };
    return {
      idText: guardIdText(guardId),
      isProjectGuard: false,
      key: guard.whyKey,
      name: t(guard.whyKey),
      action: "confirm",
      descriptionParts: splitCommands(t(guard.whatKey)),
      lines: builtInGuardLines(guard).matches.map((match) => ({ typeKey: typeKeyOf(match.type), text: match.text })),
      isOn: isBuiltInGuardEnabled(guardsConfig.value, guard.whyKey),
      isFocused: isFocused(guardId),
    };
  }),
);

const rows = computed(() => [...projectRows.value, ...builtInRows.value]);

function actionLabelKey(action: GuardAction): string {
  return GUARD_ACTIONS.find((item) => item.action === action)?.labelKey ?? "guards.actionConfirm";
}

async function toggleBuiltIn(key: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const isEnabled = input.checked;
  if (workspaceId.value === null) {
    return;
  }
  const isSaved = await setBuiltInGuardEnabled(workspaceId.value, key, isEnabled);
  if (isSaved === false) {
    input.checked = isEnabled === false;
  }
}

async function removeGuard(name: string) {
  if (workspaceId.value === null) {
    return;
  }
  await removeProjectGuard(workspaceId.value, name);
}

// The guard that stopped a command is highlighted, and the list scrolls to it.
watch(
  [() => guardFocus.guard, currentProject],
  async () => {
    await nextTick();
    const focusedElement = rootElement.value?.querySelector('[data-focused="true"]');
    focusedElement?.scrollIntoView?.({ block: "center" });
  },
  { immediate: true },
);

// The developer may have changed the file by hand since the last read: read it again before showing it.
onMounted(() => {
  if (workspaceId.value !== null) {
    void loadProject(workspaceId.value);
  }
});

onBeforeUnmount(() => {
  guardFocus.guard = null;
});
</script>

<template>
  <div ref="rootElement" class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("settingsGuards.lead") }}</p>

    <div v-if="workspaceId === null || (currentProject === undefined && loadError === undefined)" class="alert theme-secondary" role="status" data-field="no-project">
      {{ t("settingsGuards.noProject") }}
    </div>
    <div v-else-if="currentProject === undefined" class="alert theme-danger text-break" role="alert" data-field="load-error">{{ loadError }}</div>

    <template v-else>
      <div class="d-flex align-items-center gap-2">
        <div class="d-flex align-items-center gap-2 me-auto" data-option="projectGuards">
          <p class="m-0 text-body-secondary text-break" data-field="project-line">{{ t("settingsGuards.projectLine", { root: currentProject.root }) }}</p>
          <SettingsOptionHelp title-key="settingsHelp.projectGuards.title" :blocks="PROJECT_GUARDS_HELP_BLOCKS" />
        </div>
        <button type="button" class="btn" :disabled="isEditable === false" :title="t('settingsGuards.addTitle')" data-field="add-guard" @click="openNewGuardWindow()">
          <Icon name="plus-lg" /> {{ t("settingsGuards.add") }}
        </button>
      </div>
      <div v-if="loadError !== undefined" class="alert theme-danger text-break" role="alert" data-field="load-error">{{ loadError }}</div>
      <p v-if="projectRows.length === 0" class="m-0 text-body-secondary" data-field="no-project-guard">{{ t("settingsGuards.noProjectGuard") }}</p>

      <div class="list-group" data-field="guards">
        <div
          v-for="row in rows"
          :key="row.idText"
          class="list-group-item d-flex flex-column gap-1"
          :class="{ 'theme-warning': row.isFocused }"
          :data-guard="row.idText"
          :data-kind="row.isProjectGuard ? 'project' : 'builtin'"
          :data-option="row.isProjectGuard ? undefined : 'builtInGuard'"
          :data-focused="row.isFocused ? 'true' : undefined"
        >
          <div class="d-flex align-items-center gap-2">
            <div class="d-flex align-items-center gap-2 flex-wrap me-auto" :class="{ 'opacity-50': row.isOn === false }">
              <span class="fw-medium" data-field="name">{{ row.name }}</span>
              <span class="badge" :class="row.action === 'block' ? 'theme-danger' : 'theme-warning'" data-field="action">{{ t(actionLabelKey(row.action)) }}</span>
              <span v-if="row.isProjectGuard === false" class="badge theme-secondary" data-field="hardcoded">{{ t("settingsGuards.hardcoded") }}</span>
            </div>
            <SettingsOptionHelp
              v-if="row.isProjectGuard === false"
              title-key="settingsHelp.builtInGuards.title"
              :blocks="BUILT_IN_GUARDS_HELP_BLOCKS"
            />
            <div class="d-flex align-items-center gap-1">
              <template v-if="row.isProjectGuard">
                <button
                  type="button"
                  class="btn"
                  :aria-label="t('settingsGuards.edit', { name: row.name })"
                  :title="t('settingsGuards.edit', { name: row.name })"
                  :disabled="isEditable === false"
                  data-field="edit"
                  @click="openEditGuardWindow(row.key)"
                >
                  <Icon name="pencil" />
                </button>
                <button
                  type="button"
                  class="btn"
                  :aria-label="t('settingsGuards.remove', { name: row.name })"
                  :title="t('settingsGuards.remove', { name: row.name })"
                  :disabled="isEditable === false"
                  data-field="remove"
                  @click="removeGuard(row.key)"
                >
                  <Icon name="trash" />
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="btn"
                  :aria-label="t('settingsGuards.view', { name: row.name })"
                  :title="t('settingsGuards.view', { name: row.name })"
                  data-field="view"
                  @click="openViewGuardWindow(row.key)"
                >
                  <Icon name="eye" />
                </button>
                <span class="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    :checked="row.isOn"
                    :aria-label="t('settingsGuards.switchLabel', { name: row.name })"
                    :title="t('settingsGuards.switchLabel', { name: row.name })"
                    :disabled="isEditable === false"
                    @change="toggleBuiltIn(row.key, $event)"
                  />
                </span>
              </template>
            </div>
          </div>
          <div class="d-flex flex-column gap-1" :class="{ 'opacity-50': row.isOn === false }">
            <div v-if="row.descriptionParts.length > 0" class="text-body-secondary text-break" data-field="description">
              <template v-for="(part, index) in row.descriptionParts" :key="index">
                <code v-if="part.isCommand">{{ part.text }}</code>
                <template v-else>{{ part.text }}</template>
              </template>
            </div>
            <div v-for="(line, index) in row.lines" :key="index" class="text-break" data-field="line">
              <span class="text-body-secondary">{{ t(line.typeKey) }}</span> <code>{{ line.text }}</code>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
