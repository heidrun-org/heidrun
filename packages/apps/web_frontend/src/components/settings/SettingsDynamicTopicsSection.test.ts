import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsDynamicTopicsSection } = await import("./SettingsDynamicTopicsSection.vue");
  return { wrapper: mount(SettingsDynamicTopicsSection), settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsDynamicTopicsSection", () => {
  it("shows the title Dynamic topic extraction above a group of two radio buttons, Keyword and Language model", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.get("h4").text()).toBe("Dynamic topic extraction");
    expect(wrapper.get('[role="radiogroup"]').attributes("aria-label")).toBe("Dynamic topic extraction");
    expect(wrapper.findAll('[role="radio"]').map((radio) => radio.text())).toEqual(["Keyword", "Language model"]);
  });

  it("checks the radio button Keyword at first", async () => {
    const { wrapper, settings } = await mountSection();
    expect(settings.dynamicTopicExtraction).toBe("keyword");
    expect(wrapper.findAll('[role="radio"]').map((radio) => radio.attributes("aria-checked"))).toEqual(["true", "false"]);
  });

  it("disables the radio button Language model, with a title that says it is not ready yet", async () => {
    const { wrapper, settings } = await mountSection();
    const languageModel = wrapper.findAll('[role="radio"]')[1];
    expect(languageModel.attributes("disabled")).toBeDefined();
    expect(languageModel.attributes("title")).toContain("Not ready yet");
    await languageModel.trigger("click");
    expect(settings.dynamicTopicExtraction).toBe("keyword");
  });

  it("checks the radio button of the saved method", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dynamicTopicExtraction: "languageModel" }));
    const { wrapper } = await mountSection();
    expect(wrapper.findAll('[role="radio"]').map((radio) => radio.attributes("aria-checked"))).toEqual(["false", "true"]);
  });

  it("explains each method in one line", async () => {
    const { wrapper } = await mountSection();
    const lines = wrapper.findAll(".keys").map((line) => line.text());
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Nothing leaves this computer");
    expect(lines[1]).toContain("not ready yet");
  });
});
