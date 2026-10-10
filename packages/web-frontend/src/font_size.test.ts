import Fs from "node:fs";
import Path from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_DEFAULT } from "./stores/settings";

const __dirname = import.meta.dirname;

/** The files that keep a fixed pixel size on purpose: the logo of the splash screen and of the About window. */
const FIXED_SIZE_FILES = ["components/SplashScreen.vue", "components/AboutModal.vue"];

function sourceFiles(directory: string): string[] {
  return Fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = Path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(vue|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("font size", () => {
  it("is published once as the CSS variable --font-size", () => {
    expect(document.documentElement.style.getPropertyValue("--font-size")).toBe(`${FONT_DEFAULT}px`);
  });

  it("is never written as a number of pixels in a style, so one number sizes the text of the whole window", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(__dirname)) {
      const name = Path.relative(__dirname, file);
      if (FIXED_SIZE_FILES.includes(name)) {
        continue;
      }
      Fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/font(-size)?:[^;]*\d+(\.\d+)?px/.test(line)) {
            offenders.push(`${name}:${index + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
