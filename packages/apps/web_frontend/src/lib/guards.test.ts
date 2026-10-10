import { describe, expect, it } from "vitest";
import { checkCommand, DEFAULT_GUARDS } from "./guards";

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

describe("DEFAULT_GUARDS", () => {
  it("gives every guard a translation key", () => {
    for (const guard of DEFAULT_GUARDS) {
      expect(guard.whyKey).toMatch(/^guards\.why\./);
    }
  });
});
