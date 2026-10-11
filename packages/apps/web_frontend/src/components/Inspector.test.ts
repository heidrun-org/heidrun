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

describe("Inspector", () => {
  it("does not show the section All agents, even when there is activity: the window Agents information shows it", async () => {
    const { state } = await import("../stores/session");
    const { default: Inspector } = await import("./Inspector.vue");
    state.activity = [
      {
        id: 1,
        paneId: "w1:p1",
        start: Date.now() - 120_000,
        end: Date.now() - 60_000,
        status: "done",
        startUnknown: false,
        name: "teamwright",
        kind: "Codex",
        workspace: "heidrun",
        tab: "Codex",
      },
    ];
    const wrapper = mount(Inspector);
    await flushPromises();
    expect(wrapper.find("#sec-global").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("All agents");
    expect(wrapper.text()).not.toContain("History");
    expect(wrapper.text()).not.toContain("Activity");
  });
});
