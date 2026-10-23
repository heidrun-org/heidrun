import { describe, expect, it } from "vitest";
import {
  checkGuardDraft,
  draftFromGuard,
  emptyDraft,
  guardIdText,
  isBuiltInGuardEnabled,
  migrateGuards,
  normalizeGuards,
  toProjectGuard,
  withBuiltInGuard,
  withProjectGuard,
  withoutProjectGuard,
} from "./guards_edit";
import type { ProjectGuard } from "./project_config";

const publish: ProjectGuard = { name: "Publish", description: "No undo.", action: "confirm", matches: [{ type: "startsWith", text: "npm publish" }] };
const deploy: ProjectGuard = { name: "Deploy", action: "block", matches: [{ type: "regex", text: "deploy\\.sh" }] };

describe("emptyDraft", () => {
  it("has no name, no description, the action confirm, and one empty line of the type contains", () => {
    expect(emptyDraft()).toEqual({ name: "", description: "", action: "confirm", matches: [{ type: "contains", text: "" }] });
  });
});

describe("draftFromGuard and toProjectGuard", () => {
  it("go back and forth without a change", () => {
    expect(toProjectGuard(draftFromGuard(publish))).toEqual(publish);
    expect(toProjectGuard(draftFromGuard(deploy))).toEqual(deploy);
  });

  it("removes the spaces around the texts and leaves out an empty description", () => {
    const guard = toProjectGuard({ name: "  Publish ", description: "   ", action: "block", matches: [{ type: "contains", text: " npm publish " }] });
    expect(guard).toEqual({ name: "Publish", action: "block", matches: [{ type: "contains", text: "npm publish" }] });
    expect("description" in guard).toBe(false);
  });

  it("does not share the lines of the guard with the draft", () => {
    const draft = draftFromGuard(publish);
    draft.matches[0].text = "changed";
    expect(publish.matches[0].text).toBe("npm publish");
  });
});

describe("checkGuardDraft", () => {
  const guards = { projectGuards: [publish, deploy] };

  it("accepts a good draft", () => {
    expect(checkGuardDraft(draftFromGuard({ ...publish, name: "Other" }), guards, null).isValid).toBe(true);
  });

  it("refuses an empty name", () => {
    const draft = { ...emptyDraft(), name: "  ", matches: [{ type: "contains" as const, text: "x" }] };
    const problems = checkGuardDraft(draft, guards, null);
    expect(problems.name).toBe("empty");
    expect(problems.isValid).toBe(false);
  });

  it("refuses a name that another guard has, without caring about the case or the spaces", () => {
    const draft = { ...emptyDraft(), name: " publish ", matches: [{ type: "contains" as const, text: "x" }] };
    expect(checkGuardDraft(draft, guards, null).name).toBe("used");
    expect(checkGuardDraft(draft, guards, "Deploy").name).toBe("used");
  });

  it("lets a guard keep its own name", () => {
    expect(checkGuardDraft(draftFromGuard(publish), guards, "Publish").isValid).toBe(true);
  });

  it("refuses a draft with no line", () => {
    const problems = checkGuardDraft({ ...emptyDraft(), name: "A", matches: [] }, guards, null);
    expect(problems.hasNoLine).toBe(true);
    expect(problems.isValid).toBe(false);
  });

  it("refuses an empty line", () => {
    const problems = checkGuardDraft({ ...emptyDraft(), name: "A" }, guards, null);
    expect(problems.lines).toEqual([{ reason: "empty" }]);
    expect(problems.isValid).toBe(false);
  });

  it("refuses a regular expression that cannot be read, and gives the detail", () => {
    const draft = { ...emptyDraft(), name: "A", matches: [{ type: "regex" as const, text: "(unclosed" }] };
    const problems = checkGuardDraft(draft, guards, null);
    expect(problems.lines[0]).toMatchObject({ reason: "invalid" });
    expect(problems.isValid).toBe(false);
  });

  it("accepts the text of the other types even when it would not be a regular expression", () => {
    const draft = { ...emptyDraft(), name: "A", matches: [{ type: "contains" as const, text: "(unclosed" }] };
    expect(checkGuardDraft(draft, guards, null).isValid).toBe(true);
  });
});

describe("migrateGuards", () => {
  it("turns the old lists into guards named after the pattern, and keeps the list disabled", () => {
    const migrated = migrateGuards({ block: ["deploy"], confirm: ["make"], disabled: ["guards.why.gitClean"] });
    expect(migrated).toEqual({
      projectGuards: [
        { name: "deploy", action: "block", matches: [{ type: "regex", text: "deploy" }] },
        { name: "make", action: "confirm", matches: [{ type: "regex", text: "make" }] },
      ],
      disabled: ["guards.why.gitClean"],
    });
    expect("block" in migrated).toBe(false);
    expect("confirm" in migrated).toBe(false);
  });

  it("gives a new name to a guard from an old list when the name is used", () => {
    const migrated = migrateGuards({ projectGuards: [{ name: "make", action: "block", matches: [{ type: "contains", text: "x" }] }], confirm: ["make"] });
    expect(migrated.projectGuards?.map((guard) => guard.name)).toEqual(["make", "make (2)"]);
  });

  it("gives an empty object for no guards", () => {
    expect(migrateGuards(undefined)).toEqual({});
  });
});

describe("withProjectGuard", () => {
  it("adds a new guard at the end", () => {
    expect(withProjectGuard({ projectGuards: [publish] }, deploy, null).projectGuards).toEqual([publish, deploy]);
  });

  it("replaces an edited guard in its place, also when its name changes", () => {
    const renamed = { ...publish, name: "Publish to npm" };
    expect(withProjectGuard({ projectGuards: [publish, deploy] }, renamed, "Publish").projectGuards).toEqual([renamed, deploy]);
  });

  it("migrates the old lists on the first change", () => {
    const result = withProjectGuard({ block: ["x"] }, publish, null);
    expect(result.projectGuards?.map((guard) => guard.name)).toEqual(["x", "Publish"]);
    expect("block" in result).toBe(false);
  });

  it("does not change its argument", () => {
    const guards = { projectGuards: [publish] };
    withProjectGuard(guards, deploy, null);
    expect(guards.projectGuards).toEqual([publish]);
  });
});

describe("withoutProjectGuard", () => {
  it("removes the guard that has the name", () => {
    expect(withoutProjectGuard({ projectGuards: [publish, deploy] }, "Publish")).toEqual({ projectGuards: [deploy] });
  });

  it("gives undefined when nothing is left, so that the key can be removed", () => {
    expect(withoutProjectGuard({ projectGuards: [publish] }, "Publish")).toBeUndefined();
  });

  it("keeps the list disabled", () => {
    expect(withoutProjectGuard({ projectGuards: [publish], disabled: ["guards.why.gitClean"] }, "Publish")).toEqual({ disabled: ["guards.why.gitClean"] });
  });

  it("removes a guard from an old list, by the pattern that names it", () => {
    expect(withoutProjectGuard({ block: ["deploy"], confirm: ["make"] }, "deploy")?.projectGuards?.map((guard) => guard.name)).toEqual(["make"]);
  });
});

describe("withBuiltInGuard and isBuiltInGuardEnabled", () => {
  it("turns a guard off by adding its key, and on by removing it", () => {
    const off = withBuiltInGuard(undefined, "guards.why.gitClean", false);
    expect(off).toEqual({ disabled: ["guards.why.gitClean"] });
    expect(isBuiltInGuardEnabled(off, "guards.why.gitClean")).toBe(false);
    expect(withBuiltInGuard(off, "guards.why.gitClean", true)).toBeUndefined();
  });

  it("adds a key once", () => {
    const off = withBuiltInGuard({ disabled: ["guards.why.gitClean"] }, "guards.why.gitClean", false);
    expect(off?.disabled).toEqual(["guards.why.gitClean"]);
  });

  it("keeps the other keys and the guards of the project", () => {
    expect(withBuiltInGuard({ projectGuards: [publish], disabled: ["a"] }, "b", false)).toEqual({ projectGuards: [publish], disabled: ["a", "b"] });
  });

  it("says that a guard is on when no list exists", () => {
    expect(isBuiltInGuardEnabled(undefined, "guards.why.gitClean")).toBe(true);
  });
});

describe("normalizeGuards", () => {
  it("leaves out empty lists and writes the keys in a fixed order", () => {
    const result = normalizeGuards({ disabled: ["a"], block: [], confirm: ["b"], projectGuards: [publish] });
    expect(Object.keys(result ?? {})).toEqual(["projectGuards", "confirm", "disabled"]);
  });

  it("gives undefined when nothing is left", () => {
    expect(normalizeGuards({ block: [], disabled: [] })).toBeUndefined();
  });
});

describe("guardIdText", () => {
  it("names a built-in guard and a guard of the project", () => {
    expect(guardIdText({ kind: "builtin", key: "guards.why.gitClean" })).toBe("builtin:guards.why.gitClean");
    expect(guardIdText({ kind: "project", name: "Publish" })).toBe("project:Publish");
  });
});
