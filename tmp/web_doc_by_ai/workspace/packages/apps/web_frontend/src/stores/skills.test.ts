import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("errorText", () => {
  it("gives the text of a known code of the backend", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_already_installed: pdf")).toBe("The skill pdf is already installed at this level");
  });

  it("tells the time when GitHub accepts requests again", async () => {
    const { errorText } = await import("./skills");
    const reset = new Date(2026, 9, 10, 15, 4, 46).getTime() / 1000;
    const text = errorText(`skills_github_rate_limit: ${reset}`);
    expect(text).toMatch(/^GitHub refuses more requests for now\. Try again at .*(15:04|3:04)/);
  });

  it("says a few minutes when GitHub does not give the time", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_github_rate_limit")).toBe("GitHub refuses more requests for now. Try again in a few minutes.");
  });

  it("shows an unknown error as it is", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("something_else: boom")).toBe("something_else: boom");
  });

  it("tells that a link already exists", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_already_linked: pdf")).toBe("The skill pdf is already in the folder of this agent");
  });
});
