import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsTerminalSection } = await import("./SettingsTerminalSection.vue");
  return { wrapper: mount(SettingsTerminalSection), settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsTerminalSection, the mouse behaviour that moved here from the section Mouse (issue #556)", () => {
  it("shows the heading Mouse behaviour after the font, with the two modes as a Bootstrap button group of radio inputs", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.findAll("h4").map((heading) => heading.text())).toEqual(["Mouse behaviour"]);
    const group = wrapper.get('.btn-group[aria-label="Mouse behaviour"]');
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Select text", "Mouse for the app"]);
    for (const label of group.findAll("label")) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
  });

  it("saves the mode that is chosen, and shows the help of that mode", async () => {
    const { wrapper, settings } = await mountSection();
    const radios = wrapper.get(".btn-group").findAll("input[type=radio]");
    const firstMode = settings.mouseMode;
    expect((radios[firstMode === "select" ? 0 : 1].element as HTMLInputElement).checked).toBe(true);
    await radios[1].setValue(true);
    expect(settings.mouseMode).toBe("app");
    expect(wrapper.findAll(".form-text").map((line) => line.text()).join(" ")).toContain("The wheel and the clicks go to Herdr");
    await radios[0].setValue(true);
    expect(settings.mouseMode).toBe("select");
    expect(wrapper.findAll(".form-text").map((line) => line.text()).join(" ")).toContain("Drag selects");
  });
});
