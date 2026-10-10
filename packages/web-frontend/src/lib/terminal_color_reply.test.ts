import { describe, expect, it } from "vitest";
import { TerminalColorReply } from "./terminal_color_reply";

describe("TerminalColorReply", () => {
  it("answers the background question with the light background", () => {
    expect(TerminalColorReply.answer(11, "?", "#ffffff")).toBe("\x1b]11;rgb:ffff/ffff/ffff\x1b\\");
  });

  it("answers the foreground question", () => {
    expect(TerminalColorReply.answer(10, "?", "#2b2f33")).toBe("\x1b]10;rgb:2b2b/2f2f/3333\x1b\\");
  });

  it("does not answer when the text is not a question", () => {
    expect(TerminalColorReply.answer(11, "rgb:0000/0000/0000", "#ffffff")).toBeNull();
  });

  it("does not answer when the colour is missing or not valid", () => {
    expect(TerminalColorReply.answer(11, "?", undefined)).toBeNull();
    expect(TerminalColorReply.answer(11, "?", "white")).toBeNull();
  });
});
