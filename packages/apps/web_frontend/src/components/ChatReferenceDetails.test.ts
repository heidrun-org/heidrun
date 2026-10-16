import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import ChatReferenceDetails from "./ChatReferenceDetails.vue";
import type { ChatReferenceDetails as Details } from "../stores/chat_references";
import { settings } from "../stores/settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

enableAutoUnmount(afterEach);

const BASE = "https://github.com/heidrun-org/heidrun";

/** The answer of the forge for an open issue that has a description and one label. */
function detailsOf(changes: Partial<Details> = {}): Details {
  return {
    title: "Add an information card",
    rawState: "open",
    body: "Intent\n\nEvery option has a card.",
    labels: [{ name: "Design", color: "1d76db" }],
    author: "jeromeetienne",
    authorAvatarUrl: null,
    createdAt: Date.parse("2026-10-16T09:30:00Z"),
    headBranch: null,
    baseBranch: null,
    ...changes,
  };
}

/** Mounts the card details of an issue, with the answer of the forge and the whole title. */
function mountDetails(props: Partial<InstanceType<typeof ChatReferenceDetails>["$props"]> = {}) {
  return mount(ChatReferenceDetails, {
    attachTo: document.body,
    props: {
      reference: { kind: "issue", number: 608, url: `${BASE}/issues/608` },
      details: detailsOf(),
      folder: "/work/heidrun",
      forge: "github",
      webBase: BASE,
      title: "Add an information card with a circled question mark to every option of the Settings window",
      name: "#608",
      ...props,
    },
  });
}

beforeEach(() => {
  settings.language = "en";
  vi.mocked(openUrl).mockClear();
});

describe("ChatReferenceDetails, the repository line", () => {
  it("shows the name of the repository and the date of the creation on the first line", () => {
    const wrapper = mountDetails();
    expect(wrapper.get("[data-reference-repository-line]").text()).toBe("heidrun-org/heidrun on Oct 16");
  });

  it("makes the name of the repository a link to its web page, which opens in the web browser", async () => {
    const wrapper = mountDetails();
    const link = wrapper.get("[data-reference-repository-line] a");
    expect(link.text()).toBe("heidrun-org/heidrun");
    expect(link.attributes("href")).toBe(BASE);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(BASE);
  });

  it("puts the two buttons that open the item at the right of the same line", () => {
    const wrapper = mountDetails();
    const line = wrapper.get("[data-reference-repository-line]").element.parentElement as HTMLElement;
    expect(line.querySelector(".btn-group")).not.toBeNull();
    expect(Array.from(line.querySelectorAll(".btn-group button")).map((button) => button.getAttribute("title"))).toEqual([
      "Open in Heidrun",
      "Open in GitHub",
    ]);
    expect((wrapper.element as HTMLElement).firstElementChild).toBe(line);
  });

  it("shows no link, and keeps the two buttons, when the address of the repository is not known", () => {
    const wrapper = mountDetails({ webBase: null });
    expect(wrapper.find("[data-reference-repository-line] a").exists()).toBe(false);
    expect(wrapper.findAll(".btn-group button")).toHaveLength(2);
  });

  it("shows the name of the repository alone while the forge has not given the date", () => {
    const wrapper = mountDetails({ details: undefined });
    expect(wrapper.get("[data-reference-repository-line]").text()).toBe("heidrun-org/heidrun");
  });
});

describe("ChatReferenceDetails, the title", () => {
  it("shows the whole title, then its number, under the repository line", () => {
    const wrapper = mountDetails();
    const title = wrapper.get("[data-reference-title]");
    expect(title.text()).toBe("Add an information card with a circled question mark to every option of the Settings window #608");
    expect(title.find("[data-scroll]").exists()).toBe(false);
    expect(wrapper.get("[data-reference-repository-line]").element.parentElement?.nextElementSibling).toBe(title.element);
  });

  it("shows no title when the row above the card already shows it", () => {
    const wrapper = mountDetails({ title: null, name: null });
    expect(wrapper.find("[data-reference-title]").exists()).toBe(false);
  });

  it("shows the title without a number when no number is given", () => {
    const wrapper = mountDetails({ title: "Only a title", name: null });
    expect(wrapper.get("[data-reference-title]").text()).toBe("Only a title");
  });
});

describe("ChatReferenceDetails, the state", () => {
  it("shows the state under the title, in a pill with a strong green for an open issue", () => {
    const wrapper = mountDetails();
    const pill = wrapper.get(".badge.state");
    expect(pill.text()).toBe("Open");
    expect(pill.classes()).toContain("state-open");
    expect(wrapper.get("[data-reference-title]").element.nextElementSibling).toBe(pill.element);
  });

  it("shows a closed pull request in red, and a merged pull request in purple", () => {
    const reference = { kind: "pull_request" as const, number: 5, url: `${BASE}/pull/5` };
    expect(mountDetails({ reference, details: detailsOf({ rawState: "closed" }) }).get(".badge.state").classes()).toContain("state-closed");
    expect(mountDetails({ reference, details: detailsOf({ rawState: "merged" }) }).get(".badge.state").classes()).toContain("state-done");
  });

  it("shows no pill while the forge has not answered", () => {
    expect(mountDetails({ details: undefined }).find(".badge.state").exists()).toBe(false);
    expect(mountDetails({ details: null }).find(".badge.state").exists()).toBe(false);
  });
});

describe("ChatReferenceDetails, the separators and the body", () => {
  it("shows, in this order, the repository line, the title, the state, a separator, the description, the labels, a separator, and the author", () => {
    const wrapper = mountDetails();
    const parts = Array.from((wrapper.element as HTMLElement).children).map((part) => {
      if (part.hasAttribute("data-reference-title")) {
        return "title";
      }
      if (part.classList.contains("badge")) {
        return "state";
      }
      if (part.classList.contains("separator")) {
        return "separator";
      }
      if (part.classList.contains("excerpt")) {
        return "description";
      }
      if (part.querySelector(".label") !== null) {
        return "labels";
      }
      if (part.textContent?.includes("opened this issue") === true) {
        return "author";
      }
      return "line";
    });
    expect(parts).toEqual(["line", "title", "state", "separator", "description", "labels", "separator", "author"]);
  });

  it("shows the beginning of the description, and the labels in their colors", () => {
    const wrapper = mountDetails();
    expect(wrapper.get(".excerpt").text()).toContain("Every option has a card.");
    expect(wrapper.get(".label").text()).toBe("Design");
    expect(wrapper.get(".label").attributes("style")).toContain("#1d76db");
  });

  it("shows the two branches of a pull request in place of the labels", () => {
    const wrapper = mountDetails({
      reference: { kind: "pull_request", number: 5, url: `${BASE}/pull/5` },
      details: detailsOf({ headBranch: "fix-5", baseBranch: "dev_jerome" }),
    });
    expect(wrapper.findAll(".branch").map((branch) => branch.text())).toEqual(["dev_jerome", "fix-5"]);
    expect(wrapper.find(".label").exists()).toBe(false);
    expect(wrapper.text()).toContain("jeromeetienne opened this pull request");
  });

  it("shows the login of the person who opened it, and never the word You", () => {
    const wrapper = mountDetails();
    expect(wrapper.text()).toContain("jeromeetienne opened this issue");
    expect(wrapper.text()).not.toContain("You opened");
  });

  it("shows one separator and no author while the forge has not answered, and Loading under it", () => {
    const wrapper = mountDetails({ details: undefined });
    expect(wrapper.findAll(".separator")).toHaveLength(1);
    expect(wrapper.text()).toContain("Reading from GitHub");
  });

  it("shows one separator, and that the forge cannot be read, when the forge did not answer", () => {
    const wrapper = mountDetails({ details: null });
    expect(wrapper.findAll(".separator")).toHaveLength(1);
    expect(wrapper.text()).toContain("GitHub");
  });

  it("shows no second separator when the person who opened it is not known", () => {
    const wrapper = mountDetails({ details: detailsOf({ author: null }) });
    expect(wrapper.findAll(".separator")).toHaveLength(1);
  });
});

describe("ChatReferenceDetails, the labels as buttons", () => {
  const TWO_LABELS = [
    { name: "enhancement", color: "a2eeef" },
    { name: "Simple Work", color: "2ea043" },
  ];

  it("shows each label as a pill that is not a button when no search is given", () => {
    const wrapper = mountDetails({ details: detailsOf({ labels: TWO_LABELS }) });
    const labels = wrapper.findAll("[data-reference-label]");
    expect(labels.map((label) => label.text())).toEqual(["enhancement", "Simple Work"]);
    expect(labels.every((label) => label.element.tagName === "SPAN")).toBe(true);
  });

  it("shows each label as a button when a search is given, and tells the label that the search holds", () => {
    const wrapper = mountDetails({ details: detailsOf({ labels: TWO_LABELS }), search: "label:enhancement" });
    const labels = wrapper.findAll("[data-reference-label]");
    expect(labels.every((label) => label.element.tagName === "BUTTON")).toBe(true);
    expect(labels.map((label) => label.attributes("aria-pressed"))).toEqual(["true", "false"]);
  });

  it("asks to toggle the label that was clicked, with its name", async () => {
    const wrapper = mountDetails({ details: detailsOf({ labels: TWO_LABELS }), search: "" });
    await wrapper.findAll("[data-reference-label]")[1].trigger("click");
    expect(wrapper.emitted("toggleLabel")).toEqual([["Simple Work"]]);
  });
});
