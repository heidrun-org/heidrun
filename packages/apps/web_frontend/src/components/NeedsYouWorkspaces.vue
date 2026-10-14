<script setup lang="ts">
import {
  moveWorkspace,
  selectWorkspace,
  state,
  workspaceDotClasses,
  workspaceHasAgent,
  workspaces,
} from "../stores/session";
import { git } from "../stores/git";
import { useReorder } from "../lib/reorder";
import { t } from "../i18n/index";

// The list of workspaces at the bottom of the Needs you sidebar section: a separator line, the title "Workspaces", and one row
// for each workspace, with its status dot and its name. The rows have the order of the list in the information card of the
// workspace status bar section, and the same drag and drop. A click on a row selects the workspace. The Git branch of the
// workspace sits at the right end of the row. The list touches the left, the right, and the bottom border of the sidebar
// section, and the highlight of a row has no rounded corner. The title and the status dot are 14 pixels from the left border,
// like the first character of the message of `ToHandlePanel.vue` (6 pixels of padding of the cards, 8 pixels of the message).
const workspaceReorder = useReorder("y", (id, at) => moveWorkspace(id, at));

/**
 * Gives the current Git branch of a workspace.
 *
 * @param workspaceId - The identifier of the workspace.
 * @returns The name of the branch, or null when the workspace has no Git repository or Herdr has not read it yet.
 */
function branchOf(workspaceId: string): string | null {
  return git.status[workspaceId]?.branch ?? null;
}
</script>

<template>
  <div v-if="workspaces.length > 0" class="needs-you-workspaces border-top">
    <div class="title text-body-secondary">{{ t("needsYouWorkspaces.title") }}</div>
    <div class="d-flex flex-column" role="group" :aria-label="t('needsYouWorkspaces.listLabel')">
      <div
        v-for="(workspace, workspaceIndex) in workspaces"
        :key="workspace.workspace_id"
        class="workspace-row d-flex align-items-center position-relative"
        :class="{
          active: workspace.workspace_id === state.selectedWorkspaceId,
          quiet: !workspaceHasAgent(workspace.workspace_id),
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
          :title="t('needsYouWorkspaces.rowTitle')"
          @click="selectWorkspace(workspace.workspace_id)"
        >
          <span class="dot" :class="workspaceDotClasses(workspace)"></span>
          <span
            class="name"
            :class="{
              'text-body-secondary': !workspaceHasAgent(workspace.workspace_id) && workspace.workspace_id !== state.selectedWorkspaceId,
            }"
          >{{ workspace.label }}</span>
          <span
            v-if="branchOf(workspace.workspace_id) !== null"
            class="branch text-body-secondary"
            :title="branchOf(workspace.workspace_id) ?? undefined"
          >{{ branchOf(workspace.workspace_id) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.needs-you-workspaces { flex-shrink: 0; max-height: 40%; overflow-y: auto; padding: 12px 0 0; }
.title { padding: 0 14px 8px; font-size: var(--font-size); font-weight: 600; }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.branch { flex: 0 1 auto; min-width: 0; max-width: 50%; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-row { min-height: 40px; border-radius: 0; }
.workspace-main { flex: 1; min-width: 0; align-self: stretch; padding-left: 14px; border-radius: 0; background: transparent; }
.workspace-row:hover, .workspace-row:focus-within { background: var(--hover-soft); }
.workspace-row.active { background: var(--hover); }
.workspace-row.dragging { opacity: 0.4; }
.workspace-row.drop-before::before, .workspace-row.drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.workspace-row.drop-before::before { top: -1px; }
.workspace-row.drop-after::after { bottom: -1px; }
</style>
