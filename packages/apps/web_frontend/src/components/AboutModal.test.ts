import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AboutModal from "./AboutModal.vue";

const state = vi.hoisted(() => ({ showAbout: null as (() => void) | null }));
const playNextGoatBleat = vi.fn();
const openUrl = vi.fn<(url: string) => Promise<void>>();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_name: string, handler: () => void) => {
    state.showAbout = handler;
    return () => {};
  }),
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "1.2.3") }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: (url: string) => openUrl(url) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/goat_sounds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/goat_sounds")>()),
  playNextGoatBleat: () => playNextGoatBleat(),
}));

/** Mounts the About modal, and opens it as the menu of the application does. */
async function openAboutModal() {
  const wrapper = mount(AboutModal);
  await flushPromises();
  state.showAbout?.();
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  playNextGoatBleat.mockReset();
  openUrl.mockReset();
  openUrl.mockResolvedValue(undefined);
});

describe("AboutModal", () => {
  it("shows a button that plays a goat bleat, and the modal stays open after the click", async () => {
    const wrapper = await openAboutModal();
    const button = wrapper.get("button.play-goat-sound");
    expect(button.text()).not.toBe("");
    await button.trigger("click");
    expect(playNextGoatBleat).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".window-box").exists()).toBe(true);
    wrapper.unmount();
  });

  it("plays a bleat at each click on the button, and never plays one by itself", async () => {
    const wrapper = await openAboutModal();
    expect(playNextGoatBleat).not.toHaveBeenCalled();
    await wrapper.get("button.play-goat-sound").trigger("click");
    await wrapper.get("button.play-goat-sound").trigger("click");
    expect(playNextGoatBleat).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("credits the author of the sound, and opens the Freesound page in the browser of the system", async () => {
    const wrapper = await openAboutModal();
    expect(wrapper.get(".sound-credit").text()).toContain("sonsdebarcelona");
    expect(wrapper.get(".sound-credit").text()).toContain("Creative Commons Attribution NonCommercial 3.0");
    await wrapper.get(".sound-credit a").trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://freesound.org/people/sonsdebarcelona/sounds/393948/");
    wrapper.unmount();
  });

  it("still closes with the close button", async () => {
    const wrapper = await openAboutModal();
    const closeButton = wrapper.findAll("button").find((button) => button.classes("play-goat-sound") === false);
    await closeButton?.trigger("click");
    expect(wrapper.find(".window-box").exists()).toBe(false);
    wrapper.unmount();
  });
});
