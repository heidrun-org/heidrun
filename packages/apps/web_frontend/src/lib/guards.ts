// Commands that destroy data or rewrite history: never sent on a single click.
import { t } from "../i18n/index";
import type { GuardAction, GuardMatch, ProjectGuard, ProjectGuardsConfig } from "./project_config";

export interface Guard {
  re: RegExp;
  /** Translation key of the reason shown in the confirmation window. It is also the key that names the guard. */
  whyKey: string;
  /** Translation key of the text that says which commands the guard stops, shown in the Guards section of the Settings window. */
  whatKey: string;
}

export const DEFAULT_GUARDS: Guard[] = [
  { re: /\brm\s+(?:-\S+\s+)*(-[a-zA-Z]*[rRf]|--recursive\b|--force\b)/, whyKey: "guards.why.deleteFiles", whatKey: "guards.what.deleteFiles" },
  { re: /\bsudo\s+rm\b/, whyKey: "guards.why.deleteFilesAsRoot", whatKey: "guards.what.deleteFilesAsRoot" },
  { re: /\bfind\b[^|;&]*\s-delete\b|\bfind\b[^|;&]*-exec\s+rm\b/, whyKey: "guards.why.findDelete", whatKey: "guards.what.findDelete" },
  { re: /\b(shred|srm)\b/, whyKey: "guards.why.shred", whatKey: "guards.what.shred" },
  { re: /\bprune\b[^|;&]*\s-(a|af|fa)\b|\bprune\b[^|;&]*--all\b|\bsystem\s+prune\b/, whyKey: "guards.why.dockerPrune", whatKey: "guards.what.dockerPrune" },
  { re: /\bdocker\s+(rm|rmi|volume\s+rm)\b[^|;&]*\s-f\b/, whyKey: "guards.why.dockerForceRemove", whatKey: "guards.what.dockerForceRemove" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+push\b[^|;&]*(\s--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s--force-with-lease\b|\s\+\S|\s--delete\b|\s-d\b|\s\S+\s+:\S)/, whyKey: "guards.why.forcePush", whatKey: "guards.what.forcePush" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+reset\b[^|;&]*--hard\b/, whyKey: "guards.why.gitResetHard", whatKey: "guards.what.gitResetHard" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+clean\b[^|;&]*\s-[a-zA-Z]*f/, whyKey: "guards.why.gitClean", whatKey: "guards.what.gitClean" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+branch\b[^|;&]*\s-D\b/, whyKey: "guards.why.deleteBranch", whatKey: "guards.what.deleteBranch" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+(checkout\s+(-f\b|--\s+\.)|restore\b[^|;&]*\s\.(\s|$)|stash\s+(clear|drop)\b)/, whyKey: "guards.why.discardChanges", whatKey: "guards.what.discardChanges" },
  { re: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, whyKey: "guards.why.sqlDrop", whatKey: "guards.what.sqlDrop" },
  { re: /\bDELETE\s+FROM\s+[\w."`]+\s*(;|"|'|$)/i, whyKey: "guards.why.sqlDeleteWithoutWhere", whatKey: "guards.what.sqlDeleteWithoutWhere" },
  { re: /\b(mkfs|fdisk|diskutil\s+erase\w*)\b/, whyKey: "guards.why.formatDisk", whatKey: "guards.what.formatDisk" },
  { re: /\bdd\s+[^|;&]*\bof=/, whyKey: "guards.why.rawDiskWrite", whatKey: "guards.what.rawDiskWrite" },
  { re: />\s*\/dev\/(disk|sd|nvme)/, whyKey: "guards.why.deviceWrite", whatKey: "guards.what.deviceWrite" },
  { re: /\bchmod\s+(-R\s+)?777\b|\bchown\s+-R\b/, whyKey: "guards.why.recursivePermissions", whatKey: "guards.what.recursivePermissions" },
  { re: /\b(kubectl|helm)\s+(delete|uninstall)\b/, whyKey: "guards.why.kubernetesDelete", whatKey: "guards.what.kubernetesDelete" },
  { re: /\bterraform\s+(destroy|apply\s+[^|;&]*-auto-approve)\b/, whyKey: "guards.why.terraformDestroy", whatKey: "guards.what.terraformDestroy" },
  { re: /\b(glab|gh)\s+(mr|pr)\s+merge\b/, whyKey: "guards.why.mergeRequest", whatKey: "guards.what.mergeRequest" },
  { re: /\bprod(uction)?\b[^|;&]*\b(rm|drop|delete|restart|stop|down)\b|\b(rm|drop|delete|restart|stop|down)\b[^|;&]*\bprod(uction)?\b/i, whyKey: "guards.why.production", whatKey: "guards.what.production" },
];

/** The `guards` section of `.heidrun/config.json`, as the file holds it. */
export type ProjectGuards = ProjectGuardsConfig;

/**
 * The guard that stopped a command: a built-in guard, named by its key, or a guard of the project, named by its name.
 */
export type GuardId = { kind: "builtin"; key: string } | { kind: "project"; name: string };

export interface GuardHit {
  level: GuardAction;
  why: string;
  /** The description of the project guard that stopped the command, or null when the guard has none. */
  description: string | null;
  /** The guard that stopped the command. Null when no single guard did, for example when the project file is not valid. */
  guard: GuardId | null;
}

/** The result of one line for one command: the line matches, does not match, or is a regular expression that cannot be read. */
export type LineResult = "match" | "noMatch" | "invalid";

/** The result of a command compared with all the lines of a guard. */
export interface TryResult {
  /** True when at least one line matches. */
  isMatch: boolean;
  /** The result of each line, in the order of the lines. */
  lineResults: LineResult[];
}

/** Each run of spaces becomes one space, and the spaces at the start and at the end are removed. */
export function normalizeCommand(command: string): string {
  return command.replace(/\s+/g, " ").trim();
}

/** The message of the error that a regular expression gives, or null when the regular expression is valid. */
export function regexError(text: string, flags = "i"): string | null {
  try {
    new RegExp(text, flags);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Does the command match one line? The types "contains", "startsWith", and "endsWith" ignore the case and the number of spaces.
 * The type "regex" uses `flags`, which is "i" for a guard of the project. A regular expression that cannot be read matches nothing.
 */
export function matchesLine(command: string, match: GuardMatch, flags = "i"): boolean {
  const normalizedCommand = normalizeCommand(command);
  if (match.text.trim() === "") {
    return false;
  }
  if (match.type === "regex") {
    return regexError(match.text, flags) === null && new RegExp(match.text, flags).test(normalizedCommand);
  }
  const text = normalizeCommand(match.text).toLowerCase();
  const lowerCommand = normalizedCommand.toLowerCase();
  if (match.type === "contains") {
    return lowerCommand.includes(text);
  }
  return match.type === "startsWith" ? lowerCommand.startsWith(text) : lowerCommand.endsWith(text);
}

/** Compares a command with each line of a guard: the field "Try a command" of the guard window shows the result. */
export function tryCommand(command: string, matches: GuardMatch[], flags = "i"): TryResult {
  const lineResults = matches.map((match): LineResult => {
    if (match.text.trim() !== "" && match.type === "regex" && regexError(match.text, flags) !== null) {
      return "invalid";
    }
    return matchesLine(command, match, flags) ? "match" : "noMatch";
  });
  return { isMatch: lineResults.includes("match"), lineResults };
}

/** The lines of a built-in guard: one line of the type "regex", with the flags of the regular expression of the guard. */
export function builtInGuardLines(guard: Guard): { matches: GuardMatch[]; flags: string } {
  return { matches: [{ type: "regex", text: guard.re.source }], flags: guard.re.flags };
}

/**
 * The guards of the project, in the order of the file, then the guards that the old lists `block` and `confirm` hold.
 * Each item of an old list is a guard named after its regular expression, with one line of the type "regex".
 */
export function projectGuardList(project?: ProjectGuards | null): ProjectGuard[] {
  const guards: ProjectGuard[] = [...(project?.projectGuards ?? [])];
  for (const action of ["block", "confirm"] as const) {
    for (const pattern of project?.[action] ?? []) {
      guards.push({ name: pattern, action, matches: [{ type: "regex", text: pattern }] });
    }
  }
  return guards;
}

/** What the command triggers, if anything. Forbidding wins over confirming. */
export function checkCommand(command: string, project?: ProjectGuards | null): GuardHit | null {
  const cmd = normalizeCommand(command);
  const guards = projectGuardList(project);
  for (const action of ["block", "confirm"] as const) {
    for (const guard of guards) {
      if (guard.action !== action || guard.matches.some((match) => matchesLine(cmd, match)) === false) {
        continue;
      }
      const description = guard.description?.trim() ?? "";
      return {
        level: action,
        why: t(action === "block" ? "guards.blockedByProject" : "guards.projectGuard", { name: guard.name }),
        description: description === "" ? null : description,
        guard: { kind: "project", name: guard.name },
      };
    }
  }
  const disabled = new Set(project?.disabled ?? []);
  for (const g of DEFAULT_GUARDS) {
    if (disabled.has(g.whyKey) === false && g.re.test(cmd)) {
      return { level: "confirm", why: t(g.whyKey), description: null, guard: { kind: "builtin", key: g.whyKey } };
    }
  }
  return null;
}
