import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import enTexts from "../../i18n/locales/en/settingsSkills.json";
import frTexts from "../../i18n/locales/fr/settingsSkills.json";
import { SKILLS_HELP_BLOCKS, type SkillsHelpTopic } from "./skills_help";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
});

const TOPICS = Object.keys(SKILLS_HELP_BLOCKS) as SkillsHelpTopic[];

describe("the texts of the information cards", () => {
  for (const [language, texts] of [["en", enTexts], ["fr", frTexts]] as const) {
    it(`has, in ${language}, a title, a label, and a title and a text for each block of each card`, () => {
      const keys = texts as Record<string, string>;
      for (const topic of TOPICS) {
        expect(keys[`help_${topic}_title`], `help_${topic}_title`).toBeTruthy();
        expect(keys[`help_${topic}_label`], `help_${topic}_label`).toBeTruthy();
        for (const block of SKILLS_HELP_BLOCKS[topic]) {
          expect(keys[`help_${topic}_${block}_title`], `help_${topic}_${block}_title`).toBeTruthy();
          expect(keys[`help_${topic}_${block}_text`], `help_${topic}_${block}_text`).toBeTruthy();
        }
      }
    });
  }

  it("has a card for the six lines of the window: level, source, search, folder, address, and result", () => {
    expect(TOPICS).toEqual(["level", "source", "search", "folder", "address", "result"]);
  });
});

describe("SkillsHelpCard", () => {
  async function mountCard(topic: SkillsHelpTopic) {
    const { default: SkillsHelpCard } = await import("./SkillsHelpCard.vue");
    return mount(SkillsHelpCard, { props: { topic }, attachTo: document.body });
  }

  it("shows a circled question mark with the label of the card for the screen reader, and no card at the start", async () => {
    const wrapper = await mountCard("source");
    expect(wrapper.get("[role=img]").attributes("aria-label")).toBe("About the source of the skill");
    expect(wrapper.find(".bi-question-circle").exists()).toBe(true);
    expect(wrapper.find("[data-help-block]").exists()).toBe(false);
    wrapper.unmount();
  });

  for (const topic of TOPICS) {
    it(`opens the card of the line ${topic} with its title, then its blocks in order`, async () => {
      const wrapper = await mountCard(topic);
      await wrapper.get(".information-card-part").trigger("click");
      const titles = wrapper.findAll("[data-help-block] .fw-medium").map((title) => title.text());
      const expected = SKILLS_HELP_BLOCKS[topic].map((block) => (enTexts as Record<string, string>)[`help_${topic}_${block}_title`]);
      expect(titles).toEqual(expected);
      const texts = wrapper.findAll("[data-help-block] .text-body-secondary").map((text) => text.text());
      expect(texts).toEqual(SKILLS_HELP_BLOCKS[topic].map((block) => (enTexts as Record<string, string>)[`help_${topic}_${block}_text`]));
      expect(wrapper.get(".list-group-item").text()).toBe((enTexts as Record<string, string>)[`help_${topic}_title`]);
      wrapper.unmount();
    });
  }

  it("closes the card with a second click on the circled question mark", async () => {
    const wrapper = await mountCard("result");
    const part = wrapper.get(".information-card-part");
    await part.trigger("click");
    expect(wrapper.find("[data-help-block]").exists()).toBe(true);
    await part.trigger("click");
    expect(wrapper.find("[data-help-block]").exists()).toBe(false);
    wrapper.unmount();
  });
});
