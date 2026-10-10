import { beforeEach, describe, expect, it } from "vitest";
import { FONT_DEFAULT, FONT_MAX, FONT_MIN, FONTS, fontStack, resetZoom, settings, zoom } from "./settings";

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
    expect(settings.fontSize).toBe(13);
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
