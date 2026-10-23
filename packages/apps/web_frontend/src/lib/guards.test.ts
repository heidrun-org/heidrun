import { describe, expect, it } from "vitest";
import { builtInGuardLines, checkCommand, DEFAULT_GUARDS, matchesLine, projectGuardList, tryCommand } from "./guards";

describe("checkCommand: default guards ask for a confirmation", () => {
  const dangerous = [
    "rm -rf node_modules",
    "rm -fr /tmp/x",
    "rm --recursive build",
    "sudo rm file.txt",
    "find . -name '*.log' -delete",
    "find / -exec rm {} ;",
    "shred secret.txt",
    "docker system prune -af",
    "docker rm -f web",
    "git push --force origin main",
    "git push -f",
    "git push origin +main",
    "git push origin --delete old-branch",
    "git -C ../other push --force-with-lease",
    "git reset --hard HEAD~3",
    "git clean -fd",
    "git branch -D feature",
    "git checkout -f main",
    "git checkout -- .",
    "git stash drop",
    "git stash clear",
    "psql -c 'DROP TABLE users'",
    "mysql -e 'truncate database app'",
    "DELETE FROM users;",
    "mkfs.ext4 /dev/sda1",
    "dd if=/dev/zero of=/dev/disk2",
    "echo x > /dev/sda",
    "chmod -R 777 /var",
    "chown -R root .",
    "kubectl delete pod web",
    "helm uninstall release",
    "terraform destroy",
    "terraform apply -auto-approve",
    "gh pr merge 12",
    "glab mr merge 3",
    "restart production",
    "ssh prod rm -rf /srv/app",
  ];

  for (const command of dangerous) {
    it(`flags: ${command}`, () => {
      expect(checkCommand(command)?.level).toBe("confirm");
    });
  }
});

describe("checkCommand: harmless commands pass", () => {
  const harmless = [
    "ls -la",
    "git status",
    "git push origin main",
    "git push",
    "git reset --soft HEAD~1",
    "git branch -d merged-branch",
    "DELETE FROM users WHERE id = 3",
    "rm file.txt",
    "npm test",
    "cargo test",
    "docker ps",
    "echo hello",
    "kubectl get pods",
  ];

  for (const command of harmless) {
    it(`passes: ${command}`, () => {
      expect(checkCommand(command)).toBeNull();
    });
  }
});

describe("checkCommand: project rules", () => {
  it("blocks a command matched by a project block pattern", () => {
    const hit = checkCommand("npm publish", { block: ["npm\\s+publish"] });
    expect(hit?.level).toBe("block");
  });

  it("asks for a confirmation on a project confirm pattern", () => {
    expect(checkCommand("make deploy", { confirm: ["^make deploy"] })?.level).toBe("confirm");
  });

  it("lets blocking win over confirming", () => {
    const hit = checkCommand("make deploy", { confirm: ["make"], block: ["deploy"] });
    expect(hit?.level).toBe("block");
  });

  it("matches project patterns without caring about letter case", () => {
    expect(checkCommand("NPM PUBLISH", { block: ["npm publish"] })?.level).toBe("block");
  });

  it("ignores an invalid regular expression", () => {
    expect(checkCommand("ls", { block: ["(unclosed"] })).toBeNull();
    expect(checkCommand("rm -rf x", { block: ["(unclosed"] })?.level).toBe("confirm");
  });

  it("collapses whitespace before matching", () => {
    expect(checkCommand("git    reset\n  --hard")?.level).toBe("confirm");
  });

  it("accepts a null project", () => {
    expect(checkCommand("ls", null)).toBeNull();
  });
});

describe("checkCommand: built-in guards turned off by the project", () => {
  it("lets a command pass when the project turned off the guard that stops it", () => {
    expect(checkCommand("git clean -fd", { disabled: ["guards.why.gitClean"] })).toBeNull();
  });

  it("keeps the other built-in guards on", () => {
    expect(checkCommand("git reset --hard", { disabled: ["guards.why.gitClean"] })?.level).toBe("confirm");
  });

  it("ignores a key that is not the key of a built-in guard", () => {
    expect(checkCommand("git clean -fd", { disabled: ["guards.why.doesNotExist"] })?.level).toBe("confirm");
  });

  it("does not turn off a project pattern", () => {
    const project = { disabled: ["guards.why.gitClean"], confirm: ["git clean"] };
    expect(checkCommand("git clean -fd", project)?.level).toBe("confirm");
  });
});

describe("checkCommand: the guard that stopped the command", () => {
  it("names the built-in guard by its key", () => {
    expect(checkCommand("git clean -fd")?.guard).toEqual({ kind: "builtin", key: "guards.why.gitClean" });
  });

  it("names the guard of the project by its name", () => {
    const project = { projectGuards: [{ name: "Deploy", action: "confirm" as const, matches: [{ type: "contains" as const, text: "deploy/now" }] }] };
    expect(checkCommand("make deploy/now", project)?.guard).toEqual({ kind: "project", name: "Deploy" });
  });

  it("names a pattern of an old list by the pattern", () => {
    expect(checkCommand("npm publish", { block: ["npm\\s+publish"] })?.guard).toEqual({ kind: "project", name: "npm\\s+publish" });
  });

  it("names no guard for a command that passes", () => {
    expect(checkCommand("ls")).toBeNull();
  });

  it("gives the description of the guard of the project, and none for a built-in guard", () => {
    const project = {
      projectGuards: [{ name: "Publish", description: "  Publishing cannot be undone.  ", action: "confirm" as const, matches: [{ type: "startsWith" as const, text: "npm publish" }] }],
    };
    expect(checkCommand("npm publish --tag next", project)?.description).toBe("Publishing cannot be undone.");
    expect(checkCommand("git clean -fd")?.description).toBeNull();
  });
});

describe("checkCommand: guards of the project", () => {
  const publish = { name: "Publish", action: "confirm" as const, matches: [{ type: "startsWith" as const, text: "npm publish" }] };
  const deploy = { name: "Deploy", action: "block" as const, matches: [{ type: "contains" as const, text: "deploy.sh" }, { type: "endsWith" as const, text: "--prod" }] };

  it("asks for a confirmation when the action is confirm", () => {
    expect(checkCommand("npm publish", { projectGuards: [publish] })?.level).toBe("confirm");
  });

  it("forbids the command when the action is block", () => {
    expect(checkCommand("./deploy.sh now", { projectGuards: [deploy] })?.level).toBe("block");
  });

  it("matches when at least one line matches", () => {
    expect(checkCommand("make all --prod", { projectGuards: [deploy] })?.level).toBe("block");
    expect(checkCommand("make all", { projectGuards: [deploy] })).toBeNull();
  });

  it("lets a guard that forbids win over a guard that asks, whatever the order", () => {
    const hit = checkCommand("npm publish deploy.sh", { projectGuards: [publish, deploy] });
    expect(hit?.level).toBe("block");
    expect(hit?.guard).toEqual({ kind: "project", name: "Deploy" });
  });

  it("puts the name of the guard in the reason", () => {
    expect(checkCommand("npm publish", { projectGuards: [publish] })?.why).toContain("Publish");
    expect(checkCommand("deploy.sh", { projectGuards: [deploy] })?.why).toContain("Deploy");
  });

  it("does not turn off a guard of the project with the list disabled", () => {
    const project = { disabled: ["guards.why.gitClean"], projectGuards: [{ name: "Clean", action: "confirm" as const, matches: [{ type: "contains" as const, text: "git clean" }] }] };
    expect(checkCommand("git clean -fd", project)?.guard).toEqual({ kind: "project", name: "Clean" });
  });
});

describe("matchesLine", () => {
  it("contains: finds the text anywhere, and ignores the case", () => {
    expect(matchesLine("Run NPM Publish now", { type: "contains", text: "npm publish" })).toBe(true);
    expect(matchesLine("npm test", { type: "contains", text: "npm publish" })).toBe(false);
  });

  it("startsWith: needs the text at the start", () => {
    expect(matchesLine("npm publish", { type: "startsWith", text: "NPM" })).toBe(true);
    expect(matchesLine("sudo npm publish", { type: "startsWith", text: "npm" })).toBe(false);
  });

  it("endsWith: needs the text at the end", () => {
    expect(matchesLine("deploy.sh --prod", { type: "endsWith", text: "--PROD" })).toBe(true);
    expect(matchesLine("deploy.sh --prod now", { type: "endsWith", text: "--prod" })).toBe(false);
  });

  it("ignores the number of spaces in the command and in the text", () => {
    expect(matchesLine("git    reset   --hard", { type: "contains", text: "git  reset --hard" })).toBe(true);
  });

  it("regex: uses a regular expression that ignores the case", () => {
    expect(matchesLine("NPM   PUBLISH", { type: "regex", text: "npm\\s+publish" })).toBe(true);
  });

  it("regex: a regular expression that cannot be read matches nothing", () => {
    expect(matchesLine("ls", { type: "regex", text: "(unclosed" })).toBe(false);
  });

  it("an empty text matches nothing", () => {
    expect(matchesLine("ls", { type: "contains", text: "  " })).toBe(false);
  });
});

describe("tryCommand", () => {
  it("gives the result of each line", () => {
    const result = tryCommand("npm publish", [
      { type: "startsWith", text: "git" },
      { type: "contains", text: "publish" },
      { type: "regex", text: "(unclosed" },
    ]);
    expect(result).toEqual({ isMatch: true, lineResults: ["noMatch", "match", "invalid"] });
  });

  it("says that nothing matches when no line matches", () => {
    expect(tryCommand("ls", [{ type: "contains", text: "rm" }]).isMatch).toBe(false);
  });

  it("uses the flags it is given, so that a built-in regular expression keeps its case rule", () => {
    const sqlDrop = DEFAULT_GUARDS.find((guard) => guard.whyKey === "guards.why.sqlDrop");
    const rm = DEFAULT_GUARDS.find((guard) => guard.whyKey === "guards.why.deleteFilesAsRoot");
    if (sqlDrop === undefined || rm === undefined) {
      throw new Error("guard not found");
    }
    const sqlLines = builtInGuardLines(sqlDrop);
    expect(tryCommand("drop table users", sqlLines.matches, sqlLines.flags).isMatch).toBe(true);
    const rmLines = builtInGuardLines(rm);
    expect(tryCommand("SUDO RM x", rmLines.matches, rmLines.flags).isMatch).toBe(false);
    expect(tryCommand("sudo rm x", rmLines.matches, rmLines.flags).isMatch).toBe(true);
  });
});

describe("builtInGuardLines", () => {
  it("gives one line of the type regex with the source of the regular expression", () => {
    const guard = DEFAULT_GUARDS[0];
    expect(builtInGuardLines(guard)).toEqual({ matches: [{ type: "regex", text: guard.re.source }], flags: guard.re.flags });
  });
});

describe("projectGuardList", () => {
  it("lists the guards of the file, then the old lists block and confirm as guards named after the pattern", () => {
    const list = projectGuardList({
      projectGuards: [{ name: "Publish", action: "confirm", matches: [{ type: "contains", text: "publish" }] }],
      block: ["deploy"],
      confirm: ["make"],
    });
    expect(list.map((guard) => [guard.name, guard.action])).toEqual([
      ["Publish", "confirm"],
      ["deploy", "block"],
      ["make", "confirm"],
    ]);
    expect(list[1].matches).toEqual([{ type: "regex", text: "deploy" }]);
  });

  it("gives an empty list for no project", () => {
    expect(projectGuardList(null)).toEqual([]);
    expect(projectGuardList(undefined)).toEqual([]);
  });
});

describe("DEFAULT_GUARDS", () => {
  it("gives every guard a translation key", () => {
    for (const guard of DEFAULT_GUARDS) {
      expect(guard.whyKey).toMatch(/^guards\.why\./);
    }
  });

  it("gives every guard a translation key for the text that says which commands it stops", () => {
    for (const guard of DEFAULT_GUARDS) {
      expect(guard.whatKey).toBe(guard.whyKey.replace("guards.why.", "guards.what."));
    }
  });
});
