import Fs from "node:fs";
import Path from "node:path";
import { describe, expect, it } from "vitest";

const mainText = Fs.readFileSync(Path.join(import.meta.dirname, "main.ts"), "utf8");

describe("the start of the application in main.ts (issue 772)", () => {
  it("imports no store and no component with a static import, because a store reads localStorage when its file is imported", () => {
    const staticImports = mainText.match(/^import\s.*$/gm) ?? [];
    expect(staticImports).toEqual([
      "import \"./dev/install_tauri_mock\";",
      "import { DurableStorage } from \"./lib/durable_storage\";",
    ]);
  });

  it("restores localStorage, then migrates the former names, then loads the application, then starts the copy", () => {
    const steps = [
      "await DurableStorage.restore()",
      "await import(\"./lib/legacy_storage\")",
      "await import(\"./start_application\")",
      "DurableStorage.startMirroring()",
    ].map((step) => mainText.indexOf(step));
    expect(steps.every((index) => index >= 0)).toBe(true);
    expect([...steps].sort((left, right) => left - right)).toEqual(steps);
  });
});
