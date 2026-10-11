import { describe, expect, it } from "vitest";
import { fileName, fileWebUrl, relativeFilePath } from "./chat_files";

describe("relativeFilePath", () => {
  it("gives the path below the root of the repository", () => {
    expect(relativeFilePath("/work/app", "/work/app/src/main.ts")).toBe("src/main.ts");
    expect(relativeFilePath("/work/app/", "/work/app/src/main.ts")).toBe("src/main.ts");
  });

  it("gives null when the root is not known, or when the file is not below the root", () => {
    expect(relativeFilePath(null, "/work/app/src/main.ts")).toBeNull();
    expect(relativeFilePath("/work/app", "/work/application/main.ts")).toBeNull();
    expect(relativeFilePath("/work/app", "/work/app")).toBeNull();
    expect(relativeFilePath("/work/app", "/elsewhere/main.ts")).toBeNull();
  });
});

describe("fileWebUrl", () => {
  it("gives the address of the file on GitHub, on the default branch", () => {
    expect(fileWebUrl("https://github.com/heidrun-org/heidrun", "github", "src/a b.ts")).toBe(
      "https://github.com/heidrun-org/heidrun/blob/HEAD/src/a%20b.ts",
    );
  });

  it("gives the address of the file on GitLab, on the default branch", () => {
    expect(fileWebUrl("https://gitlab.com/group/app", "gitlab", "src/main.ts")).toBe(
      "https://gitlab.com/group/app/-/blob/HEAD/src/main.ts",
    );
  });

  it("gives null when the repository has no address or no forge", () => {
    expect(fileWebUrl(null, "github", "a.ts")).toBeNull();
    expect(fileWebUrl("https://github.com/x/y", null, "a.ts")).toBeNull();
  });
});

describe("fileName", () => {
  it("gives the last part of the path", () => {
    expect(fileName("/work/app/src/main.ts")).toBe("main.ts");
    expect(fileName("main.ts")).toBe("main.ts");
  });
});
