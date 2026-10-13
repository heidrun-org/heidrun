import { reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack given to xterm. */
  stack: string;
}

// Geist Mono, JetBrains Mono, Fira Code and Inconsolata are loaded from Google Fonts
// (index.html); the others ship with macOS or are installed by the user.
export const FONTS: FontOption[] = [
  { id: "geist", label: "Geist Mono", stack: '"Geist Mono", ui-monospace, Menlo, monospace' },
  { id: "sf", label: "SF Mono", stack: 'ui-monospace, "SF Mono", Menlo, monospace' },
  { id: "jetbrains", label: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, Menlo, monospace' },
  { id: "fira", label: "Fira Code", stack: '"Fira Code", ui-monospace, Menlo, monospace' },
  // Installed locally (powerline/fonts or Nerd Fonts); Google's Inconsolata as a
  // fallback, without the powerline glyphs.
  {
    id: "inconsolata-powerline",
    label: "Inconsolata for Powerline",
    stack: '"Inconsolata for Powerline", "Inconsolata Nerd Font Mono", "Inconsolata Nerd Font", "InconsolataGo Nerd Font", Inconsolata, ui-monospace, monospace',
  },
  { id: "menlo", label: "Menlo", stack: "Menlo, monospace" },
  { id: "monaco", label: "Monaco", stack: "Monaco, Menlo, monospace" },
];

export const FONT_MIN = 9;
export const FONT_MAX = 24;
export const FONT_DEFAULT = 16;

// The one place of the text size: every font size of the window reads this CSS variable.
document.documentElement.style.setProperty("--font-size", `${FONT_DEFAULT}px`);

const KEY = "heidrun.settings";

/** The sidebar sections of the left sidebar: "actions" is the Scripts sidebar section. */
export type LeftSidebarSection = "actions" | "sourceControl";

/** The sidebar sections of the right sidebar: "toHandle" is the Needs you sidebar section. */
export type RightSidebarSection = "toHandle" | "notes" | "chats";

const defaults = {
  fontId: "geist",
  fontSize: FONT_DEFAULT,
  leftOpen: true,
  rightOpen: true,
  /**
   * "select": dragging selects text in the terminal (⌘C to copy).
   * "app": mouse goes to Herdr / the program in the pane (scroll, clicks); ⌥ + drag still selects.
   */
  mouseMode: "select" as "select" | "app",
  /** Sidebar section that the left sidebar shows. */
  leftSidebarSection: "actions" as LeftSidebarSection,
  /** Sidebar section that the right sidebar shows. */
  rightSidebarSection: "toHandle" as RightSidebarSection,
  /** Sidebar section Chats: the coding agent whose chats the list shows. */
  chatsAgent: "claude" as "claude" | "codex",
  /** Sidebar section Chats: "compact" keeps the rows tight, and "expanded" gives them more air. */
  chatsView: "compact" as "compact" | "expanded",
  /** Settings window, section Dynamic topics: the method that computes the dynamic topics of each chat, "keyword" or "languageModel". */
  dynamicTopicExtraction: "keyword" as "keyword" | "languageModel",
  /** Settings window, section Dynamic topics: the topics show clustered dynamic topics (names of clusters) instead of raw dynamic topics. */
  clusteredDynamicTopics: false,
  /** Sidebar section Chats: what the list is sorted by. */
  chatsSortKey: "last_updated" as "created_on" | "last_updated" | "messages" | "issues" | "pull_requests" | "files_written",
  /** Sidebar section Chats: "descending" puts the largest value of the sort key first, and "ascending" puts the smallest value first. */
  chatsOrder: "descending" as "ascending" | "descending",
  /** Tab Scripts: the section Custom Scripts is folded. */
  scriptsCustomFolded: false,
  /** Tab Scripts: the section Recent is folded. */
  scriptsRecentFolded: false,
  /** Tab Scripts: the section Existing Scripts is folded. */
  scriptsExistingFolded: false,
  /** Last size of the note window, in px. */
  noteWidth: 760,
  /** Side columns, in px (drag the borders; double-click resets). */
  leftWidth: 280,
  /** Start the Herdr server in the background when it is not running. */
  autoStartHerdr: true,
  /** Quitting Heidrun does not stop the Herdr session of Heidrun: the agents continue to run. Off: quitting stops it. */
  keepAgentsRunningAfterQuit: false,
  /** Finished items (Activité, « À traiter » terminé) disappear after this many minutes; 0 = never. */
  finishedTtl: 15,
  /** Notifications. */
  notifBlockedMin: 5, // remind once when an agent stays blocked this long (0 = off)
  notifContext: true, // an agent's context goes past 80 %
  notifQuota: true, // Claude 5 h / week quota past 80 % then 95 %
  notifEvening: "", // "18:30": summary of the day's finished work ("" = off)
  quietFrom: "", // "20:00" … "08:00": no notification in between ("" = never quiet)
  quietTo: "",
  /** The status item (the dots) is shown in the macOS menu bar. */
  showStatusItem: true,
  /** Git viewer: "unified" | "split" diff, or the whole "file". */
  diffMode: "unified" as "unified" | "split" | "file" | "read",
  /** Side-by-side diff: share of the width for the old version (0.5 = middle). */
  splitRatio: 0.5,
  /** Markdown reading: centred column, or the whole width. */
  mdWidth: "center" as "center" | "full",
  /** Git window: file list hidden (the viewer takes the whole window). */
  gitListHidden: false,
  gitListWidth: 340,
  /** Language of the user interface. */
  language: "en" as "en" | "fr",
  /** Clock display: "auto" follows the language, "12h" shows AM and PM, "24h" shows the hour from 0 to 23. */
  timeFormat: "auto" as "auto" | "12h" | "24h",
  /** Days of the week you work, numbered like `Date.getDay()` (0 is Sunday). The weekly quota pace counts only these days. */
  workingDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  /** Application theme: "system" follows the operating system. */
  theme: "system" as "system" | "light" | "dark",
  /** Code colours: "auto" follows the application theme. */
  codeTheme: "auto",
  codeWrap: false,
  rightWidth: 320,
  noteHeight: 520,
  /** Pinned panes (pane ids), stacked in the column of pinned panes on the right of the panes of the selected tab. */
  pinnedPanes: [] as string[],
  /** History estimates: 1 h of agent work ≈ this many hours of a developer. */
  histHumanFactor: 4,
  /** Your own time: minutes per consigne written, per decision answered. */
  histPromptMin: 3,
  histDecisionMin: 0.5,
  /** File explorer: tree width, Markdown shown rendered. */
  filesListWidth: 300,
  filesMdRead: true,
  /** Show the diff before each save in the editor. */
  filesDiffBeforeSave: false,
  /** Mosaic: only the agents at work (main, recent journal, or in Claude's list). */
  mosaicActiveOnly: true,
  /** Monthly budget per workspace (label → USD); alert at 80 % and 100 %. */
  budgets: {} as Record<string, number>,
  /** Width of the column of pinned panes, in px. */
  columnOfPinnedPanesWidth: 560,
  /** The coding agents (ids of `lib/agents.ts`) that the user has a valid subscription or access for. */
  ownedAgents: [] as string[],
  /** Window Find new skills: where a skill is installed, "workspace" (the folder of the workspace) or "user". */
  skillsLevel: "workspace" as "workspace" | "user",
  /** The window of a SKILL.md file shows the rendered Markdown (true) or the highlighted source (false). */
  skillsViewRendered: true,
  /** Window Files: the side column shows the file tree ("tree") or the search in the files ("grep"). */
  filesSideMode: "tree" as "tree" | "grep",
  /** Window Files, search in the files: the query is a regular expression. */
  filesGrepRegex: false,
  /** Window Files, search in the files: the case of the letters counts. */
  filesGrepCase: false,
  /** Window Files: the file tree shows the files that Git ignores. */
  filesShowIgnored: false,
  /** Window Agents information: the activity list shows all the panes ("all") or only the selected pane ("pane"). */
  agentsActivityScope: "all" as "all" | "pane",
  /** Window History: the period of the runs. */
  historyPeriod: "today" as "today" | "7" | "30" | "90" | "365",
  /** Window History: the left column groups the runs by workspace ("ws") or by feature ("feature"). */
  historyGroupBy: "ws" as "ws" | "feature",
  /** Window History: the panel of the assumptions is open. */
  historyShowAssumptions: false,
  /** Window Search: the query is a regular expression. */
  searchRegex: false,
  /** Window Search: look only in the panes of the coding agents. */
  searchAgentsOnly: false,
  /** Window Search: look only in the selected workspace. */
  searchThisWorkspace: false,
  /** Sidebar section Scripts: the list of suggestions shows all the suggestions, not only the first six. */
  scriptsShowAllSuggestions: false,
  /** Sidebar section Notes: the list shows the notes of every workspace, not only of the selected workspace. */
  notesShowAll: false,
};

/** The values that an option accepts, for the options that have a short list of values. A saved value outside the list is dropped. */
const ALLOWED_VALUES: Record<string, readonly unknown[]> = {
  rightSidebarSection: ["toHandle", "notes", "chats"],
  filesSideMode: ["tree", "grep"],
  agentsActivityScope: ["all", "pane"],
  historyPeriod: ["today", "7", "30", "90", "365"],
  historyGroupBy: ["ws", "feature"],
  chatsAgent: ["claude", "codex"],
  chatsView: ["compact", "expanded"],
  dynamicTopicExtraction: ["keyword", "languageModel"],
  chatsSortKey: ["created_on", "last_updated", "messages", "issues", "pull_requests", "files_written"],
  chatsOrder: ["ascending", "descending"],
};

/**
 * Keeps each saved value that has the type of its default value, and that is in the list of its allowed values when the
 * option has such a list. A corrupted saved value gives the default value back.
 */
function dropCorruptedValues(saved: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...saved };
  for (const [name, defaultValue] of Object.entries(defaults)) {
    const value = result[name];
    const hasWrongType =
      value === null ||
      value === undefined ||
      typeof value !== typeof defaultValue ||
      Array.isArray(value) !== Array.isArray(defaultValue);
    const allowedValues = ALLOWED_VALUES[name];
    const isNotAllowed = allowedValues !== undefined && allowedValues.includes(value) === false;
    if (hasWrongType || isNotAllowed) {
      result[name] = structuredClone(defaultValue);
    }
  }
  return result;
}

/** Settings that got a new name to follow the glossary: the old name in the saved value, then the new name. */
const RENAMED_SETTINGS: Record<string, string> = {
  dockedPanes: "pinnedPanes",
  dockWidth: "columnOfPinnedPanesWidth",
  rightTab: "rightSidebarSection",
};

function load(): typeof defaults {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    for (const [oldName, newName] of Object.entries(RENAMED_SETTINGS)) {
      if (oldName in stored) {
        if (!(newName in stored)) {
          stored[newName] = stored[oldName];
        }
        delete stored[oldName];
      }
    }
    // The Scripts and Git sidebar sections moved from the right sidebar to the left sidebar.
    if (stored.rightSidebarSection === "actions" || stored.rightSidebarSection === "git") {
      if (!("leftSidebarSection" in stored)) {
        stored.leftSidebarSection = stored.rightSidebarSection;
      }
      stored.rightSidebarSection = "toHandle";
    }
    // The workspaces and the tabs left the left sidebar for the tab bar: its Workspaces sidebar section is gone.
    if (stored.leftSidebarSection === "workspacesAndTabs" || stored.leftSidebarSection === "workspaces") {
      stored.leftSidebarSection = "actions";
    }
    // The Needs you sidebar section moved from the left sidebar to the right sidebar.
    if (stored.leftSidebarSection === "toHandle") {
      stored.leftSidebarSection = "actions";
    }
    // The Source control sidebar section replaced the Git sidebar section (issue #305).
    if (stored.leftSidebarSection === "git") {
      stored.leftSidebarSection = "sourceControl";
    }
    const saved = dropCorruptedValues({ ...defaults, ...stored }) as typeof defaults;
    // "github-dark" was the only default before themes existed: it now means "auto".
    if (saved.codeTheme === "github-dark") {
      saved.codeTheme = "auto";
    }
    return saved;
  } catch {
    return { ...defaults };
  }
}

export const settings = reactive(load());

watch(
  () => ({ ...settings }),
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* preferences are a convenience */
    }
  },
  { deep: true },
);

export function fontStack(): string {
  return (FONTS.find((f) => f.id === settings.fontId) ?? FONTS[0]).stack;
}

/** The zoom factor of the whole window: the chosen font size divided by the default font size. */
export function zoomFactor(): number {
  return settings.fontSize / FONT_DEFAULT;
}

/** Applies the zoom factor to the whole web view of the window, not only to the terminal. */
export async function applyWindowZoom() {
  try {
    await getCurrentWebview().setZoom(zoomFactor());
  } catch {
    /* outside the Heidrun window (a test, a plain browser) there is no web view to zoom */
  }
}

watch(() => settings.fontSize, applyWindowZoom, { immediate: true });

/** Tells the Rust side whether quitting Heidrun leaves the Herdr session of Heidrun running. */
export async function applyKeepAgentsRunning() {
  try {
    await invoke("set_keep_agents_running", { isKeeping: settings.keepAgentsRunningAfterQuit });
  } catch {
    /* outside the Heidrun window (a test, a plain browser) there is no Rust side to tell */
  }
}

watch(() => settings.keepAgentsRunningAfterQuit, applyKeepAgentsRunning, { immediate: true });

export function zoom(delta: number) {
  const next = Math.round((settings.fontSize + delta) * 2) / 2;
  settings.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, next));
}

export function resetZoom() {
  settings.fontSize = FONT_DEFAULT;
}

/** The sections of the Settings window. */
export type SettingsSection =
  | "terminal"
  | "mouse"
  | "finishedItems"
  | "notifications"
  | "general"
  | "mobileAccess"
  | "agents"
  | "dynamicTopics";

/** State of the Settings window: not saved, the window starts closed on the first section. */
export const settingsModal = reactive({
  open: false,
  section: "general" as SettingsSection,
});

/** Opens the Settings window, on `section` when given. */
export function openSettings(section?: SettingsSection) {
  if (section !== undefined) {
    settingsModal.section = section;
  }
  settingsModal.open = true;
}
