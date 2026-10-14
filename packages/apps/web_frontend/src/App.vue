<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TopBar from "./components/TopBar.vue";
import Sidebar from "./components/Sidebar.vue";
import PaneGrid from "./components/PaneGrid.vue";
import TabBar from "./components/TabBar.vue";
import MacroEditor from "./components/MacroEditor.vue";
import { macroEditor } from "./stores/macros";
import RightPanel from "./components/RightPanel.vue";
import NoteModal from "./components/NoteModal.vue";
import Resizer from "./components/Resizer.vue";
import RcModal from "./components/RcModal.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import DangerModal from "./components/DangerModal.vue";
import GitModal from "./components/GitModal.vue";
import { git, merging } from "./stores/git";
import MergeModal from "./components/MergeModal.vue";
import IssueModal from "./components/IssueModal.vue";
import { issueView } from "./stores/issues";
import NewAgentModal from "./components/NewAgentModal.vue";
import { newAgent } from "./stores/agents";
import SearchModal from "./components/SearchModal.vue";
import ColumnOfPinnedPanes from "./components/ColumnOfPinnedPanes.vue";
import ShortcutsModal from "./components/ShortcutsModal.vue";
import MosaicModal from "./components/MosaicModal.vue";
import { mosaic } from "./stores/mosaic";
import { activePaneId, allPinnedPanes } from "./stores/pinned_panes";
import { goBackInPaneFocusHistory, goForwardInPaneFocusHistory } from "./stores/pane_focus_history";
import { search } from "./stores/search";
import { COLLAPSED_SIDEBAR_WIDTH, openSidebarSection } from "./stores/sidebar_sections";
import { answerConfirm, confirmDialog } from "./stores/confirm";
import { answerDanger, danger } from "./stores/guards";
import StatusBar from "./components/StatusBar.vue";
import CommandPalette from "./components/CommandPalette.vue";
import Offline from "./components/Offline.vue";
import {
  allPanes,
  closePane,
  cycleTab,
  cycleWorkspace,
  selectWorkspaceAt,
  selectedPane,
  shiftTab,
  shiftWorkspace,
  splitPane,
  start,
  state,
  toast,
} from "./stores/session";
import { startDefaultNewTab } from "./stores/newPane";
import { resetZoom, settings, settingsModal, zoom, zoomFactor } from "./stores/settings";
import { agentsInformationModal } from "./stores/agentsInformation";
import { newCustomLauncherModal } from "./stores/newCustomLauncher";
import { savedSearchModal } from "./stores/saved_search_modal";
import { findNewSkillsModal, installedSkillModal, skills } from "./stores/skills";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ImageDrop } from "./lib/image_drop";
import Icon from "./components/Icon.vue";
import { notes, pinText, selectionReaders } from "./stores/notes";
import { startProjects } from "./stores/project";
import { startGit } from "./stores/git";
import { startAlerts } from "./stores/alerts";
import { startStatusItem } from "./stores/statusItem";
// Records Claude spend by workspace from the start, right sidebar open or not.
import "./stores/spend";
import { history, loadHistory } from "./stores/history";
import AgentsInformationModal from "./components/AgentsInformationModal.vue";
import NewCustomLauncherModal from "./components/NewCustomLauncherModal.vue";
import SavedSearchModal from "./components/SavedSearchModal.vue";
import ImportLaunchersModal from "./components/ImportLaunchersModal.vue";
import { importLaunchersModal } from "./stores/importLaunchers";
import HistoryModal from "./components/HistoryModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import SkillFileModal from "./components/SkillFileModal.vue";
import InstalledSkillModal from "./components/InstalledSkillModal.vue";
import FindNewSkillsModal from "./components/FindNewSkillsModal.vue";
import FilesModal from "./components/FilesModal.vue";
import AboutModal from "./components/AboutModal.vue";
import ThreeJsDemoModal from "./components/ThreeJsDemoModal.vue";
import { threeJsDemoModal } from "./stores/three_js_demo_modal";
import SplashScreen from "./components/SplashScreen.vue";
import { files, openFiles } from "./stores/files";
import { startMobile } from "./stores/mobile";
import { loadClaudeLink, remote, startRemoteWatch } from "./stores/claude";
import { t } from "./i18n/index";
import { ResizerWidth } from "./lib/resizer_width";
import type { PaneOuterEdge } from "./lib/pane_separators";

// The column of pinned panes never squeezes the panes of the selected tab below 420 px, whatever the window size.
const winW = ref(window.innerWidth);
const onResize = () => (winW.value = window.innerWidth);
// A sidebar collapsed to the sidebar icon bar takes the width of the sidebar icon bar.
const leftTakenWidth = computed(() => (settings.leftCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.leftWidth));
const rightTakenWidth = computed(() => (settings.rightCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.rightWidth));
const sides = computed(() => leftTakenWidth.value + (state.snapshot ? rightTakenWidth.value : 0));
const columnOfPinnedPanesShownWidth = computed(() => Math.max(240, Math.min(settings.columnOfPinnedPanesWidth, winW.value - sides.value - 420)));
const columnOfPinnedPanesTakenWidth = computed(() => (allPinnedPanes.value.length ? columnOfPinnedPanesShownWidth.value : 0));

// The three columns that the user drags, and the width that the other columns take away from each of them.
const LEFT_COLUMN = { min: 200, defaultWidth: 280 };
const RIGHT_COLUMN = { min: 260, defaultWidth: 320 };
const COLUMN_OF_PINNED_PANES = { min: 320, max: 1400, defaultWidth: 560 };
const leftReserve = computed(() => rightTakenWidth.value + columnOfPinnedPanesTakenWidth.value);
const rightReserve = computed(() => leftTakenWidth.value + columnOfPinnedPanesTakenWidth.value);
const columnOfPinnedPanesReserve = computed(() => leftTakenWidth.value + rightTakenWidth.value);

// The sides of the panes that have a column against them: the drag handle of that column ends at the panes there.
// A sidebar collapsed to the sidebar icon bar has a fixed width: nobody drags it.
const paneOuterEdges = computed(() => ({
  left: settings.leftCollapsed === false,
  right: allPinnedPanes.value.length > 0 || (state.snapshot !== null && settings.rightCollapsed === false),
}));

// The column that a corner of the panes under the pointer touches: its line is drawn in colour.
const highlightedEdge = ref<PaneOuterEdge | null>(null);

/** The column that sits against one side of the panes, with the way its width follows the pointer. */
function columnAgainst(edge: PaneOuterEdge) {
  if (edge === "left") {
    return { ...LEFT_COLUMN, reserve: leftReserve.value, width: settings.leftWidth, sign: 1, set: (w: number) => (settings.leftWidth = w) };
  }
  if (allPinnedPanes.value.length > 0) {
    return { ...COLUMN_OF_PINNED_PANES, reserve: columnOfPinnedPanesReserve.value, width: columnOfPinnedPanesShownWidth.value, sign: -1, set: (w: number) => (settings.columnOfPinnedPanesWidth = w) };
  }
  return { ...RIGHT_COLUMN, reserve: rightReserve.value, width: settings.rightWidth, sign: -1, set: (w: number) => (settings.rightWidth = w) };
}

// A corner of the panes that touches a column also moves that column, from the width it had when the drag began.
let cornerColumn: { edge: PaneOuterEdge; width: number } | null = null;

function onCornerStart(edge: PaneOuterEdge) {
  cornerColumn = { edge, width: columnAgainst(edge).width };
}

function onCornerMove(edge: PaneOuterEdge, dx: number) {
  if (cornerColumn === null || cornerColumn.edge !== edge) {
    return;
  }
  const column = columnAgainst(edge);
  column.set(ResizerWidth.clamp(cornerColumn.width + column.sign * dx, column, window.innerWidth));
}

let armedClose: string | null = null;
let armedAt = 0;

// Capture phase: our shortcuts win over xterm, which otherwise swallows the keys.
// e.code is used because ⌥ changes e.key on macOS (⌥B gives "∫").
function onKey(e: KeyboardEvent) {
  if (confirmDialog.open) {
    // The confirmation dialog owns the keyboard: Esc cancels, nothing else runs behind it.
    if (e.key === "Escape") {
      e.preventDefault();
      // Not the Settings window below the dialog, which also listens to Escape.
      e.stopImmediatePropagation();
      answerConfirm(false);
    } else if (e.metaKey) {
      e.preventDefault();
    }
    return;
  }
  if (danger.open) {
    // The confirmation window owns the keyboard: Esc cancels, nothing else runs behind it.
    if (e.key === "Escape") {
      e.preventDefault();
      answerDanger(false);
    } else if (e.metaKey) e.preventDefault();
    return;
  }
  if (!e.metaKey || e.ctrlKey) return;
  // The file explorer (and its editor: ⌘D, ⌘F…) owns the keyboard; only the zoom passes.
  if (files.open && !/^(Equal|Minus|NumpadAdd|NumpadSubtract|Digit0|Numpad0)$/.test(e.code)) return;
  const run = (fn: () => unknown) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  // ⌥⌘ + arrows: ←/→ tabs, ↑/↓ workspaces.
  // ⇧⌥⌘ + arrows: move the selected tab / workspace.
  if (e.altKey && e.shiftKey) {
    if (e.code === "ArrowLeft") return run(() => shiftTab(-1));
    if (e.code === "ArrowRight") return run(() => shiftTab(1));
    if (e.code === "ArrowUp") return run(() => shiftWorkspace(-1));
    if (e.code === "ArrowDown") return run(() => shiftWorkspace(1));
  }
  if (e.altKey) {
    if (e.code === "ArrowLeft") return run(() => cycleTab(-1));
    if (e.code === "ArrowRight") return run(() => cycleTab(1));
    if (e.code === "ArrowUp") return run(() => cycleWorkspace(-1));
    if (e.code === "ArrowDown") return run(() => cycleWorkspace(1));
  }
  // ⌘/ — and ⌘: on a French keyboard, where "/" needs ⇧. By e.key: the physical
  // "Slash" key is "=" on AZERTY (⌘= zooms).
  if (["/", "?", ":"].includes(e.key)) return run(() => (state.shortcutsOpen = !state.shortcutsOpen));
  // ⌘1 … ⌘9: workspace by position.
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && !e.altKey && !e.shiftKey) return run(() => selectWorkspaceAt(Number(digit[1]) - 1));
  // ⌘[ / ⌘]: back / forward through the panes that had the focus, as in Chrome. By e.key: on a French keyboard,
  // "[" and "]" need ⇧⌥, and the physical key of "[" is another character.
  if (e.key === "[") {
    return run(() => goBackInPaneFocusHistory());
  }
  if (e.key === "]") {
    return run(() => goForwardInPaneFocusHistory());
  }

  switch (e.code) {
    case "KeyP":
      // ⌘P: find a file of the selected pane's project (the explorer handles it once open).
      if (!e.shiftKey) {
        if (files.open) return;
        return run(() => openFiles(selectedPane.value?.foreground_cwd || selectedPane.value?.cwd, { search: true }));
      }
      return run(() => {
        const id = activePaneId();
        const pane = allPanes.value.find((p) => p.pane_id === id) ?? selectedPane.value;
        const text = pane ? selectionReaders.get(pane.pane_id)?.() : "";
        if (pane && text) {
          pinText(text, pane);
          openSidebarSection("notes");
        } else toast(t("app.selectTextFirst"));
      });
    case "KeyF":
      if (!e.shiftKey) return;
      return run(() => (search.open = !search.open));
    case "KeyH":
      if (!e.shiftKey) return;
      return run(() => (history.open = !history.open));
    case "KeyK":
      return run(() => (state.paletteOpen = !state.paletteOpen));
    case "KeyT":
      return run(() => (e.shiftKey ? (newAgent.open = true) : startDefaultNewTab()));
    case "KeyD":
      return run(() => splitPane(e.shiftKey ? "down" : "right"));
    case "KeyW":
      // The file explorer uses ⌘W for its own tabs.
      if (files.open) return;
      // Closing ends the process in the pane: ask for a second ⌘W within 2 s.
      return run(() => {
        const id = activePaneId();
        if (!id) return;
        if (armedClose === id && Date.now() - armedAt < 2000) {
          armedClose = null;
          closePane(id);
        } else {
          armedClose = id;
          armedAt = Date.now();
          toast(t("app.pressAgainToClose"));
        }
      });
    case "KeyB":
      return run(() => {
        if (e.altKey) settings.rightCollapsed = !settings.rightCollapsed;
        else settings.leftCollapsed = !settings.leftCollapsed;
      });
    // ⌘+ / ⌘− / ⌘0 zoom the whole window, whatever window is open.
    case "Equal":
    case "NumpadAdd":
      return run(() => zoom(0.5));
    case "Minus":
    case "NumpadSubtract":
      return run(() => zoom(-0.5));
    case "Digit0":
    case "Numpad0":
      return run(() => resetZoom());
  }
}

let unlistenDrop: (() => void) | null = null;
onMounted(async () => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", onResize);
  start();
  startProjects();
  startGit();
  startAlerts();
  startStatusItem();
  loadHistory();
  startMobile();
  loadClaudeLink();
  startRemoteWatch();
  unlistenDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type !== "drop") return;
    const result = await ImageDrop.handleDrop(
      event.payload.paths,
      event.payload.position.x / zoomFactor(),
      event.payload.position.y / zoomFactor(),
    );
    if (result === "no_terminal_under_drop") toast(t("app.dropNoTerminalUnderDrop"), "error");
    else if (result === "not_an_image") toast(t("app.dropNotAnImage"), "error");
    else if (result === "failed") toast(t("app.dropFailed"), "error");
  });
});
onBeforeUnmount(() => {
  unlistenDrop?.();
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div class="app">
    <SplashScreen />
    <AboutModal />
    <TopBar />
    <div class="body">
      <Sidebar />
      <Resizer v-if="settings.leftCollapsed === false" v-model:width="settings.leftWidth" side="left" :min="LEFT_COLUMN.min" :default-width="LEFT_COLUMN.defaultWidth" :reserve="leftReserve" :highlighted="highlightedEdge === 'left'" />
      <!-- A collapsed sidebar has no line to drag, but it keeps the gap that the line fills. -->
      <div v-else class="sidebar-gap"></div>
      <main class="center">
        <template v-if="state.snapshot">
          <TabBar />
          <div class="stage">
            <PaneGrid :outer-edges="paneOuterEdges" @outer-start="onCornerStart" @outer-move="onCornerMove" @outer-highlight="highlightedEdge = $event" />
            <template v-if="allPinnedPanes.length">
              <Resizer
                :width="columnOfPinnedPanesShownWidth"
                @update:width="(v: number) => (settings.columnOfPinnedPanesWidth = v)"
                side="right"
                inside
                :min="COLUMN_OF_PINNED_PANES.min"
                :max="COLUMN_OF_PINNED_PANES.max"
                :default-width="COLUMN_OF_PINNED_PANES.defaultWidth"
                :reserve="columnOfPinnedPanesReserve"
                :highlighted="highlightedEdge === 'right'"
              />
              <ColumnOfPinnedPanes :style="{ width: `${columnOfPinnedPanesShownWidth}px` }" />
            </template>
          </div>
        </template>
        <Offline v-else />
      </main>
      <template v-if="state.snapshot">
        <Resizer v-if="settings.rightCollapsed === false" v-model:width="settings.rightWidth" side="right" :min="RIGHT_COLUMN.min" :default-width="RIGHT_COLUMN.defaultWidth" :reserve="rightReserve" :highlighted="highlightedEdge === 'right' && allPinnedPanes.length === 0" />
        <div v-else class="sidebar-gap"></div>
        <RightPanel />
      </template>
    </div>
    <StatusBar />
    <CommandPalette v-if="state.paletteOpen" />
    <MacroEditor v-if="macroEditor.open" />
    <ThreeJsDemoModal v-if="threeJsDemoModal.open" />
    <NoteModal v-if="notes.openId" />
    <RcModal v-if="remote.openFor" />
    <GitModal v-if="git.modal.open" />
    <MergeModal v-if="merging.open && merging.req" />
    <IssueModal v-if="issueView.open" />
    <NewAgentModal v-if="newAgent.open" />
    <SearchModal v-if="search.open" />
    <ShortcutsModal v-if="state.shortcutsOpen" />
    <MosaicModal v-if="mosaic.paneId" />
    <AgentsInformationModal v-if="agentsInformationModal.open" />
    <NewCustomLauncherModal v-if="newCustomLauncherModal.open" />
    <SavedSearchModal v-if="savedSearchModal.open" />
    <ImportLaunchersModal v-if="importLaunchersModal.open" />
    <HistoryModal v-if="history.open" />
    <SettingsModal v-if="settingsModal.open" />
    <InstalledSkillModal v-if="installedSkillModal.open" />
    <FindNewSkillsModal v-if="findNewSkillsModal.open" />
    <SkillFileModal v-if="skills.view !== null" />
    <FilesModal v-if="files.open" />
    <DangerModal v-if="danger.open" />
    <ConfirmModal v-if="confirmDialog.open" />
    <Transition name="toast">
      <div v-if="state.toast" class="toast" :class="{ error: state.toastKind === 'error' }" :role="state.toastKind === 'error' ? 'alert' : 'status'">
        <Icon v-if="state.toastKind === 'error'" name="exclamation-octagon-fill" class="toast-icon" />
        {{ state.toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app { height: 100%; display: flex; flex-direction: column; background: var(--shell); }
.body { flex: 1; min-height: 0; display: flex; padding: 0 var(--pane-gap); }
/* The viewport is a frame like the two sidebars: same border, same corners, same background. The tab bar is inside the frame.
   The frame has no padding: the panes touch its border, and the frame clips the corners of the panes that touch its own rounded
   corners. */
.center {
  flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side);
}
.sidebar-gap { width: var(--pane-gap); flex-shrink: 0; }
/* The border of the panes goes 1 pixel past the frame on the left, on the right, and at the bottom: the frame clips it, so the
   border of the frame is the only line there. At the top, the border of the panes is the line under the tab bar. */
.stage { flex: 1; min-height: 0; display: flex; margin: 0 -1px -1px; }
.stage > :first-child { flex: 1; min-width: 0; }
.toast {
  position: fixed; right: 16px; bottom: 52px;
  padding: 10px 16px; border-radius: 10px; background: var(--toast-bg); border: 1px solid var(--line-strong);
  color: var(--text); font-size: var(--font-size); box-shadow: 0 12px 32px var(--toast-shadow); z-index: 50;
}
.toast.error { background: #7f1d1d; border-color: #ef4444; color: #fff; font-weight: 600; }
.toast-icon { margin-right: 8px; color: #fecaca; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(6px); }
</style>
