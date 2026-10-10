// Commands that destroy data or rewrite history: never sent on a single click.
import { t } from "../i18n/index";

export interface Guard {
  re: RegExp;
  /** Translation key of the reason shown in the confirmation window. */
  whyKey: string;
}

export const DEFAULT_GUARDS: Guard[] = [
  { re: /\brm\s+(?:-\S+\s+)*(-[a-zA-Z]*[rRf]|--recursive\b|--force\b)/, whyKey: "guards.why.deleteFiles" },
  { re: /\bsudo\s+rm\b/, whyKey: "guards.why.deleteFilesAsRoot" },
  { re: /\bfind\b[^|;&]*\s-delete\b|\bfind\b[^|;&]*-exec\s+rm\b/, whyKey: "guards.why.findDelete" },
  { re: /\b(shred|srm)\b/, whyKey: "guards.why.shred" },
  { re: /\bprune\b[^|;&]*\s-(a|af|fa)\b|\bprune\b[^|;&]*--all\b|\bsystem\s+prune\b/, whyKey: "guards.why.dockerPrune" },
  { re: /\bdocker\s+(rm|rmi|volume\s+rm)\b[^|;&]*\s-f\b/, whyKey: "guards.why.dockerForceRemove" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+push\b[^|;&]*(\s--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s--force-with-lease\b|\s\+\S|\s--delete\b|\s-d\b|\s\S+\s+:\S)/, whyKey: "guards.why.forcePush" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+reset\b[^|;&]*--hard\b/, whyKey: "guards.why.gitResetHard" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+clean\b[^|;&]*\s-[a-zA-Z]*f/, whyKey: "guards.why.gitClean" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+branch\b[^|;&]*\s-D\b/, whyKey: "guards.why.deleteBranch" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+(checkout\s+(-f\b|--\s+\.)|restore\b[^|;&]*\s\.(\s|$)|stash\s+(clear|drop)\b)/, whyKey: "guards.why.discardChanges" },
  { re: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, whyKey: "guards.why.sqlDrop" },
  { re: /\bDELETE\s+FROM\s+[\w."`]+\s*(;|"|'|$)/i, whyKey: "guards.why.sqlDeleteWithoutWhere" },
  { re: /\b(mkfs|fdisk|diskutil\s+erase\w*)\b/, whyKey: "guards.why.formatDisk" },
  { re: /\bdd\s+[^|;&]*\bof=/, whyKey: "guards.why.rawDiskWrite" },
  { re: />\s*\/dev\/(disk|sd|nvme)/, whyKey: "guards.why.deviceWrite" },
  { re: /\bchmod\s+(-R\s+)?777\b|\bchown\s+-R\b/, whyKey: "guards.why.recursivePermissions" },
  { re: /\b(kubectl|helm)\s+(delete|uninstall)\b/, whyKey: "guards.why.kubernetesDelete" },
  { re: /\bterraform\s+(destroy|apply\s+[^|;&]*-auto-approve)\b/, whyKey: "guards.why.terraformDestroy" },
  { re: /\b(glab|gh)\s+(mr|pr)\s+merge\b/, whyKey: "guards.why.mergeRequest" },
  { re: /\bprod(uction)?\b[^|;&]*\b(rm|drop|delete|restart|stop|down)\b|\b(rm|drop|delete|restart|stop|down)\b[^|;&]*\bprod(uction)?\b/i, whyKey: "guards.why.production" },
];

export interface ProjectGuards {
  /** Regexes (strings) that ask for confirmation. */
  confirm?: string[];
  /** Regexes (strings) that are never sent from the app. */
  block?: string[];
}

export interface GuardHit {
  level: "confirm" | "block";
  why: string;
}

function compile(list: string[] | undefined): RegExp[] {
  const out: RegExp[] = [];
  for (const s of list ?? []) {
    try {
      out.push(new RegExp(s, "i"));
    } catch {
      /* invalid regex in .heidrun/config.json: ignored */
    }
  }
  return out;
}

/** What the command triggers, if anything. Blocking wins over confirming. */
export function checkCommand(command: string, project?: ProjectGuards | null): GuardHit | null {
  const cmd = command.replace(/\s+/g, " ").trim();
  for (const re of compile(project?.block)) if (re.test(cmd)) return { level: "block", why: t("guards.blockedByProject", { pattern: re.source }) };
  for (const re of compile(project?.confirm)) if (re.test(cmd)) return { level: "confirm", why: t("guards.projectPattern", { pattern: re.source }) };
  for (const g of DEFAULT_GUARDS) if (g.re.test(cmd)) return { level: "confirm", why: t(g.whyKey) };
  return null;
}
