import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsAgentsSection } = await import("./SettingsAgentsSection.vue");
  // The click on a label reaches its switch only when the label is in the page.
  return { wrapper: mount(SettingsAgentsSection, { attachTo: document.body }), settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SettingsAgentsSection", () => {
  it("lists Claude Code and Codex, one Bootstrap list group row for each", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find(".list-group").exists()).toBe(true);
    expect(wrapper.findAll(".list-group-item").map((row) => row.text())).toEqual(["Claude Code", "Codex"]);
  });

  it("starts with every agent switched off", async () => {
    const { wrapper, settings } = await mountSection();
    expect(settings.ownedAgents).toEqual([]);
    expect(wrapper.findAll(".list-group input[role=switch]").map((node) => (node.element as HTMLInputElement).checked)).toEqual([false, false]);
  });

  it("draws each switch with the Bootstrap class switch", async () => {
    const { wrapper } = await mountSection();
    for (const switchInput of wrapper.findAll("input[role=switch]")) {
      expect(switchInput.element.parentElement?.classList.contains("switch")).toBe(true);
    }
  });

  it("switches an agent on and off", async () => {
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll("input[role=switch]")[1].setValue(true);
    expect(settings.ownedAgents).toEqual(["codex"]);
    await wrapper.findAll("input[role=switch]")[0].setValue(true);
    expect(settings.ownedAgents).toEqual(["codex", "claude"]);
    await wrapper.findAll("input[role=switch]")[1].setValue(false);
    expect(settings.ownedAgents).toEqual(["claude"]);
  });

  it("makes the whole row of an agent the label of its switch", async () => {
    const { wrapper } = await mountSection();
    const rows = wrapper.findAll(".list-group-item");
    expect(rows.map((row) => row.element.tagName)).toEqual(["LABEL", "LABEL"]);
    expect(rows.map((row) => row.find("input[role=switch]").exists())).toEqual([true, true]);
    expect(rows[0].classes()).toContain("list-group-item-action");
  });

  it("switches an agent when the click is on the name or on the empty space of the row", async () => {
    const { wrapper, settings } = await mountSection();
    const row = wrapper.findAll(".list-group-item")[0];
    await row.get("span").trigger("click");
    expect(settings.ownedAgents).toEqual(["claude"]);
    await row.trigger("click");
    expect(settings.ownedAgents).toEqual([]);
  });

  it("switches the focused switch with the key Enter, as the key Space does", async () => {
    const { wrapper, settings } = await mountSection();
    const switchInput = wrapper.findAll("input[role=switch]")[1];
    await switchInput.trigger("keydown", { key: "Enter" });
    expect(settings.ownedAgents).toEqual(["codex"]);
    expect((switchInput.element as HTMLInputElement).checked).toBe(true);
    await switchInput.trigger("keydown", { key: "Enter" });
    expect(settings.ownedAgents).toEqual([]);
    await switchInput.trigger("keydown", { key: "a" });
    expect(settings.ownedAgents).toEqual([]);
  });

  it("does not switch again while the key Enter stays pressed", async () => {
    const { wrapper, settings } = await mountSection();
    const switchInput = wrapper.findAll("input[role=switch]")[0];
    await switchInput.trigger("keydown", { key: "Enter" });
    await switchInput.trigger("keydown", { key: "Enter", repeat: true });
    expect(settings.ownedAgents).toEqual(["claude"]);
  });

  it("names each switch after its agent, because the label of the row holds the name", async () => {
    const { wrapper } = await mountSection();
    const row = wrapper.get(".list-group-item");
    expect(row.text()).toBe("Claude Code");
    expect(row.element.contains(row.get("input[role=switch]").element)).toBe(true);
  });

  it("saves the choice and restores it at the next start", async () => {
    const first = await mountSection();
    await first.wrapper.findAll("input[role=switch]")[0].setValue(true);
    await new Promise((resolve) => setTimeout(resolve));
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").ownedAgents).toEqual(["claude"]);
    vi.resetModules();
    const second = await mountSection();
    expect(second.settings.ownedAgents).toEqual(["claude"]);
    expect(second.wrapper.findAll(".list-group input[role=switch]").map((node) => (node.element as HTMLInputElement).checked)).toEqual([true, false]);
  });
});

describe("SettingsAgentsSection, the settings that moved here from other sections (issue #556)", () => {
  it("holds, after the list of coding agents, the heading Default command of a new tab, then the heading Quit", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.findAll("h4").map((heading) => heading.text())).toEqual(["Default command of a new tab", "Quit"]);
  });

  it("shows the three commands of a new tab, and saves the one that is chosen", async () => {
    const { wrapper, settings } = await mountSection();
    const group = wrapper.get('.btn-group[aria-label="Default command of a new tab"]');
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Terminal", "Claude Code", "Codex"]);
    await group.findAll("input[type=radio]")[2].setValue(true);
    expect(settings.newTabCommand).toBe("codex");
  });

  it("shows the switch Keep agents running after quit as a Bootstrap switch, switched off by default, linked to its setting", async () => {
    const { wrapper, settings } = await mountSection();
    const label = wrapper.findAll("label").find((candidate) => candidate.text() === "Keep agents running after quit");
    expect(label).toBeDefined();
    const switchInput = wrapper.get(`input[id="${label!.attributes("for")}"]`);
    expect(switchInput.element.parentElement?.classList.contains("switch")).toBe(true);
    expect((switchInput.element as HTMLInputElement).checked).toBe(false);
    await switchInput.setValue(true);
    expect(settings.keepAgentsRunningAfterQuit).toBe(true);
  });

  it("explains the switch Keep agents running after quit in an information card that opens from a circled question mark, and does not switch when the question mark is clicked", async () => {
    const { wrapper, settings } = await mountSection();
    const mark = wrapper.findAll(".information-card-part").find((part) => part.get('[role="img"]').attributes("aria-label") === "What does this setting do?")!;
    expect(mark.get('[role="img"]').attributes("aria-label")).toBe("What does this setting do?");
    expect(wrapper.find(".popover").exists()).toBe(false);
    await mark.trigger("click");
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-bottom");
    expect(card.text()).toContain("Heidrun stops its Herdr session");
    expect(settings.keepAgentsRunningAfterQuit).toBe(false);
  });
});
