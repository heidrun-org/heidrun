import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { macros, projectMacros, resolveMacroVariables } from "./macros";
import { project } from "./project";
import { state } from "./session";

describe("the personal macros", () => {
  it("are saved in the browser storage under the key heidrun.prompts, which the macros had before the rename", async () => {
    macros.personal.push({ id: "m1", label: "Saved macro", description: "", text: "Hello" });
    await nextTick();
    expect(localStorage.getItem("heidrun.prompts")).toContain("Saved macro");
  });
});

describe("the macros of a project", () => {
  it("come from the key prompts of the file .heidrun/config.json, and get an id and a label when the file has none", () => {
    state.selectedWorkspaceId = "workspace_test";
    project.byWorkspace.workspace_test = {
      root: "/tmp/project",
      config: { version: 1, actions: [], prompts: [{ text: "Review the branch" }] },
    } as never;
    expect(projectMacros.value).toEqual([
      { id: "projet-0", label: "Review the branch", description: "", text: "Review the branch" },
    ]);
  });
});

describe("resolveMacroVariables", () => {
  it("leaves a variable that it does not know, so that nothing disappears", async () => {
    expect(await resolveMacroVariables("a {unknown} b", null)).toBe("a {unknown} b");
  });

  it("replaces a known variable that has no value with an empty text", async () => {
    expect(await resolveMacroVariables("branch: {branche}.", null)).toBe("branch: .");
  });
});
