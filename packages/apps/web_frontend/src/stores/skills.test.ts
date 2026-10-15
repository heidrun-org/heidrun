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

  it("tells that a folder was not found on GitHub, or that an address is not a folder", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_folder_not_found: a/b/main/skills/x")).toBe(
      "This folder was not found on GitHub: a/b/main/skills/x. The repository must be public, and the folder must have a SKILL.md file.",
    );
    expect(errorText("skills_invalid_address: https://example.com/x")).toBe(
      "This is not the web address of a folder in a GitHub repository: https://example.com/x",
    );
  });

  it("tells that a link already exists", async () => {
    const { errorText } = await import("./skills");
    expect(errorText("skills_already_linked: pdf")).toBe("The skill pdf is already in the folder of this agent");
  });
});

describe("originLabel", () => {
  it("says GitHub for a skill installed from a web address, and skills.sh for the others", async () => {
    const { originLabel } = await import("./skills");
    const skill = { name: "pdf", description: "", level: "user" as const, path: "/p", agents: [] };
    const fromAddress = { ...skill, origin: { source: "a/b", skill_id: "pdf", folder_url: "https://github.com/a/b/tree/main/pdf" } };
    expect(originLabel(fromAddress)).toBe("GitHub · a/b");
    expect(originLabel({ ...skill, origin: { source: "a/b", skill_id: "pdf" } })).toBe("skills.sh · a/b");
    expect(originLabel({ ...skill, origin: null })).toBe("Local");
  });
});
