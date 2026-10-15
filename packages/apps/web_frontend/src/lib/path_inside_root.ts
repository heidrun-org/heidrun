/** Path of `path` relative to `root`, with `/` separators. `null` when `path` is `root` itself or is outside `root`. */
export function pathInsideRoot(root: string, path: string): string | null {
  const rootPath = root.replace(/\/+$/, "");
  return path.startsWith(`${rootPath}/`) ? path.slice(rootPath.length + 1) : null;
}
