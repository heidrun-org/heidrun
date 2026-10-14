import { beforeEach, describe, expect, it } from "vitest";
import { closeSavedSearchModal, openEditSavedSearchModal, openSaveSearchModal, savedSearchModal } from "./saved_search_modal";

beforeEach(() => {
  closeSavedSearchModal();
});

describe("savedSearchModal", () => {
  it("starts closed", () => {
    expect(savedSearchModal.open).toBe(false);
  });

  it("opens in the mode save with the search to keep, and no name", () => {
    openSaveSearchModal("label:bug");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "save", query: "label:bug", name: "" });
  });

  it("opens in the mode edit with the name of the saved search, and no search to keep", () => {
    openSaveSearchModal("label:bug");
    openEditSavedSearchModal("Bugs");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "edit", query: "", name: "Bugs" });
  });

  it("closes", () => {
    openSaveSearchModal("label:bug");
    closeSavedSearchModal();
    expect(savedSearchModal.open).toBe(false);
  });
});
