import type { Forge } from "./refs";

/**
 * The path of a file below the root of a repository, with forward slashes and no start slash.
 * @param root - the root of the repository, or null when it is not known
 * @param path - the absolute path of the file
 * @returns the path below the root, or null when the root is not known or the file is not below the root
 */
export function relativeFilePath(root: string | null, path: string): string | null {
  if (root === null) {
    return null;
  }
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix) && path.length > prefix.length ? path.slice(prefix.length) : null;
}

/**
 * The address of a file on the web page of its repository, on the default branch of the repository.
 * @param base - the address of the repository on its forge, for example https://github.com/heidrun-org/heidrun, or null
 * @param forge - the forge of the repository, or null
 * @param relativePath - the path of the file below the root of the repository
 * @returns the address, or null when the repository has no address or no forge
 */
export function fileWebUrl(base: string | null, forge: Forge | null, relativePath: string): string | null {
  if (base === null || forge === null) {
    return null;
  }
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return forge === "github" ? `${base}/blob/HEAD/${encodedPath}` : `${base}/-/blob/HEAD/${encodedPath}`;
}

/** The name of a file without its folders. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
