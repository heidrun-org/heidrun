import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import { deleteSavedSearch, saveSearch, updateSavedSearch } from "./code_hosting_searches";
import { settings } from "./settings";

beforeEach(() => {
  settings.codeHostingSavedSearches = { issues: [], requests: [] };
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
    expect(updateSavedSearch("issues", 0, " Jérôme ", " author:jerome ")).toBe(true);
    expect(settings.codeHostingSavedSearches.issues[0]).toEqual({ name: "Jérôme", query: "author:jerome" });
  });

  it("changes the saved search of its list only", () => {
    updateSavedSearch("issues", 0, "Jérôme", "author:jerome");
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Mine", query: "author:@me" }]);
  });

  it("allows the saved search to keep its own name", () => {
    expect(updateSavedSearch("issues", 1, "Eric", "author:erictang")).toBe(true);
    expect(settings.codeHostingSavedSearches.issues[1]).toEqual({ name: "Eric", query: "author:erictang" });
  });

  it("allows the name of a saved search of the other list", () => {
    expect(updateSavedSearch("requests", 0, "Eric", "author:eric")).toBe(true);
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Eric", query: "author:eric" }]);
  });

  it("changes nothing for the name of another saved search of the list, an empty text, or a place that does not exist", () => {
    expect(updateSavedSearch("issues", 0, "Eric", "author:@me")).toBe(false);
    expect(updateSavedSearch("issues", 0, "", "author:@me")).toBe(false);
    expect(updateSavedSearch("issues", 0, "Mine", " ")).toBe(false);
    expect(updateSavedSearch("issues", 5, "Other", "label:bug")).toBe(false);
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
    deleteSavedSearch("issues", 1);
    expect(settings.codeHostingSavedSearches.issues.map((saved) => saved.name)).toEqual(["Mine", "Bugs"]);
  });

  it("removes the saved search of its list only", () => {
    saveSearch("issues", "Mine", "author:@me");
    saveSearch("requests", "Mine", "author:@me");
    deleteSavedSearch("requests", 0);
    expect(settings.codeHostingSavedSearches.issues).toHaveLength(1);
    expect(settings.codeHostingSavedSearches.requests).toEqual([]);
  });
});
