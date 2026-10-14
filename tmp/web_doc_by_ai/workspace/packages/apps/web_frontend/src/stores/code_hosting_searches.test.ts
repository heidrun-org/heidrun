import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import { deleteSavedSearch, saveSearch, updateSavedSearch } from "./code_hosting_searches";
import { settings } from "./settings";

beforeEach(() => {
  settings.codeHostingSavedSearches = [];
});

describe("saveSearch", () => {
  it("keeps a search under a name, in the order of saving", () => {
    expect(saveSearch("Mine", "author:@me")).toBe(true);
    expect(saveSearch("Mentions me", "mentions:@me")).toBe(true);
    expect(settings.codeHostingSavedSearches).toEqual([
      { name: "Mine", query: "author:@me" },
      { name: "Mentions me", query: "mentions:@me" },
    ]);
  });

  it("trims the name and the search", () => {
    saveSearch("  Mine ", "  author:@me ");
    expect(settings.codeHostingSavedSearches).toEqual([{ name: "Mine", query: "author:@me" }]);
  });

  it("gives the new search to the saved search that has the same name", () => {
    saveSearch("Mine", "author:@me");
    saveSearch("Mine", "assignee:@me");
    expect(settings.codeHostingSavedSearches).toEqual([{ name: "Mine", query: "assignee:@me" }]);
  });

  it("keeps nothing for an empty name or an empty search", () => {
    expect(saveSearch("  ", "author:@me")).toBe(false);
    expect(saveSearch("Mine", "  ")).toBe(false);
    expect(settings.codeHostingSavedSearches).toEqual([]);
  });
});

describe("updateSavedSearch", () => {
  beforeEach(() => {
    saveSearch("Mine", "author:@me");
    saveSearch("Eric", "author:eric");
  });

  it("renames a saved search and changes its search", () => {
    expect(updateSavedSearch(0, " Jérôme ", " author:jerome ")).toBe(true);
    expect(settings.codeHostingSavedSearches[0]).toEqual({ name: "Jérôme", query: "author:jerome" });
  });

  it("allows the saved search to keep its own name", () => {
    expect(updateSavedSearch(1, "Eric", "author:erictang")).toBe(true);
    expect(settings.codeHostingSavedSearches[1]).toEqual({ name: "Eric", query: "author:erictang" });
  });

  it("changes nothing for the name of another saved search, an empty text, or a place that does not exist", () => {
    expect(updateSavedSearch(0, "Eric", "author:@me")).toBe(false);
    expect(updateSavedSearch(0, "", "author:@me")).toBe(false);
    expect(updateSavedSearch(0, "Mine", " ")).toBe(false);
    expect(updateSavedSearch(5, "Other", "label:bug")).toBe(false);
    expect(settings.codeHostingSavedSearches).toEqual([
      { name: "Mine", query: "author:@me" },
      { name: "Eric", query: "author:eric" },
    ]);
  });
});

describe("deleteSavedSearch", () => {
  it("removes one saved search and keeps the others in their order", () => {
    saveSearch("Mine", "author:@me");
    saveSearch("Eric", "author:eric");
    saveSearch("Bugs", "label:bug");
    deleteSavedSearch(1);
    expect(settings.codeHostingSavedSearches.map((saved) => saved.name)).toEqual(["Mine", "Bugs"]);
  });
});
