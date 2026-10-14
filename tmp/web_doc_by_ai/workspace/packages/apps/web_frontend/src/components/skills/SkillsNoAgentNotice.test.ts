import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { prepare } from "./skills_test_support";

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

describe("SkillsNoAgentNotice", () => {
  it("tells the user to switch an agent on, and closes the windows of the skills, and opens the section Agents of the Settings window", async () => {
    await prepare(invoke);
    const { default: SkillsNoAgentNotice } = await import("./SkillsNoAgentNotice.vue");
    const wrapper = mount(SkillsNoAgentNotice);
    expect(wrapper.text()).toContain("No coding agent is switched on");
    const { settingsModal } = await import("../../stores/settings");
    const { findNewSkillsModal, installedSkillModal } = await import("../../stores/skills");
    findNewSkillsModal.open = true;
    installedSkillModal.open = true;
    await wrapper.get("button").trigger("click");
    expect(findNewSkillsModal.open).toBe(false);
    expect(installedSkillModal.open).toBe(false);
    expect(settingsModal.open).toBe(true);
    expect(settingsModal.section).toBe("agents");
  });
});
