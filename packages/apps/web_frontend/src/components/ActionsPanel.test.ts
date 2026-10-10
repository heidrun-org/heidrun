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

async function mountPanel() {
  const { state } = await import("../stores/session");
  const { project } = await import("../stores/project");
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
});
