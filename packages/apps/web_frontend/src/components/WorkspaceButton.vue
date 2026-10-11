<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
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
  sidebarWorkspaces as workspaces,
} from "../stores/session";
import { useReorder } from "../lib/reorder";
import { t } from "../i18n/index";

const isOpen = ref(false);
const button = ref<HTMLButtonElement>();
const menu = ref<HTMLElement>();
const position = ref({ top: 0, left: 0 });

const workspaceReorder = useReorder("y", (id, at) => moveWorkspaceInView(id, at));

/** The name on the button: the selected workspace. */
const selectedLabel = computed(() =>
  state.selectedWorkspaceId === null ? t("workspaceButton.none") : workspaceLabel(state.selectedWorkspaceId),
);

/** True while the name of the selected workspace is in a text field, in the place of the button. */
const isRenaming = computed(() => state.selectedWorkspaceId !== null && state.renaming === `ws:${state.selectedWorkspaceId}`);

/** True when an agent runs in the workspace. */
function hasAgent(workspaceId: string): boolean {
  return allPanes.value.some((pane) => pane.workspace_id === workspaceId && pane.agent);
}

/** Index of the first workspace without an agent, where the divider goes. */
const firstQuiet = computed(() => workspaces.value.findIndex((workspace) => !hasAgent(workspace.workspace_id)));

// The list is placed with the viewport, so the tab bar around the button cannot cut it.
function toggle() {
  if (isOpen.value) {
    close();
    return;
  }
  const rect = button.value!.getBoundingClientRect();
  position.value = { top: rect.bottom + 6, left: Math.max(8, rect.left) };
  isOpen.value = true;
  nextTick(() => {
    document.addEventListener("mousedown", onDocumentMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

function close() {
  isOpen.value = false;
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
  document.removeEventListener("keydown", onKeyDown, true);
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as Node;
  if (menu.value?.contains(target) === true || button.value?.contains(target) === true) {
    return;
  }
  close();
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.stopPropagation();
    close();
    button.value?.focus();
  }
}

function choose(workspaceId: string) {
  close();
  selectWorkspace(workspaceId);
}

function renameFromList(workspaceId: string) {
  close();
  startRename("ws", workspaceId);
}

async function createWorkspace() {
  close();
  const path = await openDialog({
    directory: true,
    multiple: false,
    title: t("workspaceButton.chooseFolder"),
    defaultPath: await homeDir(),
  });
  if (path === null) {
    return;
  }
  const label = path.split("/").filter(Boolean).pop() ?? null;
  await newWorkspace(path, label);
}

// The command search renames the workspace too: the field replaces the button, so the list must not stay open.
watch(isRenaming, (renaming) => {
  if (renaming) {
    close();
  }
});

onBeforeUnmount(close);
</script>

<template>
  <div class="workspace-button">
    <div v-if="isRenaming" class="d-flex align-items-center">
      <InlineRename
        class="workspace-rename"
        :value="selectedLabel"
        :label="t('workspaceButton.newName')"
        @save="(value) => finishRename('ws', state.selectedWorkspaceId!, value)"
        @cancel="state.renaming = null"
      />
    </div>
    <button
      v-else
      ref="button"
      class="btn border-0 d-flex align-items-center gap-2 workspace"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      :aria-label="t('workspaceButton.label', { name: selectedLabel })"
      :title="t('workspaceButton.title')"
      @click="toggle"
      @dblclick="state.selectedWorkspaceId !== null && startRename('ws', state.selectedWorkspaceId)"
    >
      <span class="name">{{ selectedLabel }}</span>
      <Icon name="chevron-down" class="chevron" />
      <span
        v-if="otherWorkspaceStatus !== null"
        class="dot calling"
        :class="otherWorkspaceStatus"
        role="img"
        :aria-label="otherWorkspaceStatus === 'blocked' ? t('workspaceButton.otherBlocked') : t('workspaceButton.otherDone')"
        :title="otherWorkspaceStatus === 'blocked' ? t('workspaceButton.otherBlocked') : t('workspaceButton.otherDone')"
      ></span>
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menu"
        class="dropdown-menu show position-fixed overflow-y-auto workspace-menu"
        role="menu"
        :aria-label="t('workspaceButton.listLabel')"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        @mousedown.stop
      >
        <template v-for="(workspace, workspaceIndex) in workspaces" :key="workspace.workspace_id">
          <div
            v-if="workspaceIndex === firstQuiet && workspaceIndex > 0"
            class="dropdown-divider"
            role="separator"
            :aria-label="t('workspaceButton.withoutAgent')"
          ></div>
          <div
            class="dropdown-item d-flex align-items-center workspace-row"
            :class="{
              active: workspace.workspace_id === state.selectedWorkspaceId,
              quiet: !hasAgent(workspace.workspace_id),
              dragging: workspaceReorder.dragging.value === workspace.workspace_id,
              'drop-before': workspaceReorder.gap.value === workspaceIndex,
              'drop-after': workspaceReorder.gap.value === workspaceIndex + 1 && workspaceIndex === workspaces.length - 1,
            }"
            role="presentation"
            draggable="true"
            @dragstart="workspaceReorder.onDragStart($event, workspace.workspace_id)"
            @dragover="workspaceReorder.onDragOver($event, workspaceIndex)"
            @drop="workspaceReorder.onDrop($event, workspaces.map((other) => other.workspace_id))"
            @dragend="workspaceReorder.onDragEnd()"
          >
            <button
              class="d-flex align-items-center gap-2 workspace-main"
              role="menuitem"
              :aria-current="workspace.workspace_id === state.selectedWorkspaceId"
              :title="t('workspaceButton.rowTitle')"
              @click="choose(workspace.workspace_id)"
            >
              <span class="dot" :class="workspace.agent_status === 'idle' ? '' : workspace.agent_status"></span>
              <span class="name">{{ workspace.label }}</span>
            </button>
            <span class="row-actions">
              <button
                class="row-button"
                :aria-label="t('workspaceButton.rename', { name: workspace.label })"
                :title="t('workspaceButton.rename', { name: workspace.label })"
                @mousedown.stop
                @click.stop="renameFromList(workspace.workspace_id)"
              ><Icon name="pencil" /></button>
              <ConfirmButton
                icon="x-lg"
                :confirm-label="t('workspaceButton.closeConfirm')"
                :question="t('workspaceButton.close', { name: workspace.label })"
                @confirm="closeWorkspace(workspace.workspace_id)"
              />
            </span>
          </div>
        </template>
        <div v-if="workspaces.length > 0" class="dropdown-divider" role="separator"></div>
        <button
          type="button"
          class="dropdown-item d-flex align-items-center gap-2"
          role="menuitem"
          :title="t('workspaceButton.newTitle')"
          @click="createWorkspace"
        >
          <Icon name="plus-lg" /> {{ t("workspaceButton.new") }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.workspace-button { position: relative; flex-shrink: 0; margin-bottom: 4px; }
/* The look of the buttons of the application: only the mouse hover changes the colors. */
.workspace {
  --bs-btn-padding-x: 8px;
  --bs-btn-padding-y: 0;
  --bs-btn-font-size: var(--font-size);
  --bs-btn-font-weight: 600;
  --bs-btn-border-radius: 6px;
  --bs-btn-color: var(--text-2);
  --bs-btn-hover-color: var(--text);
  --bs-btn-hover-bg: rgba(var(--wash), 0.08);
  --bs-btn-active-color: var(--text);
  --bs-btn-active-bg: rgba(var(--wash), 0.08);
  --bs-btn-disabled-color: var(--text);
  --bs-btn-disabled-bg: rgba(var(--wash), 0.08);
  --bs-btn-focus-box-shadow: none;
  position: relative; height: 28px; max-width: 220px; line-height: 1;
}
.workspace:not(:hover):not([aria-expanded="true"]) {
  --bs-btn-hover-color: var(--text-2);
  --bs-btn-hover-bg: transparent;
  --bs-btn-active-color: var(--text-2);
  --bs-btn-active-bg: transparent;
  --bs-btn-disabled-color: var(--text-2);
  --bs-btn-disabled-bg: transparent;
}
.workspace[aria-expanded="true"] { background: rgba(var(--wash), 0.08); color: var(--text); }
.workspace .name, .workspace-main .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chevron { flex-shrink: 0; font-size: calc(var(--font-size) * 0.85); color: var(--muted); }
/* The dot sits on the corner of the button, like the badge of a notification. */
.calling { position: absolute; top: 2px; right: 2px; box-shadow: 0 0 0 2px var(--shell); }
.workspace-rename { width: 180px; height: 26px; }
.workspace-menu {
  --bs-dropdown-min-width: 260px;
  --bs-dropdown-link-hover-bg: var(--hover-soft);
  --bs-dropdown-link-active-bg: var(--hover);
  --bs-dropdown-link-active-color: var(--text);
  max-height: 70vh;
}
.workspace-row { position: relative; padding: 0; }
.workspace-main {
  flex: 1; min-width: 0; padding: var(--bs-dropdown-item-padding-y) var(--bs-dropdown-item-padding-x); border: none; background: transparent;
  color: inherit; font: inherit; text-align: left;
}
.workspace-main .name { flex: 1; }
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
/* Workspaces with an agent session against plain shells or nothing running. */
.workspace-row.quiet:not(.active) .name { color: var(--muted); }
.workspace-row.quiet .dot { background: transparent; box-shadow: inset 0 0 0 1.5px var(--faint); }
</style>
