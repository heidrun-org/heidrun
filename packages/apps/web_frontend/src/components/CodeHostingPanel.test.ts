import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { RefContext } from "../lib/refs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../lib/refs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/refs")>();
  return { ...original, refContext: vi.fn() };
});

import CodeHostingPanel from "./CodeHostingPanel.vue";
import { refContext } from "../lib/refs";
import { codeHosting, CODE_HOSTING_LIMIT } from "../stores/code_hosting";
import { git, type GitStatus } from "../stores/git";
import { state } from "../stores/session";
import { settings } from "../stores/settings";

function makeStatus(): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "dev_jerome",
    upstream: "origin/dev_jerome",
    ahead: 0,
    behind: 0,
    changed: 0,
    untracked: 0,
    files: [],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

/** The context of a repository on `forge`. */
function contextOf(forge: "github" | "gitlab", base: string | null = "https://example.com/team/app"): RefContext {
  return { base, origin: "https://example.com", forge, ticketUrl: null, ticketPrefixes: [], enabled: true };
}

/** Answers `gh` with two issues and one pull request, and answers the details of an item that has an open card. */
function answerGithub() {
  vi.mocked(refContext).mockResolvedValue(contextOf("github"));
  vi.mocked(invoke).mockImplementation(async (_command, payload) => {
    const { args } = payload as { args: string[] };
    if (args[1] === "view") {
      return JSON.stringify({
        title: "Add the Code hosting sidebar section",
        state: "OPEN",
        body: "## Problem\n\nThe lists are raw.",
        labels: [{ name: "Design", color: "1d76db" }],
        author: { login: "jeromeetienne" },
        createdAt: "2026-10-13T09:30:00Z",
      });
    }
    return JSON.stringify(
      args[0] === "issue"
        ? [
            {
              number: 370,
              title: "Add the Code hosting sidebar section",
              url: "https://github.com/o/r/issues/370",
              author: { login: "jeromeetienne" },
              createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
              labels: [{ name: "Design", color: "1d76db" }, { name: "Simple Work", color: "2ea043" }],
            },
            { number: 369, title: "Fix the status bar", url: "https://github.com/o/r/issues/369", author: null, labels: [] },
          ]
        : [
            {
              number: 371,
              title: "Move the sidebar",
              url: "https://github.com/o/r/pull/371",
              author: { login: "erictang" },
              createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
              isDraft: true,
              headRefName: "move-the-sidebar-251",
              baseRefName: "dev_jerome",
            },
          ],
    );
  });
}

/** The panels that a test mounted. They stay in the page until `afterEach` unmounts them. */
const mountedPanels: VueWrapper[] = [];

async function mountPanel() {
  state.selectedWorkspaceId = "w1";
  git.status = { w1: makeStatus() };
  const wrapper = mount(CodeHostingPanel, { attachTo: document.body });
  mountedPanels.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(refContext).mockReset();
  vi.mocked(openUrl).mockReset();
  vi.mocked(openUrl).mockResolvedValue(undefined);
  codeHosting.folded.issues = false;
  codeHosting.folded.requests = false;
  codeHosting.search = "";
  settings.codeHostingSavedSearches = [];
});

afterEach(() => {
  for (const wrapper of mountedPanels.splice(0)) {
    wrapper.unmount();
  }
  state.selectedWorkspaceId = null;
  git.status = {};
});

describe("CodeHostingPanel on GitHub", () => {
  it("shows the title, then the list Issues above the list Pull requests, each with its number of items", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    expect(wrapper.get(".title").text()).toBe("Code hosting");
    const headers = wrapper.findAll(".group-header");
    expect(headers.map((header) => header.find(".group-toggle").text())).toEqual(["Issues", "Pull requests"]);
    expect(headers.map((header) => header.get(".count").text())).toEqual(["2", "1"]);
  });

  it("shows one row for each item, with its number and its title on the first line", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const rows = wrapper.findAll("[data-code-hosting-item]");
    expect(rows.map((row) => row.get(".number").text())).toEqual(["#370", "#369", "#371"]);
    expect(rows.map((row) => row.get(".title-text").text())).toEqual([
      "Add the Code hosting sidebar section",
      "Fix the status bar",
      "Move the sidebar",
    ]);
  });

  it("gives every row the same three lines, the number and the title, then two small detail lines, even when a line is empty", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    for (const row of wrapper.findAll("[data-code-hosting-item]")) {
      expect(row.findAll(".item-lines > div").map((line) => line.classes()[0])).toEqual(["title-line", "detail-line", "detail-line"]);
    }
  });

  it("shows, on the two detail lines of an issue, who opened it and when, then its labels or No label", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const rows = wrapper.findAll("[data-code-hosting-item]");
    expect(rows[0].findAll(".detail-line")[0].text()).toBe("jeromeetienne opened 3 days ago");
    expect(rows[0].findAll(".detail-line")[1].findAll(".label-badge")).toHaveLength(2);
    expect(rows[1].findAll(".detail-line").map((line) => line.text())).toEqual(["", "No label"]);
  });

  it("shows each label of an issue as a badge in its color", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const badges = wrapper.findAll("[data-code-hosting-item]")[0].findAll(".label-badge");
    expect(badges.map((badge) => badge.text())).toEqual(["Design", "Simple Work"]);
    expect(badges[0].attributes("style")).toContain("#1d76db");
    expect(badges[1].attributes("style")).toContain("#2ea043");
    expect(wrapper.findAll("[data-code-hosting-item]")[1].find(".label-badge").exists()).toBe(false);
  });

  it("scrolls the title, and not the number, while the pointer is over a row whose title does not fit", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const row = wrapper.findAll("[data-code-hosting-item]")[0];
    const title = row.get(".title-text");
    expect(title.attributes("data-scroll")).toBeDefined();
    expect(row.find(".number").attributes("data-scroll")).toBeUndefined();
    const text = title.element.firstElementChild as HTMLElement;
    Object.defineProperty(text, "scrollWidth", { configurable: true, value: 300 });
    Object.defineProperty(title.element, "clientWidth", { configurable: true, value: 100 });
    await row.trigger("pointerenter");
    expect(title.classes()).toContain("is-scrolling");
    expect((title.element as HTMLElement).style.getPropertyValue("--scroll-distance")).toBe("200px");
    await row.trigger("pointerleave");
    expect(title.classes()).not.toContain("is-scrolling");
  });

  it("shows, on the two detail lines of a pull request, who opened it and when with the draft mark, then its two branches", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const row = wrapper.findAll("[data-code-hosting-item]")[2];
    expect(row.findAll(".detail-line").map((line) => line.text())).toEqual([
      "erictang opened 2 hours ago · Draft",
      "move-the-sidebar-251 → dev_jerome",
    ]);
  });

  it("shows no button in a row: the whole row is the part that opens the information card", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    expect(wrapper.findAll("[data-code-hosting-item]")).toHaveLength(3);
    expect(wrapper.findAll("[data-code-hosting-item] button")).toHaveLength(0);
    expect(wrapper.findAll("[data-code-hosting-item] i")).toHaveLength(0);
  });

  it("opens the web page of the item in the web browser from the button Open in GitHub of the information card", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".information-card-part")[2].trigger("click");
    await flushPromises();
    await wrapper.get(".popover button[aria-label='Open in GitHub']").trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://github.com/o/r/pull/371");
  });

  it("gives each row a full-width part with the class row-card, which has no padding of its own", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const parts = wrapper.findAll(".items .row-card");
    expect(parts).toHaveLength(3);
    expect(parts.every((part) => part.classes().includes("information-card-part"))).toBe(true);
  });

  it("does not open the web page after a click on the row, and opens an information card at the right of the row", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".information-card-part")[0].trigger("click");
    await flushPromises();
    expect(openUrl).not.toHaveBeenCalled();
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-end");
    expect(card.attributes("aria-label")).toBe("Details of #370");
  });

  it("reads the details of the item from the forge when the card opens, and shows the repository, the date, the state, the description, the labels, and the author", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".information-card-part")[0].trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find(([, payload]) => (payload as { args: string[] }).args[1] === "view");
    expect(call?.[0]).toBe("forge_cli_cached");
    expect(call?.[1]).toMatchObject({
      cwd: "/work/heidrun",
      tool: "gh",
      args: ["issue", "view", "370", "--json", "title,state,body,labels,author,createdAt"],
    });
    const card = wrapper.get(".popover").text();
    expect(card).toContain("team/app on Oct 13");
    expect(card).toContain("Open");
    expect(card).toContain("The lists are raw.");
    expect(card).toContain("Design");
    expect(card).toContain("jeromeetienne opened this issue");
  });

  it("reads a pull request with gh pr view when its card opens", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".information-card-part")[2].trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find(([, payload]) => (payload as { args: string[] }).args[1] === "view");
    expect(call?.[1]).toMatchObject({ args: expect.arrayContaining(["pr", "view", "371"]) });
  });

  it("folds and unfolds a list after a click on its header, and keeps the other list", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const toggle = wrapper.findAll(".group-toggle")[0];
    expect(toggle.attributes("aria-expanded")).toBe("true");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(wrapper.findAll(".item")).toHaveLength(1);
    await toggle.trigger("click");
    expect(wrapper.findAll(".item")).toHaveLength(3);
  });

  it("reads the lists again, without the cache, after a click on the refresh button", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([false, false]);
    await wrapper.get("button[aria-label=Refresh]").trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(vi.mocked(invoke).mock.calls.slice(2).map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([true, true]);
  });

  it("says that a list is empty, and shows no row for it", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockResolvedValue("[]");
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".item")).toHaveLength(0);
    expect(wrapper.findAll(".empty").map((text) => text.text())).toEqual(["No open issue.", "No open pull request."]);
  });

  it("warns that a list may hold more items when it reaches the limit", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    const many = Array.from({ length: CODE_HOSTING_LIMIT }, (_, index) => ({
      number: index + 1,
      title: `Issue ${index + 1}`,
      url: `https://github.com/o/r/issues/${index + 1}`,
    }));
    vi.mocked(invoke).mockImplementation(async (_command, payload) =>
      JSON.stringify((payload as { args: string[] }).args[0] === "issue" ? many : []),
    );
    const wrapper = await mountPanel();
    expect(wrapper.text()).toContain("The list is too long: only the first 100 are shown.");
  });
});

describe("CodeHostingPanel on GitLab", () => {
  it("names the second list Merge requests, and writes ! before the number of a merge request", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[1].startsWith("projects/:fullpath/issues")
          ? [{ iid: 12, title: "An issue", web_url: "https://gitlab.com/t/a/-/issues/12", author: { username: "jerome" }, labels: [{ name: "bug", color: "#d73a4a" }] }]
          : [
              {
                iid: 5,
                title: "A merge request",
                web_url: "https://gitlab.com/t/a/-/merge_requests/5",
                author: { username: "eric" },
                source_branch: "fix-5",
                target_branch: "main",
              },
            ],
      );
    });
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".group-toggle").map((toggle) => toggle.text())).toEqual(["Issues", "Merge requests"]);
    expect(wrapper.findAll(".item .number").map((number) => number.text())).toEqual(["#12", "!5"]);
    expect(wrapper.findAll(".item-lines").map((lines) => lines.findAll(".detail-line")[1].text())).toEqual(["bug", "fix-5 → main"]);
    expect(wrapper.get(".label-badge").attributes("style")).toContain("#d73a4a");
    await wrapper.findAll(".information-card-part")[1].trigger("click");
    await flushPromises();
    await wrapper.get(".popover button[aria-label='Open in GitLab']").trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://gitlab.com/t/a/-/merge_requests/5");
  });
});

describe("CodeHostingPanel without lists", () => {
  it("asks to select a workspace when none is selected", async () => {
    state.selectedWorkspaceId = null;
    const wrapper = mount(CodeHostingPanel);
    await flushPromises();
    expect(wrapper.text()).toBe("Select a workspace.");
  });

  it("says that the workspace is not a Git repository when Git has no status for it", async () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: null };
    const wrapper = mount(CodeHostingPanel);
    await flushPromises();
    expect(wrapper.text()).toBe("This workspace is not a Git repository.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says that the repository is not on GitHub or GitLab when it has no remote address", async () => {
    vi.mocked(refContext).mockResolvedValue({ ...contextOf("github"), base: null, forge: null });
    const wrapper = await mountPanel();
    expect(wrapper.text()).toContain("This repository has no remote address, so it is not on GitHub or GitLab.");
    expect(wrapper.find(".group").exists()).toBe(false);
  });

  it("shows the failure of gh or glab instead of the lists", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockRejectedValue("gh: not logged in");
    const wrapper = await mountPanel();
    expect(wrapper.get(".failure").text()).toBe("gh: not logged in");
    expect(wrapper.find(".group").exists()).toBe(false);
  });
});

/** The searches that `gh` received, in order: the text after `--search` of each call of `gh issue list`. */
function issueSearches(): (string | null)[] {
  return vi
    .mocked(invoke)
    .mock.calls.map(([, payload]) => (payload as { args: string[] }).args)
    .filter((args) => args[0] === "issue" && args[1] === "list")
    .map((args) => (args.includes("--search") ? args[args.indexOf("--search") + 1] : null));
}

/** Answers `gh` with one issue for the search "label:bug", and with none for every other search. */
function answerSearches() {
  vi.mocked(refContext).mockResolvedValue(contextOf("github"));
  vi.mocked(invoke).mockImplementation(async (_command, payload) => {
    const { args } = payload as { args: string[] };
    const search = args.includes("--search") ? args[args.indexOf("--search") + 1] : null;
    if (args[0] === "issue" && (search === null || search === "label:bug")) {
      return JSON.stringify([{ number: 7, title: "A bug", url: "https://github.com/o/r/issues/7", author: { login: "eric" } }]);
    }
    return "[]";
  });
}

/** Writes a text in the search field and presses the key Enter. */
async function search(wrapper: Awaited<ReturnType<typeof mountPanel>>, text: string) {
  await wrapper.get("form.search input").setValue(text);
  await wrapper.get("form.search").trigger("submit");
  await flushPromises();
}

describe("CodeHostingPanel searches", () => {
  it("shows a search field above the two lists, and no line of saved searches while there is none", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    const field = wrapper.get("form.search input");
    expect(field.attributes("placeholder")).toBe("Search");
    expect(field.attributes("title")).toBe("Write a search, for example: author:@me label:bug");
    expect(wrapper.get("form.search").element.compareDocumentPosition(wrapper.get(".groups").element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(wrapper.find(".saved").exists()).toBe(false);
  });

  it("runs the search when the key Enter is pressed, and shows the items that gh gives for it", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    expect(wrapper.findAll("[data-code-hosting-item]")).toHaveLength(1);
    await search(wrapper, "  label:other  ");
    expect(issueSearches()).toEqual([null, "label:other"]);
    expect(codeHosting.search).toBe("label:other");
    expect(wrapper.findAll("[data-code-hosting-item]")).toHaveLength(0);
    expect(wrapper.findAll(".group-header").map((header) => header.get(".count").text())).toEqual(["0", "0"]);
  });

  it("says that no item matches the search, instead of No open issue, while a search runs", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await search(wrapper, "label:other");
    expect(wrapper.findAll(".empty").map((line) => line.text())).toEqual([
      "No issue matches the search.",
      "No pull request matches the search.",
    ]);
    await search(wrapper, "");
    await wrapper.get("form.search input").setValue("");
    expect(wrapper.findAll(".empty").map((line) => line.text())).toEqual(["No open pull request."]);
  });

  it("keeps the search field and the search in place when the list is refreshed", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await search(wrapper, "label:bug");
    vi.mocked(invoke).mockClear();
    await wrapper.get("header button").trigger("click");
    await flushPromises();
    expect(issueSearches()).toEqual(["label:bug"]);
    expect((wrapper.get("form.search input").element as HTMLInputElement).value).toBe("label:bug");
  });

  it("asks the name of a new saved search, keeps the saved search, and shows it as a button", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    expect(wrapper.get("button[aria-label='Save this search']").attributes("disabled")).toBeDefined();
    await wrapper.get("form.search input").setValue("label:bug");
    await wrapper.get("button[aria-label='Save this search']").trigger("click");
    const nameField = wrapper.get("form.saving input");
    expect(document.activeElement).toBe(nameField.element);
    expect(wrapper.get("form.saving button[type='submit']").attributes("disabled")).toBeDefined();
    await nameField.setValue("Bugs");
    await wrapper.get("form.saving").trigger("submit");
    expect(settings.codeHostingSavedSearches).toEqual([{ name: "Bugs", query: "label:bug" }]);
    expect(wrapper.find("form.saving").exists()).toBe(false);
    expect(wrapper.findAll(".saved-button").map((button) => button.text())).toEqual(["All", "Bugs"]);
  });

  it("keeps nothing when the row of the name is cancelled with the key Escape or with its cross", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await wrapper.get("form.search input").setValue("label:bug");
    await wrapper.get("button[aria-label='Save this search']").trigger("click");
    await wrapper.get("form.saving input").setValue("Bugs");
    await wrapper.get("form.saving input").trigger("keydown.esc");
    expect(wrapper.find("form.saving").exists()).toBe(false);
    await wrapper.get("button[aria-label='Save this search']").trigger("click");
    await wrapper.get("form.saving button[aria-label='Cancel']").trigger("click");
    expect(wrapper.find("form.saving").exists()).toBe(false);
    expect(settings.codeHostingSavedSearches).toEqual([]);
  });

  it("fills the search field and runs the search at a click on a saved search, and runs no search at a click on All", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = [
      { name: "Bugs", query: "label:bug" },
      { name: "Mine", query: "author:@me" },
    ];
    const wrapper = await mountPanel();
    const buttons = wrapper.findAll(".saved-button");
    expect(buttons.map((button) => button.text())).toEqual(["All", "Bugs", "Mine"]);
    expect(buttons[1].attributes("title")).toBe("label:bug");
    await buttons[2].trigger("click");
    await flushPromises();
    expect((wrapper.get("form.search input").element as HTMLInputElement).value).toBe("author:@me");
    await wrapper.findAll(".saved-button")[0].trigger("click");
    await flushPromises();
    expect((wrapper.get("form.search input").element as HTMLInputElement).value).toBe("");
    expect(issueSearches()).toEqual([null, "author:@me", null]);
  });

  it("marks the saved search that runs now, and All when no search runs", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = [{ name: "Bugs", query: "label:bug" }];
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".saved-button").map((button) => button.attributes("aria-pressed"))).toEqual(["true", "false"]);
    await wrapper.findAll(".saved-button")[1].trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".saved-button").map((button) => button.attributes("aria-pressed"))).toEqual(["false", "true"]);
    expect(wrapper.findAll(".saved-button")[1].classes()).toContain("active");
  });

  it("shows the name, the search, and a button to delete for each saved search while the pencil is pressed", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = [
      { name: "Bugs", query: "label:bug" },
      { name: "Mine", query: "author:@me" },
    ];
    const wrapper = await mountPanel();
    expect(wrapper.find("[data-editing-row]").exists()).toBe(false);
    await wrapper.get("[data-edit-saved-searches]").trigger("click");
    const rows = wrapper.findAll("[data-editing-row]");
    expect(rows.map((row) => row.findAll("input").map((input) => (input.element as HTMLInputElement).value))).toEqual([
      ["Bugs", "label:bug"],
      ["Mine", "author:@me"],
    ]);
    await wrapper.get("[data-edit-saved-searches]").trigger("click");
    expect(wrapper.find("[data-editing-row]").exists()).toBe(false);
  });

  it("renames a saved search and changes its search from the fields of its row", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = [{ name: "Bugs", query: "label:bug" }];
    const wrapper = await mountPanel();
    await wrapper.get("[data-edit-saved-searches]").trigger("click");
    const [nameField, queryField] = wrapper.get("[data-editing-row]").findAll("input");
    await nameField.setValue("Defects");
    await nameField.trigger("change");
    await queryField.setValue("label:defect");
    await queryField.trigger("change");
    expect(settings.codeHostingSavedSearches).toEqual([{ name: "Defects", query: "label:defect" }]);
    expect(wrapper.findAll(".saved-button").map((button) => button.text())).toEqual(["All", "Defects"]);
  });

  it("puts the old text back in a field when the change is not valid: an empty text, or the name of another saved search", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = [
      { name: "Bugs", query: "label:bug" },
      { name: "Mine", query: "author:@me" },
    ];
    const wrapper = await mountPanel();
    await wrapper.get("[data-edit-saved-searches]").trigger("click");
    const [nameField, queryField] = wrapper.get("[data-editing-row]").findAll("input");
    await nameField.setValue("Mine");
    await nameField.trigger("change");
    await queryField.setValue("   ");
    await queryField.trigger("change");
    expect(settings.codeHostingSavedSearches[0]).toEqual({ name: "Bugs", query: "label:bug" });
    expect((nameField.element as HTMLInputElement).value).toBe("Bugs");
    expect((queryField.element as HTMLInputElement).value).toBe("label:bug");
  });

  it("deletes a saved search with the button of its row", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = [
      { name: "Bugs", query: "label:bug" },
      { name: "Mine", query: "author:@me" },
    ];
    const wrapper = await mountPanel();
    await wrapper.get("[data-edit-saved-searches]").trigger("click");
    await wrapper.get("button[aria-label='Delete the saved search Bugs']").trigger("click");
    expect(settings.codeHostingSavedSearches).toEqual([{ name: "Mine", query: "author:@me" }]);
    expect(wrapper.findAll(".saved-button").map((button) => button.text())).toEqual(["All", "Mine"]);
  });

  it("shows the message of GitLab for a word that it cannot do, and keeps the search field", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockResolvedValue("[]");
    const wrapper = await mountPanel();
    await search(wrapper, "mentions:@me");
    expect(wrapper.get(".failure").text()).toBe("GitLab cannot do this search: mentions:@me");
    expect(wrapper.find(".group").exists()).toBe(false);
    expect((wrapper.get("form.search input").element as HTMLInputElement).value).toBe("mentions:@me");
  });

  it("shows no search field for a repository without a remote address", async () => {
    vi.mocked(refContext).mockResolvedValue({ ...contextOf("github"), base: null, forge: null });
    const wrapper = await mountPanel();
    expect(wrapper.find("form.search").exists()).toBe(false);
  });
});
