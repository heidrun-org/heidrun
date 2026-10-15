import { describe, expect, it } from "vitest";
import { oscColor, withBackground } from "./terminal_background";

describe("oscColor", () => {
  it("converts a hexadecimal colour", () => {
    expect(oscColor("#f6f6f4")).toBe("rgb:f6f6/f6f6/f4f4");
    expect(oscColor(" #0B0C0E ")).toBe("rgb:0b0b/0c0c/0e0e");
  });

  it("refuses a colour that is not #rrggbb", () => {
    expect(oscColor("white")).toBeNull();
    expect(oscColor("#fff")).toBeNull();
    expect(oscColor("")).toBeNull();
  });
});

describe("withBackground", () => {
  it("sets the background before the command", () => {
    expect(withBackground("codex", "#f6f6f4")).toBe("printf '\\033]11;rgb:f6f6/f6f6/f4f4\\033\\\\'; codex");
  });

  it("keeps the command alone when the colour is not valid", () => {
    expect(withBackground("codex -m 'o3'", "")).toBe("codex -m 'o3'");
  });
});
