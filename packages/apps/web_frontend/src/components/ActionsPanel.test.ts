import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

async function mountPanel(options: { recentCommands?: string[] } = {}) {
  const { state } = await import("../stores/session");
  const { project, local } = await import("../stores/project");
  const { default: ActionsPanel } = await import("./ActionsPanel.vue");
  state.selectedWorkspaceId = "w1";
  project.byWorkspace["w1"] = {
    root: "/Users/me/webwork/heidrun",
    config_path: "/Users/me/webwork/heidrun/.heidrun/config.json",
    config: {
      version: 1,
      actions: [{ id: "dev", label: "start the server", command: "make dev" }],
    },
    detected: [
      { label: "pnpm install", command: "pnpm install", source: "package.json" },
      { label: "pnpm dev", command: "pnpm dev", source: "package.json" },
    ],
  } as never;
  local.recent["/Users/me/webwork/heidrun"] = (options.recentCommands ?? []).map((command) => ({
    label: command,
    command,
    at: Date.now(),
  }));
  const wrapper = mount(ActionsPanel);
  await flushPromises();
  return wrapper;
}

describe("ActionsPanel", () => {
  it("shows the section Custom Scripts first, then the section Existing Scripts", async () => {
    const wrapper = await mountPanel();
    const headings = wrapper.findAll(".section-head").map((heading) => heading.text());
    expect(headings).toEqual(["Custom Scripts", "Existing Scripts"]);
    expect(wrapper.text()).toContain("start the server");
    expect(wrapper.text()).toContain("pnpm install");
  });

  it("does not use the words Actions or Suggestions", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toMatch(/action/i);
    expect(wrapper.text()).not.toMatch(/suggestion/i);
    expect(wrapper.text()).toContain("Scripts · ");
  });

  it("does not show the path of the configuration file", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toContain("config.json");
    expect(wrapper.find(".path").exists()).toBe(false);
  });

  it("has no drag and drop and no drag handle", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toContain("Drag to reorder");
    expect(wrapper.find(".grip").exists()).toBe(false);
    expect(wrapper.findAll("[draggable]")).toHaveLength(0);
  });

  it("folds and unfolds the section Custom Scripts", async () => {
    const wrapper = await mountPanel();
    const heading = wrapper.findAll(".section-head")[0];
    expect(heading.attributes("aria-expanded")).toBe("true");

    await heading.trigger("click");
    expect(wrapper.findAll(".section-head")[0].attributes("aria-expanded")).toBe("false");
    expect(wrapper.text()).not.toContain("start the server");
    expect(wrapper.text()).toContain("pnpm install");

    await wrapper.findAll(".section-head")[0].trigger("click");
    expect(wrapper.findAll(".section-head")[0].attributes("aria-expanded")).toBe("true");
    expect(wrapper.text()).toContain("start the server");
  });

  it("folds and unfolds the section Existing Scripts", async () => {
    const wrapper = await mountPanel();
    const heading = wrapper.findAll(".section-head")[1];
    expect(heading.attributes("aria-expanded")).toBe("true");

    await heading.trigger("click");
    expect(wrapper.findAll(".section-head")[1].attributes("aria-expanded")).toBe("false");
    expect(wrapper.text()).not.toContain("pnpm install");
    expect(wrapper.text()).toContain("start the server");

    await wrapper.findAll(".section-head")[1].trigger("click");
    expect(wrapper.text()).toContain("pnpm install");
  });

  it("has a plus button on the line of the heading Custom Scripts, after the heading", async () => {
    const wrapper = await mountPanel();
    const row = wrapper.get(".section-row");
    const children = Array.from(row.element.children);
    expect(children).toHaveLength(2);
    expect(children[0].classList.contains("section-head")).toBe(true);
    const plus = wrapper.get(".section-row .create");
    expect(children[1]).toBe(plus.element);
    expect(plus.text()).toBe("+");
    expect(plus.attributes("title")).toBe("Create a custom script");
    expect(plus.attributes("aria-label")).toBe("Create a custom script");
  });

  it("opens the window Create a custom script when the person clicks the plus button", async () => {
    const wrapper = await mountPanel();
    const { newCustomScriptModal } = await import("../stores/newCustomScript");
    expect(newCustomScriptModal.open).toBe(false);
    await wrapper.get(".section-row .create").trigger("click");
    expect(newCustomScriptModal.open).toBe(true);
  });

  it("keeps the plus button when the section Custom Scripts is folded", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".section-head")[0].trigger("click");
    expect(wrapper.find(".section-row .create").exists()).toBe(true);
  });

  it("has no dashed button and no form inside the tab: the window replaces them", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toContain("Add a script");
    expect(wrapper.find(".dashed").exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("shows the section Recent between the two other sections, when a command was run", async () => {
    const wrapper = await mountPanel({ recentCommands: ["pnpm build"] });
    const headings = wrapper.findAll(".section-head").map((heading) => heading.text());
    expect(headings).toEqual(["Custom Scripts", "Recent", "Existing Scripts"]);
    expect(wrapper.text()).toContain("pnpm build");
  });

  it("does not show the section Recent when no command was run", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".section-head").map((heading) => heading.text())).not.toContain("Recent");
  });

  it("folds and unfolds the section Recent", async () => {
    const wrapper = await mountPanel({ recentCommands: ["pnpm build"] });
    const recentHeading = () => wrapper.findAll(".section-head")[1];
    expect(recentHeading().attributes("aria-expanded")).toBe("true");

    await recentHeading().trigger("click");
    expect(recentHeading().attributes("aria-expanded")).toBe("false");
    expect(wrapper.text()).not.toContain("pnpm build");
    expect(wrapper.text()).toContain("start the server");
    expect(wrapper.text()).toContain("pnpm install");

    await recentHeading().trigger("click");
    expect(recentHeading().attributes("aria-expanded")).toBe("true");
    expect(wrapper.text()).toContain("pnpm build");
  });

  it("shows the button that clears the recent commands as an icon, without text, on the line of the heading", async () => {
    const wrapper = await mountPanel({ recentCommands: ["pnpm build"] });
    const clear = wrapper.get(".section-row .clear");
    expect(clear.text()).toBe("");
    expect(clear.find("i.bi-trash").exists()).toBe(true);
    expect(clear.attributes("aria-label")).toBe("Clear the recent commands");
    expect(clear.attributes("title")).toBe("Clear the recent commands");
    const row = clear.element.parentElement!;
    expect(row.children[0].classList.contains("section-head")).toBe(true);
    expect(row.children[1]).toBe(clear.element);
    expect(wrapper.text()).not.toContain("Clear");
  });

  it("keeps the button that clears the recent commands when the section Recent is folded", async () => {
    const wrapper = await mountPanel({ recentCommands: ["pnpm build"] });
    await wrapper.findAll(".section-head")[1].trigger("click");
    expect(wrapper.find(".section-row .clear").exists()).toBe(true);
  });

  it("removes the section Recent when the person clicks the button that clears the recent commands", async () => {
    const wrapper = await mountPanel({ recentCommands: ["pnpm build", "sleep 5"] });
    await wrapper.get(".section-row .clear").trigger("click");
    expect(wrapper.text()).not.toContain("pnpm build");
    expect(wrapper.text()).not.toContain("sleep 5");
    expect(wrapper.findAll(".section-head").map((heading) => heading.text())).toEqual(["Custom Scripts", "Existing Scripts"]);
  });
});
