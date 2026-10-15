import { describe, expect, it } from "vitest";
import { parseGithubFolderAddress } from "./github_folder_address";

describe("parseGithubFolderAddress", () => {
  it("reads the address of a skill folder", () => {
    expect(parseGithubFolderAddress("https://github.com/anthropics/skills/tree/main/skills/pdf")).toEqual({
      url: "https://github.com/anthropics/skills/tree/main/skills/pdf",
      source: "anthropics/skills",
      skillId: "pdf",
    });
  });

  it("ignores the spaces, the query, the fragment, and the slash at the end", () => {
    expect(parseGithubFolderAddress("  https://github.com/a/b/tree/main/skills/pdf/?tab=readme#top \n")?.url).toBe(
      "https://github.com/a/b/tree/main/skills/pdf",
    );
    expect(parseGithubFolderAddress("https://www.github.com/a/b/tree/main/pdf")?.skillId).toBe("pdf");
  });

  it("keeps a branch name with a slash, the last part is the skill", () => {
    expect(parseGithubFolderAddress("https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator")).toEqual({
      url: "https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator",
      source: "anthropics/skills",
      skillId: "skill-creator",
    });
  });

  it("gives null for a text that is not the address of a skill folder", () => {
    for (const text of [
      "",
      "pdf",
      "docx word documents",
      "https://github.com/anthropics/skills",
      "https://github.com/anthropics/skills/tree/main",
      "https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md",
      "http://github.com/anthropics/skills/tree/main/skills/pdf",
      "https://gitlab.com/anthropics/skills/tree/main/skills/pdf",
      "https://github.com.evil.example/anthropics/skills/tree/main/skills/pdf",
      "https://github.com/anthropics//tree/main/skills/pdf",
      "https://github.com/anthropics/skills/tree/main//pdf",
    ]) {
      expect(parseGithubFolderAddress(text), text).toBeNull();
    }
  });

  it("gives null for a part that could leave the folder or break the call to GitHub", () => {
    for (const text of [
      "https://github.com/a/b/tree/main/../pdf",
      "https://github.com/a/b/tree/main/skills/.hidden",
      "https://github.com/a/b/tree/main/skills/my%20skill",
      "https://github.com/a/b/tree/main:x/pdf",
    ]) {
      expect(parseGithubFolderAddress(text), text).toBeNull();
    }
  });
});
