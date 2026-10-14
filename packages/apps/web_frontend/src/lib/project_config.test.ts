import { describe, expect, it } from "vitest";
import { parseProjectConfig, parseReferences, projectConfigSchema } from "./project_config";

describe("parseProjectConfig", () => {
  it("accepts a minimal configuration and defaults the launchers to an empty list", () => {
    expect(parseProjectConfig({ version: 1 })).toEqual({ version: 1, launchers: [] });
  });

  it("accepts a full configuration", () => {
    const config = parseProjectConfig({
      version: 1,
      launchers: [{ id: "build", label: "Build", command: "pnpm build", cwd: "packages/apps/web_frontend" }],
      references: { forge: "github", repo: "org/app", tickets: { url: "https://x/{key}", prefixes: ["ABC"] } },
      guards: { confirm: ["^make"], block: ["publish"] },
      prompts: [{ text: "Review this" }],
    });
    expect(config.launchers[0].id).toBe("build");
    expect(config.references?.forge).toBe("github");
  });

  it("rejects a wrong version", () => {
    expect(() => parseProjectConfig({ version: 2 })).toThrow(/version/);
  });

  it("rejects an unknown field and names it", () => {
    expect(() => parseProjectConfig({ version: 1, colour: "red" })).toThrow(/colour|Unrecognized/);
  });

  it("names the path of the invalid field", () => {
    expect(() => parseProjectConfig({ version: 1, launchers: [{ id: "a", label: "A", command: "" }] })).toThrow(
      /launchers\.0\.command/,
    );
  });

  it("names the root when the value is not an object", () => {
    expect(() => parseProjectConfig("text")).toThrow();
  });

  it("rejects an unknown forge", () => {
    expect(() => parseProjectConfig({ version: 1, references: { forge: "bitbucket" } })).toThrow(/references\.forge/);
  });

  it("rejects an empty prompt text", () => {
    expect(() => parseProjectConfig({ version: 1, prompts: [{ text: "" }] })).toThrow(/prompts\.0\.text/);
  });

  it("joins several problems with a semicolon", () => {
    expect(() => parseProjectConfig({ version: 3, extra: true })).toThrow(/;/);
  });
});

describe("parseProjectConfig with the old key actions", () => {
  it("reads the list under the old key actions as the list of launchers", () => {
    const config = parseProjectConfig({ version: 1, actions: [{ id: "build", label: "Build", command: "pnpm build" }] });
    expect(config.launchers).toEqual([{ id: "build", label: "Build", command: "pnpm build" }]);
  });

  it("returns a configuration that has the key launchers and no key actions", () => {
    const config = parseProjectConfig({ version: 1, actions: [{ id: "build", label: "Build", command: "pnpm build" }] });
    expect(Object.keys(config)).toContain("launchers");
    expect(Object.keys(config)).not.toContain("actions");
  });

  it("names the path of an invalid field under the old key actions with the key launchers", () => {
    expect(() => parseProjectConfig({ version: 1, actions: [{ id: "a", label: "A", command: "" }] })).toThrow(
      /launchers\.0\.command/,
    );
  });

  it("rejects a file that has both the key actions and the key launchers, and names the key actions", () => {
    expect(() => parseProjectConfig({ version: 1, actions: [], launchers: [] })).toThrow(/actions/);
  });
});

describe("parseReferences", () => {
  it("accepts a ticket URL given as a string", () => {
    expect(parseReferences({ tickets: "https://x/{key}" }).tickets).toBe("https://x/{key}");
  });

  it("accepts an empty object", () => {
    expect(parseReferences({})).toEqual({});
  });

  it("rejects an empty repo", () => {
    expect(() => parseReferences({ repo: "" })).toThrow(/repo/);
  });

  it("rejects an unknown field", () => {
    expect(() => parseReferences({ unknown: 1 })).toThrow();
  });
});

describe("projectConfigSchema", () => {
  it("is strict at every level", () => {
    expect(projectConfigSchema.safeParse({ version: 1, guards: { confirm: [], oops: [] } }).success).toBe(false);
  });
});
