<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { addAction, updateAction } from "../stores/project";
import { closeNewCustomScriptModal, newCustomScriptModal } from "../stores/newCustomScript";
import { state, toast } from "../stores/session";
import { project } from "../stores/project";
import { effortsOf } from "../lib/coding_agent_models";
import { CUSTOM_SCRIPT_CODING_AGENTS, findCodingAgent } from "../lib/coding_agents";
import { isLoadingModels, loadCodingAgentModels, modelsOf } from "../stores/coding_agent_models";
import { scriptAgentCommand } from "../lib/script_agent_command";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";

type Kind = "commandLine" | "codingAgent";

/** The two kinds of custom script, as the radio buttons show them. */
const KINDS: { id: Kind; labelKey: string }[] = [
  { id: "commandLine", labelKey: "newCustomScriptModal.kindCommandLine" },
  { id: "codingAgent", labelKey: "newCustomScriptModal.kindCodingAgent" },
];


const nameField = ref<HTMLInputElement>();

/** The custom script that the window edits, or `undefined` when the window creates a new one. */
const editedAction = (() => {
  const workspaceId = state.selectedWorkspaceId;
  const id = newCustomScriptModal.editedId;
  if (id === null || workspaceId === null || workspaceId === undefined) {
    return undefined;
  }
  return project.byWorkspace[workspaceId]?.config.actions.find((action) => action.id === id);
})();
const isEditing = editedAction !== undefined;

const kind = ref<Kind>(isEditing ? (editedAction.agent === undefined ? "commandLine" : "codingAgent") : settings.customScriptKind);
const name = ref(editedAction?.label ?? "");
const description = ref(editedAction?.description ?? "");
const command = ref(editedAction !== undefined && editedAction.agent === undefined ? editedAction.command : "");
const agentName = ref(editedAction?.agent?.name ?? settings.customScriptAgent);
const folder = ref(editedAction?.cwd ?? "");
const model = ref(isEditing ? (editedAction.agent?.model ?? "") : settings.customScriptModel);
const effort = ref(isEditing ? (editedAction.agent?.effort ?? "") : settings.customScriptEffort);

// The last kind, coding agent, model, and effort are remembered, but an edit never changes them.
watch(kind, (value) => {
  if (isEditing === false) {
    settings.customScriptKind = value;
  }
});
watch(agentName, (value) => {
  if (isEditing === false) {
    settings.customScriptAgent = value;
  }
});
watch(model, (value) => {
  if (isEditing === false) {
    settings.customScriptModel = value;
  }
});
watch(effort, (value) => {
  if (isEditing === false) {
    settings.customScriptEffort = value;
  }
});
const prompt = ref(editedAction?.agent?.prompt ?? "");
const isWritingName = ref(false);
const isFolderValid = computed(() => relativeFolder() !== null);

/**
 * The current work directory, as a path relative to the root of the repository: an empty string for the root itself.
 * `null` when the path is outside the repository.
 */
function relativeFolder(): string | null {
  const value = folder.value.trim().replace(/\/+$/, "");
  const workspaceId = state.selectedWorkspaceId;
  const root = workspaceId === null || workspaceId === undefined ? undefined : project.byWorkspace[workspaceId]?.root;
  if (value === "" || value === ".") {
    return "";
  }
  if (value.startsWith("/") === false) {
    return value.split("/").includes("..") ? null : value.replace(/^\.\//, "");
  }
  if (root === undefined) {
    return null;
  }
  const rootPath = root.replace(/\/+$/, "");
  if (value === rootPath) {
    return "";
  }
  return value.startsWith(`${rootPath}/`) ? value.slice(rootPath.length + 1) : null;
}

/** Opens the native folder picker, on the root of the repository, and puts the chosen folder in the field. */
async function chooseFolder() {
  const workspaceId = state.selectedWorkspaceId;
  const root = workspaceId === null || workspaceId === undefined ? undefined : project.byWorkspace[workspaceId]?.root;
  const path = await openDialog({
    directory: true,
    multiple: false,
    title: t("newCustomScriptModal.chooseFolder"),
    defaultPath: root,
  });
  if (path === null) {
    return;
  }
  folder.value = path;
  if (relativeFolder() === null) {
    toast(t("newCustomScriptModal.folderOutside"));
    folder.value = "";
    return;
  }
  folder.value = relativeFolder() ?? "";
}

const models = computed(() => modelsOf(agentName.value));
const efforts = computed(() => effortsOf(findCodingAgent(agentName.value)?.efforts ?? [], models.value, model.value));

/** The models of the select: the models of the coding agent, and the saved model of an edited script that is no longer listed. */
const modelChoices = computed(() => {
  const choices = models.value.map(({ id, label }) => ({ id, label }));
  if (isEditing && model.value !== "" && choices.some((choice) => choice.id === model.value) === false) {
    choices.push({ id: model.value, label: model.value });
  }
  return choices;
});

/** The efforts of the select: the efforts of the model, and the saved effort of an edited script that is no longer listed. */
const effortChoices = computed(() => {
  const choices = [...efforts.value];
  if (isEditing && effort.value !== "" && choices.includes(effort.value) === false) {
    choices.push(effort.value);
  }
  return choices;
});
const isContentFilled = computed(() => (kind.value === "commandLine" ? command.value.trim() !== "" : prompt.value.trim() !== ""));
const canCreate = computed(() => name.value.trim() !== "" && isContentFilled.value && isFolderValid.value);

watch(agentName, () => {
  model.value = "";
  effort.value = "";
});

// Asks the tool of each coding agent for its models, now, so that a remembered model is not dropped before the answer.
for (const agent of CUSTOM_SCRIPT_CODING_AGENTS) {
  void loadCodingAgentModels(agent.id);
}

// A remembered model or effort that the coding agent does not list now is dropped, once the tool has answered. A script
// that is edited keeps its saved values: the selects show them.
watch(
  [models, efforts, () => isLoadingModels(agentName.value)],
  () => {
    if (isEditing || isLoadingModels(agentName.value)) {
      return;
    }
    if (model.value !== "" && models.value.some((candidate) => candidate.id === model.value) === false) {
      model.value = "";
    }
    if (effort.value !== "" && efforts.value.includes(effort.value) === false) {
      effort.value = "";
    }
  },
  { immediate: true },
);

/** Text that tells the coding agent everything that the person filled in, to write the name from it. */
function describeForm(): string {
  const lines = name.value.trim() === "" ? [] : [t("newCustomScriptModal.descriptionName", { name: name.value.trim() })];
  if (description.value.trim() !== "") {
    lines.push(t("newCustomScriptModal.descriptionText", { description: description.value.trim() }));
  }
  lines.push(t("newCustomScriptModal.descriptionKind", { kind: t(kind.value === "commandLine" ? "newCustomScriptModal.kindCommandLine" : "newCustomScriptModal.kindCodingAgent") }));
  if (kind.value === "commandLine") {
    lines.push(t("newCustomScriptModal.descriptionCommand", { command: command.value }));
    return lines.join("\n");
  }
  lines.push(t("newCustomScriptModal.descriptionAgent", { agent: agentName.value }));
  if (folder.value.trim() !== "") {
    lines.push(t("newCustomScriptModal.descriptionFolder", { folder: folder.value.trim() }));
  }
  if (model.value.trim() !== "") {
    lines.push(t("newCustomScriptModal.descriptionModel", { model: model.value.trim() }));
  }
  if (effort.value !== "") {
    lines.push(t("newCustomScriptModal.descriptionEffort", { effort: effort.value }));
  }
  lines.push(t("newCustomScriptModal.descriptionPrompt", { prompt: prompt.value }));
  return lines.join("\n");
}

/** Writes the name, the description, or both, with a coding agent: only the fields that are empty. */
async function writeName() {
  if (isWritingName.value === true) {
    return;
  }
  const isNameEmpty = name.value.trim() === "";
  const isDescriptionEmpty = description.value.trim() === "";
  if (isNameEmpty === false && isDescriptionEmpty === false) {
    toast(t("newCustomScriptModal.bothFilled"));
    return;
  }
  if (isContentFilled.value === false) {
    nextTick(() => document.getElementById(kind.value === "commandLine" ? "new-script-command" : "new-script-prompt")?.focus());
    return;
  }
  const keys = [isNameEmpty ? '"name"' : null, isDescriptionEmpty ? '"description"' : null].filter((key) => key !== null).join(", ");
  isWritingName.value = true;
  try {
    const answer = await invoke<{ text: string }>("coding_agent_ask", {
      prompt: t("newCustomScriptModal.writePrompt", { keys, description: describeForm() }),
    });
    const written = parseWrittenFields(answer.text);
    if (isNameEmpty && written.name !== undefined && name.value.trim() === "") {
      name.value = written.name;
    }
    if (isDescriptionEmpty && written.description !== undefined && description.value.trim() === "") {
      description.value = written.description;
    }
  } catch (error) {
    const text = String(error);
    toast(text === "no_coding_agent" ? t("newCustomScriptModal.noCodingAgent") : text);
  } finally {
    isWritingName.value = false;
  }
}

/** Reads the JSON object that the coding agent answered. A field that is missing or is not text stays undefined. */
function parseWrittenFields(text: string): { name?: string; description?: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(t("newCustomScriptModal.badAnswer"));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(t("newCustomScriptModal.badAnswer"));
  }
  const record = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Record<string, unknown>;
  const written: { name?: string; description?: string } = {};
  if (typeof record.name === "string" && record.name.trim() !== "") {
    written.name = record.name.trim().split("\n")[0].trim();
  }
  if (typeof record.description === "string" && record.description.trim() !== "") {
    written.description = record.description.trim();
  }
  return written;
}

async function create() {
  const workspaceId = state.selectedWorkspaceId;
  if (canCreate.value === false || workspaceId === null || workspaceId === undefined) {
    return;
  }
  const cwd = relativeFolder() ?? "";
  if (kind.value === "commandLine") {
    if (editedAction !== undefined) {
      await updateAction(workspaceId, editedAction.id, {
        label: name.value.trim(),
        command: command.value.trim(),
        ...(description.value.trim() !== "" ? { description: description.value.trim() } : {}),
        ...(cwd !== "" ? { cwd } : {}),
      });
    } else {
      await addAction(workspaceId, name.value, command.value, undefined, cwd, description.value);
    }
  } else {
    const agent = {
      name: agentName.value,
      prompt: prompt.value.trim(),
      ...(model.value.trim() !== "" ? { model: model.value.trim() } : {}),
      ...(effort.value !== "" ? { effort: effort.value } : {}),
    };
    if (editedAction !== undefined) {
      await updateAction(workspaceId, editedAction.id, {
        label: name.value.trim(),
        command: scriptAgentCommand(agent),
        agent,
        ...(description.value.trim() !== "" ? { description: description.value.trim() } : {}),
        ...(cwd !== "" ? { cwd } : {}),
      });
    } else {
      await addAction(workspaceId, name.value, scriptAgentCommand(agent), agent, cwd, description.value);
    }
  }
  closeNewCustomScriptModal();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeNewCustomScriptModal();
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => nameField.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeNewCustomScriptModal()">
    <form class="window-box" role="dialog" :aria-label="t(isEditing ? 'newCustomScriptModal.editDialogLabel' : 'newCustomScriptModal.dialogLabel')" @submit.prevent="create">
      <header>
        <h2>{{ t(isEditing ? "newCustomScriptModal.editTitle" : "newCustomScriptModal.title") }}</h2>
        <button type="button" :title="t('newCustomScriptModal.closeTitle')" class="close" :aria-label="t('newCustomScriptModal.closeLabel')" @click="closeNewCustomScriptModal()"><Icon name="x-lg" /></button>
      </header>

      <div class="content">
        <div>
          <div class="form-label">{{ t("newCustomScriptModal.kind") }}</div>
          <div class="btn-group d-flex" role="group" :aria-label="t('newCustomScriptModal.kind')">
            <label v-for="choice in KINDS" :key="choice.id" class="btn-check btn-outline theme-secondary choice justify-content-center">
              <input v-model="kind" type="radio" name="new-script-kind" autocomplete="off" :value="choice.id" />
              {{ t(choice.labelKey) }}
            </label>
          </div>
        </div>

        <div>
          <label class="form-label" for="new-script-name">{{ t("newCustomScriptModal.name") }}</label>
          <div class="d-flex gap-2">
            <input
              id="new-script-name"
              ref="nameField"
              v-model="name"
              class="form-control flex-fill"
              :placeholder="t('newCustomScriptModal.namePlaceholder')"
              spellcheck="false"
            />
            <button
              type="button"
              class="btn write-name"
              :aria-label="t('newCustomScriptModal.writeName')"
              :title="t('newCustomScriptModal.writeName')"
              :disabled="isWritingName"
              @click="writeName()"
            >
              <span v-if="isWritingName" class="spinner-border spinner-border-sm" role="status"></span>
              <Icon v-else name="stars" />
            </button>
          </div>
        </div>

        <div>
          <label class="form-label" for="new-script-description">{{ t("newCustomScriptModal.description") }}</label>
          <textarea
            id="new-script-description"
            v-model="description"
            class="form-control"
            rows="3"
            :placeholder="t('newCustomScriptModal.descriptionPlaceholder')"
          ></textarea>
        </div>

        <div>
          <label class="form-label" for="new-script-folder">{{ t("newCustomScriptModal.folder") }}</label>
          <div class="d-flex gap-2">
            <input
              id="new-script-folder"
              v-model="folder"
              class="form-control flex-fill"
              :class="{ 'is-invalid': isFolderValid === false }"
              :placeholder="t('newCustomScriptModal.folderPlaceholder')"
              spellcheck="false"
            />
            <button type="button" class="btn write-name" :aria-label="t('newCustomScriptModal.chooseFolder')" :title="t('newCustomScriptModal.chooseFolder')" @click="chooseFolder()">
              <Icon name="folder2-open" />
            </button>
          </div>
        </div>

        <div v-if="kind === 'commandLine'">
          <label class="form-label" for="new-script-command">{{ t("newCustomScriptModal.command") }}</label>
          <textarea
            id="new-script-command"
            v-model="command"
            class="form-control mono"
            rows="5"
            placeholder="make dev"
            spellcheck="false"
            @keydown.meta.enter.prevent="create"
            @keydown.ctrl.enter.prevent="create"
          ></textarea>
        </div>

        <template v-else>
          <div>
            <div class="form-label">{{ t("newCustomScriptModal.codingAgent") }}</div>
            <div class="btn-group d-flex" role="group" :aria-label="t('newCustomScriptModal.codingAgent')">
              <label v-for="choice in CUSTOM_SCRIPT_CODING_AGENTS" :key="choice.id" class="btn-check btn-outline theme-secondary choice justify-content-center">
                <input v-model="agentName" type="radio" name="new-script-agent" autocomplete="off" :value="choice.id" />
                <Icon :name="choice.icon" />
                {{ choice.label }}
              </label>
            </div>
          </div>
          <div class="d-flex gap-2">
            <div v-if="modelChoices.length > 0" class="field">
              <label class="form-label" for="new-script-model">{{ t("newCustomScriptModal.model") }}</label>
              <select id="new-script-model" v-model="model" class="form-control">
                <option value="">{{ t("newCustomScriptModal.modelDefault") }}</option>
                <option v-for="choice in modelChoices" :key="choice.id" :value="choice.id">{{ choice.label }}</option>
              </select>
            </div>
            <div v-if="effortChoices.length > 0" class="field">
              <label class="form-label" for="new-script-effort">{{ t("newCustomScriptModal.effort") }}</label>
              <select id="new-script-effort" v-model="effort" class="form-control">
                <option value="">{{ t("newCustomScriptModal.effortDefault") }}</option>
                <option v-for="level in effortChoices" :key="level" :value="level">{{ level }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="form-label" for="new-script-prompt">{{ t("newCustomScriptModal.prompt") }}</label>
            <textarea
              id="new-script-prompt"
              v-model="prompt"
              class="form-control"
              rows="5"
              :placeholder="t('newCustomScriptModal.promptPlaceholder')"
              @keydown.meta.enter.prevent="create"
              @keydown.ctrl.enter.prevent="create"
            ></textarea>
          </div>
        </template>

        <div class="buttons">
          <button :title="t(isEditing ? 'newCustomScriptModal.cancelEditTitle' : 'newCustomScriptModal.cancelTitle')" class="btn" type="button" @click="closeNewCustomScriptModal()">{{ t("newCustomScriptModal.cancel") }}</button>
          <button :title="t(isEditing ? 'newCustomScriptModal.saveTitle' : 'newCustomScriptModal.createTitle')" class="btn primary" type="submit" :disabled="canCreate === false">{{ t(isEditing ? "newCustomScriptModal.save" : "newCustomScriptModal.create") }}</button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button:not(.btn)) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 57; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 32px; }
.window-box {
  width: min(520px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
h2 { flex: 1; margin: 0; font-size: var(--font-size); font-weight: 600; }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: calc(var(--font-size) * 1.5); }
.close:hover { background: var(--hover); color: var(--text); }
.content { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.form-label { margin-bottom: 4px; font-size: calc(var(--font-size) * 0.9); color: var(--muted); }
textarea.mono { font-family: var(--mono); }
.choice { flex: 1 1 0; min-width: 0; }
.write-name { height: auto; }
.field { flex: 1 1 0; min-width: 0; }
.field .form-control { width: 100%; }
.buttons { display: flex; justify-content: flex-end; gap: 6px; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn-group i { margin-right: 4px; }
</style>
