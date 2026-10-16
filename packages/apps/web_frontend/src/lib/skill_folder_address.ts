// The web address of a skill folder in a public GitHub or GitLab repository, as the window Find new skills reads it from its
// field of the source "Code hosting":
// - GitHub: `https://github.com/<owner>/<repository>/tree/<branch>/<path of the folder>`
// - GitLab: `https://gitlab.com/<group>/<project>/-/tree/<branch>/<path of the folder>`, and the project can be in subgroups.
// This file only reads an address. It makes no call to GitHub or GitLab. The backend, `desktop_tauri/src/skills/folder_address.rs`,
// reads the same address with the same rules, and finds the folder.
// - issue #289
// - issue #609

/** The code hosting service that holds the repository of a skill folder. */
export type CodeHost = "github" | "gitlab";

/** A skill folder named by a web address. */
export type SkillFolderAddress = {
  /** The address in its normal form, without a query, a fragment, or a slash at the end. */
  url: string;
  /** The service that holds the repository. */
  host: CodeHost;
  /** The repository: `owner/repository` on GitHub, `group/project` (with the subgroups) on GitLab. */
  source: string;
  /** The folder name of the skill: the last part of the address. */
  skillId: string;
};

const SOURCE_PART = /^[A-Za-z0-9_.-]+$/;
const ADDRESS_PART = /^[A-Za-z0-9_.~+@-]+$/;
const SKILL_NAME = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;

function isSourcePart(part: string): boolean {
  return part !== "." && part !== ".." && SOURCE_PART.test(part);
}

function isAddressPart(part: string): boolean {
  return part !== "." && part !== ".." && ADDRESS_PART.test(part);
}

/** The text after the prefix, without the query, the fragment, and the slashes at the end. */
function addressPath(trimmed: string, prefixes: string[]): string | null {
  const prefix = prefixes.find((start) => trimmed.startsWith(start));
  if (prefix === undefined) {
    return null;
  }
  return trimmed.slice(prefix.length).split(/[?#]/)[0].replace(/\/+$/, "");
}

/** The repository and the parts after `tree/`, or `null` when the text is not the address of a folder on GitHub. */
function readGithub(trimmed: string): { source: string; parts: string[] } | null {
  const path = addressPath(trimmed, ["https://github.com/", "https://www.github.com/"]);
  if (path === null) {
    return null;
  }
  const [owner, repository, tree, ...parts] = path.split("/");
  if (tree !== "tree" || isSourcePart(owner) === false || isSourcePart(repository) === false) {
    return null;
  }
  return { source: `${owner}/${repository}`, parts };
}

/** The project and the parts after `/-/tree/`, or `null` when the text is not the address of a folder on GitLab. */
function readGitlab(trimmed: string): { source: string; parts: string[] } | null {
  const path = addressPath(trimmed, ["https://gitlab.com/"]);
  if (path === null) {
    return null;
  }
  const separator = path.indexOf("/-/tree/");
  if (separator === -1) {
    return null;
  }
  const source = path.slice(0, separator);
  const sourceParts = source.split("/");
  if (sourceParts.length < 2 || sourceParts.every(isSourcePart) === false) {
    return null;
  }
  return { source, parts: path.slice(separator + "/-/tree/".length).split("/") };
}

/**
 * Reads the text of the field as the address of a skill folder on GitHub or on GitLab.
 * @param text - the text of the field
 * @returns the skill folder, or `null` when the text is not the address of a skill folder
 */
export function parseSkillFolderAddress(text: string): SkillFolderAddress | null {
  const trimmed = text.trim();
  const github = readGithub(trimmed);
  const gitlab = github === null ? readGitlab(trimmed) : null;
  const found = github ?? gitlab;
  if (found === null) {
    return null;
  }
  const { source, parts } = found;
  const skillId = parts[parts.length - 1];
  if (parts.length < 2 || parts.every(isAddressPart) === false || SKILL_NAME.test(skillId) === false) {
    return null;
  }
  if (github !== null) {
    return { url: `https://github.com/${source}/tree/${parts.join("/")}`, host: "github", source, skillId };
  }
  return { url: `https://gitlab.com/${source}/-/tree/${parts.join("/")}`, host: "gitlab", source, skillId };
}
