import { describe, expect, it } from "vitest";
import { compactTokens, duration, gaugeLevel, shortPath } from "./format";

describe("shortPath", () => {
  it("replaces the home folder with a tilde", () => {
    expect(shortPath("/Users/alice/work/app")).toBe("~/work/app");
    expect(shortPath("/home/bob/app")).toBe("~/app");
  });

  it("returns an empty string for an empty value", () => {
    expect(shortPath(null)).toBe("");
    expect(shortPath(undefined)).toBe("");
  });
});

describe("compactTokens", () => {
  it("writes thousands with the letter k", () => {
    expect(compactTokens(1500)).toBe("2k");
    expect(compactTokens(999)).toBe("999");
    expect(compactTokens(null)).toBe("");
  });
});

describe("gaugeLevel", () => {
  it("returns the colour level of a percentage", () => {
    expect(gaugeLevel(10)).toBe("ok");
    expect(gaugeLevel(60)).toBe("warn");
    expect(gaugeLevel(81)).toBe("crit");
  });
});

describe("duration", () => {
  it("writes minutes and hours", () => {
    expect(duration(45_000)).toBe("< 1 min");
    expect(duration(7 * 60_000)).toBe("7 min");
    expect(duration(65 * 60_000)).toBe("1 h 05");
  });
});
