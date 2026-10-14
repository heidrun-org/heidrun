import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsPastChatsSection from "./SettingsPastChatsSection.vue";
import { settings } from "../../stores/settings";

beforeEach(() => {
  settings.language = "en";
  settings.chatsRefreshSeconds = 10;
});

describe("SettingsPastChatsSection, the delay between two reads of the chats (issue #442)", () => {
  it("shows the four delays as a Bootstrap button group of radio inputs, with 10 seconds checked at first", () => {
    const wrapper = mount(SettingsPastChatsSection);
    const group = wrapper.get(".btn-group");
    expect(group.attributes("aria-label")).toBe("Read the chats again every");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["5 seconds", "10 seconds", "30 seconds", "1 minute"]);
    expect(group.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(group.findAll("label").every((label) => label.classes().includes("btn-check"))).toBe(true);
  });

  it("saves the delay of the radio input that is chosen, in seconds", async () => {
    const wrapper = mount(SettingsPastChatsSection);
    const radios = wrapper.get(".btn-group").findAll("input[type=radio]");
    await radios[3].setValue(true);
    expect(settings.chatsRefreshSeconds).toBe(60);
    await radios[0].setValue(true);
    expect(settings.chatsRefreshSeconds).toBe(5);
  });

  it("tells in a help paragraph what the delay does", () => {
    const wrapper = mount(SettingsPastChatsSection);
    expect(wrapper.get(".form-text").text()).toContain("reads the files of the chats again after this delay");
  });
});
