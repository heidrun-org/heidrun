import { beforeEach, describe, expect, it, vi } from "vitest";
import { FONT_DEFAULT, FONT_MAX, FONT_MIN, FONTS, fontStack, resetZoom, settings, zoom, zoomFactor } from "./settings";

const setZoom = vi.hoisted(() => vi.fn(async () => {}));
const invoke = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom }) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  settings.fontId = "geist";
  resetZoom();
});

describe("zoom", () => {
  it("changes the font size by the given step", () => {
    zoom(1);
    expect(settings.fontSize).toBe(FONT_DEFAULT + 1);
  });

  it("rounds to half a point", () => {
    zoom(0.3);
    expect(settings.fontSize).toBe(FONT_DEFAULT + 0.5);
  });

  it("never goes under the minimum", () => {
    zoom(-100);
    expect(settings.fontSize).toBe(FONT_MIN);
  });

  it("never goes over the maximum", () => {
    zoom(100);
    expect(settings.fontSize).toBe(FONT_MAX);
  });

  it("returns to the default size on reset", () => {
    zoom(5);
    resetZoom();
    expect(settings.fontSize).toBe(FONT_DEFAULT);
  });
});

describe("fontStack", () => {
  it("returns the stack of the chosen font", () => {
    settings.fontId = "menlo";
    expect(fontStack()).toBe("Menlo, monospace");
  });

  it("falls back to the first font for an unknown id", () => {
    settings.fontId = "nope";
    expect(fontStack()).toBe(FONTS[0].stack);
  });

  it("gives every font a unique id", () => {
    const ids = FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("settings", () => {
  it("has the documented defaults", () => {
    expect(settings.language).toBe("en");
    expect(settings.mouseMode).toBe("select");
  });

  it("shows the status item in the macOS menu bar by default", () => {
    expect(settings.showStatusItem).toBe(true);
  });
});

describe("keep agents running after quit", () => {
  it("is off by default, so quitting Heidrun stops its Herdr session", () => {
    expect(settings.keepAgentsRunningAfterQuit).toBe(false);
  });

  it("is given to the Rust side at the start and at each change", async () => {
    invoke.mockClear();
    settings.keepAgentsRunningAfterQuit = true;
    await vi.waitFor(() => expect(invoke).toHaveBeenLastCalledWith("set_keep_agents_running", { isKeeping: true }));
    settings.keepAgentsRunningAfterQuit = false;
    await vi.waitFor(() => expect(invoke).toHaveBeenLastCalledWith("set_keep_agents_running", { isKeeping: false }));
  });

  it("is given to the Rust side when the application starts again with the setting on", async () => {
    settings.keepAgentsRunningAfterQuit = true;
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").keepAgentsRunningAfterQuit).toBe(true));
    invoke.mockClear();
    vi.resetModules();
    await import("./settings");
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("set_keep_agents_running", { isKeeping: true }));
    settings.keepAgentsRunningAfterQuit = false;
  });
});

describe("time format", () => {
  it("follows the language by default", () => {
    expect(settings.timeFormat).toBe("auto");
  });
});

describe("working days", () => {
  it("are all the days of the week by default", () => {
    expect(settings.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("zoom of the whole window", () => {
  it("is 1 at the default font size", () => {
    expect(zoomFactor()).toBe(1);
  });

  it("is the font size divided by the default font size", () => {
    zoom(2.5);
    expect(zoomFactor()).toBe((FONT_DEFAULT + 2.5) / FONT_DEFAULT);
  });

  it("is given to the web view, so the sidebar, the menus, the dialogs and the middle area change size together", async () => {
    setZoom.mockClear();
    zoom(2.5);
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith((FONT_DEFAULT + 2.5) / FONT_DEFAULT));
    resetZoom();
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith(1));
  });

  it("is saved and applied again after the application restarts", async () => {
    zoom(3);
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").fontSize).toBe(FONT_DEFAULT + 3));
    setZoom.mockClear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT + 3);
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith((FONT_DEFAULT + 3) / FONT_DEFAULT));
  });
});

describe("settings that got a new name to follow the glossary", () => {
  it("keeps the pinned panes, the width of the column of pinned panes, and the sidebar section of the right sidebar that an older version saved", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({ dockedPanes: ["p1", "p2"], dockWidth: 700, rightTab: "notes" }),
    );
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.pinnedPanes).toEqual(["p1", "p2"]);
    expect(restarted.settings.columnOfPinnedPanesWidth).toBe(700);
    expect(restarted.settings.rightSidebarSection).toBe("notes");
  });

  it("forgets the old names, so that the saved value does not keep both names", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dockedPanes: ["p1"], dockWidth: 700, rightTab: "git" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(Object.keys(restarted.settings)).not.toEqual(expect.arrayContaining(["dockedPanes"]));
    expect(Object.keys(restarted.settings)).not.toEqual(expect.arrayContaining(["dockWidth"]));
    expect(Object.keys(restarted.settings)).not.toEqual(expect.arrayContaining(["rightTab"]));
  });

  it("prefers the new name when the saved value has both names", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dockedPanes: ["old"], pinnedPanes: ["new"] }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.pinnedPanes).toEqual(["new"]);
  });
});

describe("sidebar sections that moved from the right sidebar to the left sidebar", () => {
  it.each(["actions", "git"])("shows the sidebar section %s in the left sidebar when an older version saved it for the right sidebar", async (section) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: section }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe(section);
    expect(restarted.settings.rightSidebarSection).toBe("pane");
  });

  it("does the same for the name rightTab, that is older still", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightTab: "git" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("git");
    expect(restarted.settings.rightSidebarSection).toBe("pane");
  });

  it("keeps the sidebar section that the left sidebar already had", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "git", leftSidebarSection: "actions" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("actions");
    expect(restarted.settings.rightSidebarSection).toBe("pane");
  });

  it("keeps the sidebar sections that belong to the right sidebar", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "notes" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe("notes");
    expect(restarted.settings.leftSidebarSection).toBe("actions");
  });
});

describe("sidebar section of the left sidebar that held the workspaces", () => {
  it.each(["workspaces", "workspacesAndTabs"])("shows the sidebar section Scripts when the saved sidebar section was %s, because the workspaces left the left sidebar", async (savedName) => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: savedName }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("actions");
  });

  it("shows the sidebar section Scripts when the saved sidebar section was To handle, because the To handle sidebar section moved to the right sidebar", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "toHandle", rightSidebarSection: "notes" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("actions");
    expect(restarted.settings.rightSidebarSection).toBe("notes");
  });

  it("keeps the sidebar section To handle in the right sidebar when it was saved there", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ rightSidebarSection: "toHandle" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.rightSidebarSection).toBe("toHandle");
    expect(restarted.settings.leftSidebarSection).toBe("actions");
  });

  it("keeps the sidebar section Git when it was saved", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ leftSidebarSection: "git" }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("git");
  });

  it("is the sidebar section Scripts that the left sidebar shows first", async () => {
    localStorage.clear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.leftSidebarSection).toBe("actions");
  });
});

/** The options of the windows and of the sidebar sections that the application saves: name, default value, other value. */
const SAVED_OPTIONS: [string, unknown, unknown][] = [
  ["filesSideMode", "tree", "grep"],
  ["filesGrepRegex", false, true],
  ["filesGrepCase", false, true],
  ["filesShowIgnored", false, true],
  ["agentsActivityScope", "all", "pane"],
  ["historyPeriod", "today", "90"],
  ["historyGroupBy", "ws", "feature"],
  ["historyShowAssumptions", false, true],
  ["searchRegex", false, true],
  ["searchAgentsOnly", false, true],
  ["searchThisWorkspace", false, true],
  ["scriptsShowAllSuggestions", false, true],
  ["notesShowAll", false, true],
  ["chatsAgent", "claude", "codex"],
  ["chatsView", "compact", "expanded"],
  ["dynamicTopicExtraction", "keyword", "languageModel"],
];

describe("the last state of each option", () => {
  it.each(SAVED_OPTIONS)("gives the default value of the option %s when nothing is saved", async (name, defaultValue) => {
    localStorage.clear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect((restarted.settings as Record<string, unknown>)[name]).toEqual(defaultValue);
  });

  it.each(SAVED_OPTIONS)("saves the option %s when it changes, and gives it back after the application restarts", async (name, _defaultValue, otherValue) => {
    localStorage.clear();
    (settings as Record<string, unknown>)[name] = otherValue;
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}")[name]).toEqual(otherValue));
    vi.resetModules();
    const restarted = await import("./settings");
    expect((restarted.settings as Record<string, unknown>)[name]).toEqual(otherValue);
    (settings as Record<string, unknown>)[name] = SAVED_OPTIONS.find((option) => option[0] === name)?.[1];
  });

  it("keeps the other options when the saved value holds only some of them", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ searchRegex: true }));
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.searchRegex).toBe(true);
    expect(restarted.settings.searchAgentsOnly).toBe(false);
    expect(restarted.settings.mouseMode).toBe("select");
  });
});

describe("a corrupted saved value", () => {
  it.each(["{not json", "", "null", "42", '"text"', "[]"])("gives the default values when the saved text is %j", async (savedText) => {
    localStorage.setItem("heidrun.settings", savedText);
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.filesSideMode).toBe("tree");
    expect(restarted.settings.historyPeriod).toBe("today");
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT);
  });

  it("gives the default value for each option whose saved value has the wrong type, and keeps the other options", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({
        filesGrepRegex: "yes",
        historyPeriod: 7,
        workingDays: "monday",
        budgets: null,
        fontSize: "big",
        searchAgentsOnly: null,
        theme: "dark",
      }),
    );
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.filesGrepRegex).toBe(false);
    expect(restarted.settings.historyPeriod).toBe("today");
    expect(restarted.settings.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(restarted.settings.budgets).toEqual({});
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT);
    expect(restarted.settings.searchAgentsOnly).toBe(false);
    expect(restarted.settings.theme).toBe("dark");
  });

  it("gives the default value for each option whose saved value is not in the list of its values, and keeps the other options", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({
        filesSideMode: "sideways",
        agentsActivityScope: "none",
        historyPeriod: "12",
        historyGroupBy: "year",
        chatsAgent: "gemini",
        chatsView: "wide",
        dynamicTopicExtraction: "oracle",
        searchRegex: true,
      }),
    );
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.filesSideMode).toBe("tree");
    expect(restarted.settings.agentsActivityScope).toBe("all");
    expect(restarted.settings.historyPeriod).toBe("today");
    expect(restarted.settings.historyGroupBy).toBe("ws");
    expect(restarted.settings.chatsAgent).toBe("claude");
    expect(restarted.settings.chatsView).toBe("compact");
    expect(restarted.settings.dynamicTopicExtraction).toBe("keyword");
    expect(restarted.settings.searchRegex).toBe(true);
  });
});
