// The web address of a skill folder in a public GitHub repository, as the window Find new skills reads it from its search
// field: `https://github.com/<owner>/<repository>/tree/<branch>/<path of the folder>`. This file only tells an address
// from a search. It makes no call to GitHub. The backend, `desktop_tauri/src/skills/folder_address.rs`, reads the same
// address with the same rules, and finds the folder on GitHub.
// - issue #289

/** A skill folder named by a web address. */
export type GithubFolderAddress = {
  /** The address in its normal form, without a query, a fragment, or a slash at the end. */
  url: string;
  /** The GitHub repository, as `owner/repository`. */
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

/**
 * Reads the text of the search field as the address of a skill folder on GitHub.
 * @param text - the text of the search field
 * @returns the skill folder, or `null` when the text is not the address of a skill folder: then it is a search on skills.sh
 */
export function parseGithubFolderAddress(text: string): GithubFolderAddress | null {
  const trimmed = text.trim();
  const prefix = ["https://github.com/", "https://www.github.com/"].find((start) => trimmed.startsWith(start));
  if (prefix === undefined) {
    return null;
  }
  const path = trimmed.slice(prefix.length).split(/[?#]/)[0].replace(/\/+$/, "");
  const [owner, repository, tree, ...parts] = path.split("/");
  if (tree !== "tree" || parts.length < 2 || isSourcePart(owner) === false || isSourcePart(repository) === false) {
    return null;
  }
  const skillId = parts[parts.length - 1];
  if (parts.every(isAddressPart) === false || SKILL_NAME.test(skillId) === false) {
    return null;
  }
  const source = `${owner}/${repository}`;
  return { url: `https://github.com/${source}/tree/${parts.join("/")}`, source, skillId };
}
