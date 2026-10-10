import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the window Agents information, with one finished run in the activity list. */
async function mountAgentsInformationModal() {
  const { state } = await import("../stores/session");
  const { history } = await import("../stores/history");
  const { agentsInformationModal } = await import("../stores/agentsInformation");
  const { default: AgentsInformationModal } = await import("./AgentsInformationModal.vue");
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
  agentsInformationModal.open = true;
  const wrapper = mount(AgentsInformationModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, history, agentsInformationModal };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = "";
});

describe("AgentsInformationModal", () => {
  it("shows the title Agents information", async () => {
    const { wrapper } = await mountAgentsInformationModal();
    expect(wrapper.get('[role="dialog"]').attributes("aria-label")).toBe("Agents information");
    expect(wrapper.get("h2").text()).toBe("Agents information");
    wrapper.unmount();
  });

  it("shows the line Today with the button History, and the list Activity", async () => {
    const { wrapper } = await mountAgentsInformationModal();
    const line = wrapper.get(".hist-line");
    expect(line.text()).toContain("Today");
    expect(line.text()).toContain("History");
    expect(wrapper.get(".act-head").text()).toContain("Activity");
    expect(wrapper.findAll(".act")).toHaveLength(1);
    wrapper.unmount();
  });

  it("opens the window History when the button History is clicked, and keeps this window open below it", async () => {
    const { wrapper, history, agentsInformationModal } = await mountAgentsInformationModal();
    expect(history.open).toBe(false);
    await wrapper.get(".hist-line").trigger("click");
    expect(history.open).toBe(true);
    expect(agentsInformationModal.open).toBe(true);
    wrapper.unmount();
  });

  it("closes the window when the close button is clicked", async () => {
    const { wrapper, agentsInformationModal } = await mountAgentsInformationModal();
    await wrapper.get(".close").trigger("click");
    expect(agentsInformationModal.open).toBe(false);
    wrapper.unmount();
  });

  it("closes the window when the key Escape is pressed", async () => {
    const { wrapper, agentsInformationModal } = await mountAgentsInformationModal();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(agentsInformationModal.open).toBe(false);
    wrapper.unmount();
  });

  it("does not close the window when the key Escape is pressed while the window History is open on top", async () => {
    const { wrapper, history, agentsInformationModal } = await mountAgentsInformationModal();
    history.open = true;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(agentsInformationModal.open).toBe(true);
    wrapper.unmount();
  });
});
