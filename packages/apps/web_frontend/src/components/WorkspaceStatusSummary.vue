<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { askConfirm } from "../stores/confirm";
import { currentGit, workspaceCwd } from "../stores/git";
import {
  allPanes,
  closeWorkspace,
  finishRename,
  moveWorkspaceInView,
  newWorkspace,
  otherWorkspaceStatus,
  selectWorkspace,
  startRename,
  state,
  workspaceLabel,
  orderedWorkspaces as workspaces,
} from "../stores/session";
import { useReorder } from "../lib/reorder";
import { useStatusCard } from "../lib/status_card";
import type { WorkspaceInfo } from "../lib/types";
import { t } from "../i18n/index";

// The workspace selector, at the left end of the status bar: the status dot and the name of the selected workspace.
// A click on it shows a Bootstrap popover with the details of the selected workspace, the list of workspaces, and the entry
// "New workspace…". A click on a workspace of the list selects it.
const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, close, onFocusOut } = useStatusCard(root);

const workspaceReorder = useReorder("y", (id, at) => moveWorkspaceInView(id, at));

/** The selected workspace, or null when Herdr has no workspace. */
const selectedWorkspace = computed(
  () => workspaces.value.find((workspace) => workspace.workspace_id === state.selectedWorkspaceId) ?? null,
);

/** The name in the status bar: the selected workspace. */
const selectedLabel = computed(() =>
  state.selectedWorkspaceId === null ? t("workspaceStatusSummary.none") : workspaceLabel(state.selectedWorkspaceId),
);

/** True while the name of the selected workspace is in a text field, in the place of the name. */
const isRenaming = computed(
  () => state.selectedWorkspaceId !== null && state.renaming === `ws:${state.selectedWorkspaceId}`,
);

/**
 * Tells if an agent runs in a workspace.
 *
 * @param workspaceId - The identifier of the workspace.
 * @returns True when a pane of the workspace runs an agent.
 */
function hasAgent(workspaceId: string): boolean {
  return allPanes.value.some((pane) => pane.workspace_id === workspaceId && pane.agent);
}

/**
 * Gives the classes of the status dot of a workspace: the color of its agents, or a hollow ring when no agent runs.
 *
 * @param workspace - The workspace.
 * @returns The classes to add to the element with the class `dot`.
 */
function dotClassesOf(workspace: WorkspaceInfo): string[] {
  if (hasAgent(workspace.workspace_id) === false) {
    return ["quiet"];
  }
  return [workspace.agent_status === "idle" ? "" : workspace.agent_status];
}

/**
 * The classes of the status dot in the status bar. The status of the agents of another workspace comes first, because the
 * developer does not see them. Without such an agent, the dot shows the status of the selected workspace.
 */
const dotClasses = computed(() => {
  if (otherWorkspaceStatus.value !== null) {
    return ["calling", otherWorkspaceStatus.value];
  }
  if (selectedWorkspace.value === null) {
    return ["quiet"];
  }
  return dotClassesOf(selectedWorkspace.value);
});

/** The text of the status dot for a screen reader, only when an agent of another workspace calls. */
const dotLabel = computed(() => {
  if (otherWorkspaceStatus.value === null) {
    return undefined;
  }
  return otherWorkspaceStatus.value === "blocked"
    ? t("workspaceStatusSummary.otherBlocked")
    : t("workspaceStatusSummary.otherDone");
});

/** The rows of the details of the selected workspace, in the card. */
const detailRows = computed(() => {
  const workspace = selectedWorkspace.value;
  if (workspace === null) {
    return [];
  }
  const agentCount = allPanes.value.filter((pane) => pane.workspace_id === workspace.workspace_id && pane.agent).length;
  return [
    {
      field: "folder",
      name: t("workspaceStatusSummary.folder"),
      value: workspaceCwd(workspace.workspace_id) ?? t("workspaceStatusSummary.noFolder"),
    },
    {
      field: "branch",
      name: t("workspaceStatusSummary.branch"),
      value: currentGit.value?.branch ?? t("workspaceStatusSummary.noBranch"),
    },
    { field: "tabs", name: t("workspaceStatusSummary.tabs"), value: workspace.tab_count },
    { field: "agents", name: t("workspaceStatusSummary.agents"), value: agentCount },
  ];
});

/**
 * Selects a workspace and closes the card.
 *
 * @param workspaceId - The identifier of the workspace.
 */
function choose(workspaceId: string): void {
  close();
  selectWorkspace(workspaceId);
}

/**
 * Starts the rename of a workspace, with a text field in the status bar, and closes the card.
 *
 * @param workspaceId - The identifier of the workspace.
 */
function renameFromList(workspaceId: string): void {
  close();
  startRename("ws", workspaceId);
}

/**
 * Asks for a confirmation, then closes a workspace. The question lives in the status bar section and not in the card, because
 * the card closes when the keyboard focus goes to the confirmation dialog.
 *
 * @param workspace - The workspace to close.
 */
async function askClose(workspace: WorkspaceInfo): Promise<void> {
  const isConfirmed = await askConfirm(
    t("workspaceStatusSummary.close", { name: workspace.label }),
    t("workspaceStatusSummary.closeConfirm"),
  );
  if (isConfirmed === true) {
    await closeWorkspace(workspace.workspace_id);
  }
}

/** Asks for the folder of a new workspace, then creates the workspace with the name of the folder. */
async function createWorkspace(): Promise<void> {
  close();
  const path = await openDialog({
    directory: true,
    multiple: false,
    title: t("workspaceStatusSummary.chooseFolder"),
    defaultPath: await homeDir(),
  });
  if (path === null) {
    return;
  }
  const label = path.split("/").filter(Boolean).pop() ?? null;
  await newWorkspace(path, label);
}

// The command search renames the workspace too: the field replaces the name, so the card must not stay open.
watch(isRenaming, (renaming) => {
  if (renaming === true) {
    close();
  }
});
</script>

<template>
  <div
    ref="root"
    class="workspace-status"
    tabindex="0"
    @click="toggle"
    @keydown.enter.self.prevent="toggle"
    @keydown.space.self.prevent="toggle"
    @focusout="onFocusOut"
  >
    <InlineRename
      v-if="isRenaming"
      class="workspace-rename"
      :value="selectedLabel"
      :label="t('workspaceStatusSummary.newName')"
      @save="(value) => finishRename('ws', state.selectedWorkspaceId!, value)"
      @cancel="state.renaming = null"
    />
    <template v-else>
      <span class="dot" :class="dotClasses" :role="dotLabel === undefined ? undefined : 'img'" :aria-label="dotLabel"></span>
      <span class="name">{{ selectedLabel }}</span>
    </template>
    <div
      v-if="isOpen"
      class="popover popover-instant show bs-popover-top position-absolute bottom-100"
      role="dialog"
      :aria-label="t('workspaceStatusSummary.listLabel')"
      @click.stop
    >
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-2 overflow-y-auto" :style="{ maxHeight: '70vh', minWidth: '260px' }">
        <div v-if="detailRows.length > 0" class="d-flex flex-column gap-2" data-field="details">
          <div v-for="row in detailRows" :key="row.field" class="d-flex justify-content-between gap-3">
            <span class="text-body-secondary">{{ row.name }}</span>
            <span class="text-end text-break" :data-field="row.field">{{ row.value }}</span>
          </div>
        </div>
        <div
          class="d-flex flex-column"
          :class="{ 'border-top pt-2': detailRows.length > 0 }"
          role="group"
          :aria-label="t('workspaceStatusSummary.listLabel')"
        >
          <div
            v-for="(workspace, workspaceIndex) in workspaces"
            :key="workspace.workspace_id"
            class="workspace-row d-flex align-items-center position-relative"
            :class="{
              active: workspace.workspace_id === state.selectedWorkspaceId,
              quiet: !hasAgent(workspace.workspace_id),
              dragging: workspaceReorder.dragging.value === workspace.workspace_id,
              'drop-before': workspaceReorder.gap.value === workspaceIndex,
              'drop-after': workspaceReorder.gap.value === workspaceIndex + 1 && workspaceIndex === workspaces.length - 1,
            }"
            :data-reorder-id="workspace.workspace_id"
            @pointerdown="workspaceReorder.onPointerDown($event, workspaces.map((other) => other.workspace_id))"
          >
            <button
              type="button"
              class="btn border-0 d-flex align-items-center gap-2 h-auto text-start workspace-main"
              :aria-current="workspace.workspace_id === state.selectedWorkspaceId"
              :title="t('workspaceStatusSummary.rowTitle')"
              @click="choose(workspace.workspace_id)"
            >
              <span class="dot" :class="dotClassesOf(workspace)"></span>
              <span
                class="name"
                :class="{
                  'text-body-secondary': !hasAgent(workspace.workspace_id) && workspace.workspace_id !== state.selectedWorkspaceId,
                }"
              >{{ workspace.label }}</span>
            </button>
            <span class="row-actions">
              <button
                type="button"
                class="row-button"
                :aria-label="t('workspaceStatusSummary.rename', { name: workspace.label })"
                :title="t('workspaceStatusSummary.rename', { name: workspace.label })"
                @click.stop="renameFromList(workspace.workspace_id)"
              ><Icon name="pencil" /></button>
              <button
                type="button"
                class="row-button"
                :aria-label="t('workspaceStatusSummary.close', { name: workspace.label })"
                :title="t('workspaceStatusSummary.close', { name: workspace.label })"
                @click.stop="askClose(workspace)"
              ><Icon name="x-lg" /></button>
            </span>
          </div>
        </div>
        <div v-if="workspaces.length > 0" class="border-top" role="separator"></div>
        <button
          type="button"
          class="btn border-0 d-flex align-items-center gap-2 h-auto text-start"
          :title="t('workspaceStatusSummary.newTitle')"
          @click="createWorkspace"
        >
          <Icon name="plus-lg" /> {{ t("workspaceStatusSummary.new") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workspace-status {
  align-self: stretch; margin: 0 -11px; padding: 0 11px; max-width: 260px;
  display: flex; align-items: center; gap: 8px; color: var(--text-2); font-weight: 600;
  cursor: pointer; outline-offset: 3px;
}
.workspace-rename { width: 180px; height: 26px; }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row { min-height: 32px; border-radius: 6px; }
.workspace-main { flex: 1; min-width: 0; align-self: stretch; background: transparent; }
.workspace-row:hover, .workspace-row:focus-within { background: var(--hover-soft); }
.workspace-row.active { background: var(--hover); }
.row-actions { display: none; align-items: center; flex-shrink: 0; gap: 2px; padding-right: 6px; }
.workspace-row:hover .row-actions, .workspace-row:focus-within .row-actions { display: flex; }
.row-button {
  display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0; border: none;
  border-radius: 6px; background: transparent; color: var(--muted); font-size: var(--font-size); line-height: 1;
}
.row-button:hover { background: var(--hover); color: var(--text); }
.workspace-row.dragging { opacity: 0.4; }
.workspace-row.drop-before::before, .workspace-row.drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.workspace-row.drop-before::before { top: -1px; }
.workspace-row.drop-after::after { bottom: -1px; }
</style>
