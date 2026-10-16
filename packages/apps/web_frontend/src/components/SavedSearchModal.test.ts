import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../stores/code_hosting", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stores/code_hosting")>();
  return { ...original, searchCodeHosting: vi.fn(async () => {}) };
});

import SavedSearchModal from "./SavedSearchModal.vue";
import { codeHosting, searchCodeHosting } from "../stores/code_hosting";
import { answerConfirm, confirmDialog } from "../stores/confirm";
import { git, type GitStatus } from "../stores/git";
import { openEditSavedSearchModal, openSaveSearchModal, savedSearchModal } from "../stores/saved_search_modal";
import { state } from "../stores/session";
import { settings } from "../stores/settings";

/** The panels that a test mounted. They stay in the page until `afterEach` unmounts them. */
const mountedModals: VueWrapper[] = [];

/** Mounts the window as it is when the store says that it is open. */
async function mountModal() {
  const wrapper = mount(SavedSearchModal, { attachTo: document.body });
  mountedModals.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.mocked(searchCodeHosting).mockClear();
  settings.codeHostingSavedSearches = { issues: [], requests: [] };
  settings.confirmSavedSearchDelete = true;
  codeHosting.search = { issues: "", requests: "" };
  codeHosting.forge = "github";
  state.selectedWorkspaceId = "w1";
  git.status = { w1: { root: "/work/heidrun" } as GitStatus };
  savedSearchModal.open = false;
});

afterEach(() => {
  for (const wrapper of mountedModals.splice(0)) {
    wrapper.unmount();
  }
  confirmDialog.resolve?.(false);
  confirmDialog.open = false;
  state.selectedWorkspaceId = null;
  git.status = {};
});

describe("SavedSearchModal, the window Save this search", () => {
  beforeEach(() => {
    openSaveSearchModal("issues", "label:bug -author:eric");
  });

  it("shows the title, an empty field Name that has the focus, and the search to keep", async () => {
    const wrapper = await mountModal();
    expect(wrapper.get("h2").text()).toBe("Save this search");
    expect(wrapper.get("form").attributes("aria-label")).toBe("Save this search");
    const nameField = wrapper.get("#saved-search-name");
    expect((nameField.element as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(nameField.element);
    expect(wrapper.get("[data-saved-search-query]").text()).toBe("label:bug -author:eric");
    expect(wrapper.find("#saved-search-query").exists()).toBe(false);
    expect(wrapper.find(".delete").exists()).toBe(false);
  });

  it("shows the title of the list that the saved search is for", async () => {
    const wrapper = await mountModal();
    expect(wrapper.get("[data-saved-search-list]").text()).toBe("Issues");
    wrapper.unmount();
    mountedModals.pop();
    openSaveSearchModal("requests", "is:draft");
    const requests = await mountModal();
    expect(requests.get("[data-saved-search-list]").text()).toBe("Pull requests");
    requests.unmount();
    mountedModals.pop();
    codeHosting.forge = "gitlab";
    const mergeRequests = await mountModal();
    expect(mergeRequests.get("[data-saved-search-list]").text()).toBe("Merge requests");
  });

  it("disables Save while the name is empty", async () => {
    const wrapper = await mountModal();
    const save = wrapper.get("button[type='submit']");
    expect(save.text()).toBe("Save");
    expect(save.attributes("disabled")).toBeDefined();
    await wrapper.get("#saved-search-name").setValue("   ");
    expect(save.attributes("disabled")).toBeDefined();
    await wrapper.get("#saved-search-name").setValue("Bugs");
    expect(save.attributes("disabled")).toBeUndefined();
  });

  it("keeps the saved search, closes the window, and runs the search, when the form is submitted", async () => {
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("  Bugs ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches.issues).toEqual([{ name: "Bugs", query: "label:bug -author:eric" }]);
    expect(settings.codeHostingSavedSearches.requests).toEqual([]);
    expect(savedSearchModal.open).toBe(false);
    expect(searchCodeHosting).toHaveBeenCalledWith("/work/heidrun", "issues", "label:bug -author:eric");
  });

  it("keeps the saved search in the list of pull requests only, and runs the search in this list", async () => {
    openSaveSearchModal("requests", "is:draft");
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Drafts");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches).toEqual({ issues: [], requests: [{ name: "Drafts", query: "is:draft" }] });
    expect(searchCodeHosting).toHaveBeenCalledWith("/work/heidrun", "requests", "is:draft");
  });

  it("does not run the search again when it already runs in the list", async () => {
    codeHosting.search.issues = "label:bug -author:eric";
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Bugs");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches.issues).toHaveLength(1);
    expect(searchCodeHosting).not.toHaveBeenCalled();
  });

  it("runs the search when it runs in the other list only", async () => {
    codeHosting.search.requests = "label:bug -author:eric";
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Bugs");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(searchCodeHosting).toHaveBeenCalledWith("/work/heidrun", "issues", "label:bug -author:eric");
  });

  it("says that Save replaces the search of the saved search that has the same name, and does it", async () => {
    settings.codeHostingSavedSearches.issues = [{ name: "Bugs", query: "label:old" }];
    const wrapper = await mountModal();
    expect(wrapper.find(".hint").exists()).toBe(false);
    await wrapper.get("#saved-search-name").setValue("Bugs");
    expect(wrapper.get(".hint").text()).toBe("A saved search has this name. Save replaces its search.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches.issues).toEqual([{ name: "Bugs", query: "label:bug -author:eric" }]);
  });

  it("does not say that Save replaces a search when only a saved search of the other list has the name", async () => {
    settings.codeHostingSavedSearches.requests = [{ name: "Bugs", query: "label:old" }];
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Bugs");
    expect(wrapper.find(".hint").exists()).toBe(false);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Bugs", query: "label:old" }]);
    expect(settings.codeHostingSavedSearches.issues).toEqual([{ name: "Bugs", query: "label:bug -author:eric" }]);
  });

  it("closes without a change at the key Escape, at the button Cancel, at the cross, and at a click outside the window", async () => {
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Bugs");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(savedSearchModal.open).toBe(false);
    savedSearchModal.open = true;
    await wrapper.get("button.btn:not(.primary)").trigger("click");
    expect(savedSearchModal.open).toBe(false);
    savedSearchModal.open = true;
    await wrapper.get("button.close").trigger("click");
    expect(savedSearchModal.open).toBe(false);
    savedSearchModal.open = true;
    await wrapper.get(".overlay").trigger("mousedown");
    expect(savedSearchModal.open).toBe(false);
    expect(settings.codeHostingSavedSearches).toEqual({ issues: [], requests: [] });
    expect(searchCodeHosting).not.toHaveBeenCalled();
  });
});

describe("SavedSearchModal, the window Edit the saved search", () => {
  beforeEach(() => {
    settings.codeHostingSavedSearches = {
      issues: [
        { name: "Mine", query: "author:@me" },
        { name: "Bugs", query: "label:bug" },
      ],
      requests: [{ name: "Mine", query: "author:@me is:draft" }],
    };
    openEditSavedSearchModal("issues", "Bugs");
  });

  it("shows the title, the fields Name and Search filled with the saved search, and the buttons Delete, Cancel, and Save", async () => {
    const wrapper = await mountModal();
    expect(wrapper.get("h2").text()).toBe("Edit the saved search");
    expect((wrapper.get("#saved-search-name").element as HTMLInputElement).value).toBe("Bugs");
    expect((wrapper.get("#saved-search-query").element as HTMLInputElement).value).toBe("label:bug");
    expect(wrapper.findAll(".row button").map((button) => button.text())).toEqual(["Delete", "Cancel", "Save"]);
    expect(wrapper.get("[data-saved-search-list]").text()).toBe("Issues");
  });

  it.each([
    ["", "label:bug", "The name is empty."],
    ["Bugs", "   ", "The search is empty."],
    ["Mine", "label:bug", "Another saved search has this name."],
  ])("disables Save and says why for the name %j and the search %j", async (name, query, message) => {
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue(name);
    await wrapper.get("#saved-search-query").setValue(query);
    expect(wrapper.get(".problem").text()).toBe(message);
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeDefined();
  });

  it("allows the saved search to keep its own name", async () => {
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-query").setValue("label:defect");
    expect(wrapper.find(".problem").exists()).toBe(false);
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeUndefined();
  });

  it("saves the new name and the new search, and closes the window", async () => {
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue(" Defects ");
    await wrapper.get("#saved-search-query").setValue(" label:defect ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches.issues).toEqual([
      { name: "Mine", query: "author:@me" },
      { name: "Defects", query: "label:defect" },
    ]);
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Mine", query: "author:@me is:draft" }]);
    expect(savedSearchModal.open).toBe(false);
  });

  it("allows the name of a saved search of the other list", async () => {
    settings.codeHostingSavedSearches.requests = [{ name: "Drafts", query: "is:draft" }];
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Drafts");
    expect(wrapper.find(".problem").exists()).toBe(false);
    expect(wrapper.get("button[type='submit']").attributes("disabled")).toBeUndefined();
  });

  it("edits a saved search of the list of pull requests, and leaves the saved search of the same name in the list of issues", async () => {
    openEditSavedSearchModal("requests", "Mine");
    const wrapper = await mountModal();
    expect(wrapper.get("[data-saved-search-list]").text()).toBe("Pull requests");
    await wrapper.get("#saved-search-query").setValue("is:draft author:eric");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(settings.codeHostingSavedSearches.requests).toEqual([{ name: "Mine", query: "is:draft author:eric" }]);
    expect(settings.codeHostingSavedSearches.issues[0]).toEqual({ name: "Mine", query: "author:@me" });
  });

  it("runs the new search again when the edited saved search was the one that ran", async () => {
    codeHosting.search.issues = "label:bug";
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-query").setValue("label:defect");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(searchCodeHosting).toHaveBeenCalledWith("/work/heidrun", "issues", "label:defect");
  });

  it("does not run the new search when the same search runs in the other list only", async () => {
    codeHosting.search.requests = "label:bug";
    const wrapper = await mountModal();
    await wrapper.get("#saved-search-query").setValue("label:defect");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(searchCodeHosting).not.toHaveBeenCalled();
  });

  it("runs no search when only the name changes, or when the edited saved search did not run", async () => {
    codeHosting.search.issues = "label:bug";
    let wrapper = await mountModal();
    await wrapper.get("#saved-search-name").setValue("Defects");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    wrapper.unmount();
    mountedModals.pop();
    codeHosting.search.issues = "";
    openEditSavedSearchModal("issues", "Mine");
    wrapper = await mountModal();
    await wrapper.get("#saved-search-query").setValue("author:eric");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(searchCodeHosting).not.toHaveBeenCalled();
  });

  it("asks for a confirmation that names the saved search before it deletes it, and keeps it when the answer is no", async () => {
    const wrapper = await mountModal();
    await wrapper.get("button.delete").trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Delete the saved search Bugs?");
    expect(confirmDialog.confirmLabel).toBe("Delete");
    answerConfirm(false);
    await flushPromises();
    expect(settings.codeHostingSavedSearches.issues.map((saved) => saved.name)).toEqual(["Mine", "Bugs"]);
    expect(savedSearchModal.open).toBe(true);
  });

  it("deletes the saved search and closes the window when the answer is yes", async () => {
    const wrapper = await mountModal();
    await wrapper.get("button.delete").trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(settings.codeHostingSavedSearches.issues.map((saved) => saved.name)).toEqual(["Mine"]);
    expect(settings.codeHostingSavedSearches.requests.map((saved) => saved.name)).toEqual(["Mine"]);
    expect(savedSearchModal.open).toBe(false);
  });

  it("deletes the saved search at once, without a confirmation, when the setting Ask before deleting a saved search is off", async () => {
    settings.confirmSavedSearchDelete = false;
    const wrapper = await mountModal();
    await wrapper.get("button.delete").trigger("click");
    await flushPromises();
    expect(confirmDialog.open).toBe(false);
    expect(settings.codeHostingSavedSearches.issues.map((saved) => saved.name)).toEqual(["Mine"]);
    expect(savedSearchModal.open).toBe(false);
  });

  it("closes itself when the saved search does not exist any more", async () => {
    settings.codeHostingSavedSearches = { issues: [], requests: [] };
    await mountModal();
    expect(savedSearchModal.open).toBe(false);
  });
});
