import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import {
  deleteSavedSearch,
  saveSearch,
  savedSearchesOfLevel,
  shownSavedSearches,
  updateSavedSearch,
} from "./code_hosting_searches";
import { settings } from "./settings";

const FOLDER = "/work/heidrun";

const OTHER_FOLDER = "/work/other";

beforeEach(() => {
  settings.codeHostingSavedSearches = { issues: [], requests: [] };
  settings.codeHostingWorkspaceSavedSearches = {};
});

describe("saveSearch", () => {
  it("keeps a search under a name, in the order of saving", () => {
    expect(saveSearch("issues", "Mine", "author:@me")).toBe(true);
    expect(saveSearch("issues", "Mentions me", "mentions:@me")).toBe(true);
    expect(settings.codeHostingSavedSearches.issues).toEqual([
      { name: "Mine", query: "author:@me" },
      { name: "Mentions me", query: "mentions:@me" },
    ]);
  });

  it("keeps the saved search in its own list only", () => {
    saveSearch("issues", "Mine", "author:@me");
    saveSearch("requests", "To review", "review-requested:@me");
    expect(settings.codeHostingSavedSearches).toEqual({
      issues: [{ name: "Mine", query: "author:@me" }],
      requests: [{ name: "To review", query: "review-requested:@me" }],
    });
  });

  it("allows the same name in the two lists", () => {
    expect(saveSearch("issues", "Mine", "author:@me")).toBe(true);
    expect(saveSearch("requests", "Mine", "author:@me is:draft")).toBe(true);
    expect(settings.codeHostingSavedSearches.issues).toEqual([{ name: "Mine", query: "author:@me" }]);
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Mine", query: "author:@me is:draft" }]);
  });

  it("trims the name and the search", () => {
    saveSearch("issues", "  Mine ", "  author:@me ");
    expect(settings.codeHostingSavedSearches.issues).toEqual([{ name: "Mine", query: "author:@me" }]);
  });

  it("gives the new search to the saved search of the same list that has the same name", () => {
    saveSearch("issues", "Mine", "author:@me");
    saveSearch("issues", "Mine", "assignee:@me");
    expect(settings.codeHostingSavedSearches.issues).toEqual([{ name: "Mine", query: "assignee:@me" }]);
  });

  it("keeps nothing for an empty name or an empty search", () => {
    expect(saveSearch("issues", "  ", "author:@me")).toBe(false);
    expect(saveSearch("issues", "Mine", "  ")).toBe(false);
    expect(settings.codeHostingSavedSearches).toEqual({ issues: [], requests: [] });
  });
});

describe("updateSavedSearch", () => {
  beforeEach(() => {
    saveSearch("issues", "Mine", "author:@me");
    saveSearch("issues", "Eric", "author:eric");
    saveSearch("requests", "Mine", "author:@me");
  });

  it("renames a saved search and changes its search", () => {
    expect(updateSavedSearch("issues", "user", 0, " Jérôme ", " author:jerome ")).toBe(true);
    expect(settings.codeHostingSavedSearches.issues[0]).toEqual({ name: "Jérôme", query: "author:jerome" });
  });

  it("changes the saved search of its list only", () => {
    updateSavedSearch("issues", "user", 0, "Jérôme", "author:jerome");
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Mine", query: "author:@me" }]);
  });

  it("allows the saved search to keep its own name", () => {
    expect(updateSavedSearch("issues", "user", 1, "Eric", "author:erictang")).toBe(true);
    expect(settings.codeHostingSavedSearches.issues[1]).toEqual({ name: "Eric", query: "author:erictang" });
  });

  it("allows the name of a saved search of the other list", () => {
    expect(updateSavedSearch("requests", "user", 0, "Eric", "author:eric")).toBe(true);
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Eric", query: "author:eric" }]);
  });

  it("changes nothing for the name of another saved search of the list, an empty text, or a place that does not exist", () => {
    expect(updateSavedSearch("issues", "user", 0, "Eric", "author:@me")).toBe(false);
    expect(updateSavedSearch("issues", "user", 0, "", "author:@me")).toBe(false);
    expect(updateSavedSearch("issues", "user", 0, "Mine", " ")).toBe(false);
    expect(updateSavedSearch("issues", "user", 5, "Other", "label:bug")).toBe(false);
    expect(settings.codeHostingSavedSearches.issues).toEqual([
      { name: "Mine", query: "author:@me" },
      { name: "Eric", query: "author:eric" },
    ]);
  });
});

describe("deleteSavedSearch", () => {
  it("removes one saved search and keeps the others in their order", () => {
    saveSearch("issues", "Mine", "author:@me");
    saveSearch("issues", "Eric", "author:eric");
    saveSearch("issues", "Bugs", "label:bug");
    deleteSavedSearch("issues", "user", 1);
    expect(settings.codeHostingSavedSearches.issues.map((saved) => saved.name)).toEqual(["Mine", "Bugs"]);
  });

  it("removes the saved search of its list only", () => {
    saveSearch("issues", "Mine", "author:@me");
    saveSearch("requests", "Mine", "author:@me");
    deleteSavedSearch("requests", "user", 0);
    expect(settings.codeHostingSavedSearches.issues).toHaveLength(1);
    expect(settings.codeHostingSavedSearches.requests).toEqual([]);
  });
});

describe("the level workspace", () => {
  it("keeps the saved search under the folder of the workspace, and not at the user level", () => {
    expect(saveSearch("issues", "Mine", "author:@me", "workspace", FOLDER)).toBe(true);
    expect(settings.codeHostingWorkspaceSavedSearches).toEqual({
      [FOLDER]: { issues: [{ name: "Mine", query: "author:@me" }], requests: [] },
    });
    expect(settings.codeHostingSavedSearches).toEqual({ issues: [], requests: [] });
  });

  it("keeps nothing for the level workspace when there is no workspace folder", () => {
    expect(saveSearch("issues", "Mine", "author:@me", "workspace", null)).toBe(false);
    expect(settings.codeHostingWorkspaceSavedSearches).toEqual({});
  });

  it("allows the same name at the two levels", () => {
    expect(saveSearch("issues", "Mine", "author:@me", "user", FOLDER)).toBe(true);
    expect(saveSearch("issues", "Mine", "assignee:@me", "workspace", FOLDER)).toBe(true);
    expect(shownSavedSearches("issues", FOLDER)).toEqual([
      { name: "Mine", query: "author:@me", level: "user" },
      { name: "Mine", query: "assignee:@me", level: "workspace" },
    ]);
  });

  it("gives the new search to the saved search of the same level that has the same name", () => {
    saveSearch("issues", "Mine", "author:@me", "workspace", FOLDER);
    saveSearch("issues", "Mine", "assignee:@me", "workspace", FOLDER);
    expect(savedSearchesOfLevel("issues", "workspace", FOLDER)).toEqual([{ name: "Mine", query: "assignee:@me" }]);
  });
});

describe("shownSavedSearches", () => {
  it("shows the user level first, then the workspace level, each in the order of saving", () => {
    saveSearch("issues", "Workspace one", "label:one", "workspace", FOLDER);
    saveSearch("issues", "User one", "author:@me", "user", FOLDER);
    saveSearch("issues", "Workspace two", "label:two", "workspace", FOLDER);
    saveSearch("issues", "User two", "assignee:@me", "user", FOLDER);
    expect(shownSavedSearches("issues", FOLDER).map((saved) => `${saved.level}:${saved.name}`)).toEqual([
      "user:User one",
      "user:User two",
      "workspace:Workspace one",
      "workspace:Workspace two",
    ]);
  });

  it("shows the user level in every workspace, and the workspace level only in its own workspace", () => {
    saveSearch("issues", "User one", "author:@me", "user", FOLDER);
    saveSearch("issues", "Workspace one", "label:one", "workspace", FOLDER);
    expect(shownSavedSearches("issues", OTHER_FOLDER)).toEqual([
      { name: "User one", query: "author:@me", level: "user" },
    ]);
    expect(shownSavedSearches("issues", null)).toEqual([{ name: "User one", query: "author:@me", level: "user" }]);
  });

  it("shows the saved searches of one list only", () => {
    saveSearch("issues", "Issues one", "label:one", "workspace", FOLDER);
    saveSearch("requests", "Requests one", "review-requested:@me", "workspace", FOLDER);
    expect(shownSavedSearches("requests", FOLDER).map((saved) => saved.name)).toEqual(["Requests one"]);
  });
});

describe("updateSavedSearch with a level", () => {
  beforeEach(() => {
    saveSearch("issues", "Mine", "author:@me", "user", FOLDER);
    saveSearch("issues", "Bugs", "label:bug", "workspace", FOLDER);
  });

  it("moves a saved search from the user level to the workspace level", () => {
    expect(updateSavedSearch("issues", "user", 0, "Mine", "author:@me", "workspace", FOLDER)).toBe(true);
    expect(savedSearchesOfLevel("issues", "user", FOLDER)).toEqual([]);
    expect(savedSearchesOfLevel("issues", "workspace", FOLDER)).toEqual([
      { name: "Bugs", query: "label:bug" },
      { name: "Mine", query: "author:@me" },
    ]);
  });

  it("moves a saved search from the workspace level to the user level, with its new name and search", () => {
    expect(updateSavedSearch("issues", "workspace", 0, "Open bugs", "label:bug is:open", "user", FOLDER)).toBe(true);
    expect(savedSearchesOfLevel("issues", "workspace", FOLDER)).toEqual([]);
    expect(savedSearchesOfLevel("issues", "user", FOLDER)).toEqual([
      { name: "Mine", query: "author:@me" },
      { name: "Open bugs", query: "label:bug is:open" },
    ]);
  });

  it("changes nothing when the new level has a saved search with the same name", () => {
    expect(updateSavedSearch("issues", "user", 0, "Bugs", "author:@me", "workspace", FOLDER)).toBe(false);
    expect(savedSearchesOfLevel("issues", "user", FOLDER)).toEqual([{ name: "Mine", query: "author:@me" }]);
    expect(savedSearchesOfLevel("issues", "workspace", FOLDER)).toEqual([{ name: "Bugs", query: "label:bug" }]);
  });

  it("changes nothing when the new level is workspace and there is no workspace folder", () => {
    expect(updateSavedSearch("issues", "user", 0, "Mine", "author:@me", "workspace", null)).toBe(false);
    expect(savedSearchesOfLevel("issues", "user", null)).toEqual([{ name: "Mine", query: "author:@me" }]);
  });

  it("keeps its own name at the same level", () => {
    expect(updateSavedSearch("issues", "workspace", 0, "Bugs", "label:bug label:ui", "workspace", FOLDER)).toBe(true);
    expect(savedSearchesOfLevel("issues", "workspace", FOLDER)).toEqual([{ name: "Bugs", query: "label:bug label:ui" }]);
  });
});

describe("deleteSavedSearch with a level", () => {
  it("removes a saved search of the workspace level and keeps the user level", () => {
    saveSearch("issues", "Mine", "author:@me", "user", FOLDER);
    saveSearch("issues", "Bugs", "label:bug", "workspace", FOLDER);
    deleteSavedSearch("issues", "workspace", 0, FOLDER);
    expect(shownSavedSearches("issues", FOLDER).map((saved) => saved.name)).toEqual(["Mine"]);
  });
});
