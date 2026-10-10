import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const showMainWindow = vi.fn<() => Promise<void>>();

vi.mock("../lib/api", () => ({ showMainWindow: () => showMainWindow() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the splash screen, with the browser function `decode` of the image replaced by a function that records its call. */
async function mountSplashScreen() {
  const decode = vi.fn(async () => {});
  HTMLImageElement.prototype.decode = decode;
  const { default: SplashScreen } = await import("./SplashScreen.vue");
  const wrapper = mount(SplashScreen);
  return { wrapper, decode };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  showMainWindow.mockReset();
  showMainWindow.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SplashScreen", () => {
  it("does not show the main window, and does not start the display time, before the image is loaded", async () => {
    const { wrapper } = await mountSplashScreen();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(showMainWindow).not.toHaveBeenCalled();
    expect(wrapper.find(".splash").exists()).toBe(true);
  });

  it("decodes the image, then shows the main window once, when the image is loaded", async () => {
    const { wrapper, decode } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    expect(decode).toHaveBeenCalledTimes(1);
    expect(showMainWindow).toHaveBeenCalledTimes(1);
    expect(decode.mock.invocationCallOrder[0]).toBeLessThan(showMainWindow.mock.invocationCallOrder[0]);
  });

  it("shows the main window anyway when the image fails to load, so the window never stays hidden", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("error");
    await flushPromises();
    expect(showMainWindow).toHaveBeenCalledTimes(1);
  });

  it("shows the main window anyway when the image cannot be decoded", async () => {
    const { wrapper, decode } = await mountSplashScreen();
    decode.mockRejectedValue(new Error("decode failed"));
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    expect(showMainWindow).toHaveBeenCalledTimes(1);
  });

  it("keeps the splash screen for 3 seconds after the main window is shown, then closes it", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(wrapper.find(".splash").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("closes the splash screen after 3 seconds even when there is no window to show, as in a plain browser", async () => {
    showMainWindow.mockRejectedValue(new Error("no Tauri"));
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("closes the splash screen when it is clicked", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get(".splash").trigger("click");
    expect(wrapper.find(".splash").exists()).toBe(false);
  });
});
