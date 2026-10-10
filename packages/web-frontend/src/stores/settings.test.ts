import { beforeEach, describe, expect, it, vi } from "vitest";
import { FONT_DEFAULT, FONT_MAX, FONT_MIN, FONTS, fontStack, resetZoom, settings, zoom, zoomFactor } from "./settings";

const setZoom = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom }) }));

beforeEach(() => {
  settings.fontId = "geist";
  resetZoom();
});

describe("zoom", () => {
  it("changes the font size by the given step", () => {
    zoom(1);
    expect(settings.fontSize).toBe(FONT_DEFAULT + 1);
  });

  it("rounds to half a point", () => {
    zoom(0.3);
    expect(settings.fontSize).toBe(FONT_DEFAULT + 0.5);
  });

  it("never goes under the minimum", () => {
    zoom(-100);
    expect(settings.fontSize).toBe(FONT_MIN);
  });

  it("never goes over the maximum", () => {
    zoom(100);
    expect(settings.fontSize).toBe(FONT_MAX);
  });

  it("returns to the default size on reset", () => {
    zoom(5);
    resetZoom();
    expect(settings.fontSize).toBe(FONT_DEFAULT);
  });
});

describe("fontStack", () => {
  it("returns the stack of the chosen font", () => {
    settings.fontId = "menlo";
    expect(fontStack()).toBe("Menlo, monospace");
  });

  it("falls back to the first font for an unknown id", () => {
    settings.fontId = "nope";
    expect(fontStack()).toBe(FONTS[0].stack);
  });

  it("gives every font a unique id", () => {
    const ids = FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("settings", () => {
  it("has the documented defaults", () => {
    expect(settings.language).toBe("en");
    expect(settings.mouseMode).toBe("select");
  });
});

describe("time format", () => {
  it("follows the language by default", () => {
    expect(settings.timeFormat).toBe("auto");
  });
});

describe("working days", () => {
  it("are all the days of the week by default", () => {
    expect(settings.workingDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("zoom of the whole window", () => {
  it("is 1 at the default font size", () => {
    expect(zoomFactor()).toBe(1);
  });

  it("is the font size divided by the default font size", () => {
    zoom(2.5);
    expect(zoomFactor()).toBe((FONT_DEFAULT + 2.5) / FONT_DEFAULT);
  });

  it("is given to the web view, so the sidebar, the menus, the dialogs and the middle area change size together", async () => {
    setZoom.mockClear();
    zoom(2.5);
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith((FONT_DEFAULT + 2.5) / FONT_DEFAULT));
    resetZoom();
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith(1));
  });

  it("is saved and applied again after the application restarts", async () => {
    zoom(3);
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").fontSize).toBe(FONT_DEFAULT + 3));
    setZoom.mockClear();
    vi.resetModules();
    const restarted = await import("./settings");
    expect(restarted.settings.fontSize).toBe(FONT_DEFAULT + 3);
    await vi.waitFor(() => expect(setZoom).toHaveBeenLastCalledWith((FONT_DEFAULT + 3) / FONT_DEFAULT));
  });
});
