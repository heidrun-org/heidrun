import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsDynamicTopicsSection } = await import("./SettingsDynamicTopicsSection.vue");
  const clusters = await import("../../stores/topic_clusters");
  return { wrapper: mount(SettingsDynamicTopicsSection), settings, ...clusters };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.mocked(invoke).mockClear();
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
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Nothing leaves this computer");
    expect(lines[1]).toContain("not ready yet");
  });
});

describe("SettingsDynamicTopicsSection, clustered dynamic topics", () => {
  it("shows a switch Clustered dynamic topics under the choice of the method, switched off at first", async () => {
    const { wrapper, settings } = await mountSection();
    expect(wrapper.findAll("h4").map((title) => title.text())).toEqual(["Dynamic topic extraction", "Clustered dynamic topics"]);
    const switchInput = wrapper.get('input[role="switch"]');
    expect(wrapper.get('label[for="clustered-dynamic-topics"]').text()).toBe("Clustered dynamic topics");
    expect((switchInput.element as HTMLInputElement).checked).toBe(false);
    expect(settings.clusteredDynamicTopics).toBe(false);
  });

  it("saves the state of the switch in the option, and shows the saved state at the next start", async () => {
    const first = await mountSection();
    await first.wrapper.get('input[role="switch"]').setValue(true);
    expect(first.settings.clusteredDynamicTopics).toBe(true);
    const second = await mountSection();
    expect((second.wrapper.get('input[role="switch"]').element as HTMLInputElement).checked).toBe(true);
  });

  it("says in one line that only the short labels leave the computer, for the coding agent codex or claude", async () => {
    const { wrapper } = await mountSection();
    const help = wrapper.findAll(".keys")[2].text();
    expect(help).toContain("only the short labels of the raw dynamic topics");
    expect(help).toContain("never the text of a chat");
    expect(help).toContain("codex or claude");
  });

  it("shows the button Rebuild the clusters, disabled while the option is off", async () => {
    const { wrapper } = await mountSection();
    const button = wrapper.get(".rebuild button");
    expect(button.text()).toBe("Rebuild the clusters");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(invoke).not.toHaveBeenCalledWith("topic_clusters_write", expect.anything());
  });

  it("enables the button when the option is on, and a click empties the translation table on the disk", async () => {
    const { wrapper, settings } = await mountSection();
    settings.clusteredDynamicTopics = true;
    await wrapper.vm.$nextTick();
    const button = wrapper.get(".rebuild button");
    expect(button.attributes("disabled")).toBeUndefined();
    await button.trigger("click");
    expect(invoke).toHaveBeenCalledWith("topic_clusters_write", { rows: {} });
  });

  it("shows a spinning wheel and disables the button while a call runs", async () => {
    const { wrapper, settings, topicClusterStatus } = await mountSection();
    settings.clusteredDynamicTopics = true;
    topicClusterStatus.isRunning = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".rebuild .spinner-border").exists()).toBe(true);
    expect(wrapper.get(".rebuild button").attributes("disabled")).toBeDefined();
  });

  it("says why the call gave no cluster, only while the option is on", async () => {
    const { wrapper, settings, topicClusterStatus } = await mountSection();
    topicClusterStatus.error = "noCodingAgent";
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll("[role=status]")).toHaveLength(0);
    settings.clusteredDynamicTopics = true;
    await wrapper.vm.$nextTick();
    topicClusterStatus.error = "noCodingAgent";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("Neither codex nor claude is installed");
    topicClusterStatus.error = "wrongAnswer";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("answer that Heidrun cannot use");
    topicClusterStatus.error = "failed";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("did not answer");
  });
});
