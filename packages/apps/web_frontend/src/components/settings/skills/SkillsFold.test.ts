import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("SkillsFold", () => {
  async function mountFold(open: boolean) {
    const { default: SkillsFold } = await import("./SkillsFold.vue");
    return mount(SkillsFold, { props: { open, heading: "Heading" }, slots: { default: "<p class='content'>Content</p>" } });
  }

  it("shows the heading and the content when it is open", async () => {
    const wrapper = await mountFold(true);
    expect(wrapper.get(".fold").text()).toBe("Heading");
    expect(wrapper.get(".fold").attributes("aria-expanded")).toBe("true");
    expect(wrapper.find(".content").exists()).toBe(true);
  });

  it("hides the content when it is closed", async () => {
    const wrapper = await mountFold(false);
    expect(wrapper.get(".fold").attributes("aria-expanded")).toBe("false");
    expect(wrapper.find(".content").exists()).toBe(false);
  });

  it("asks to change the state when the heading is clicked, and does not change it itself", async () => {
    const wrapper = await mountFold(true);
    await wrapper.get(".fold").trigger("click");
    expect(wrapper.emitted("toggle")).toHaveLength(1);
    expect(wrapper.find(".content").exists()).toBe(true);
  });
});
