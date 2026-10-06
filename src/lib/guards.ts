// Commands that destroy data or rewrite history: never sent on a single click.

export interface Guard {
  re: RegExp;
  why: string;
}

export const DEFAULT_GUARDS: Guard[] = [
  { re: /\brm\s+(?:-\S+\s+)*(-[a-zA-Z]*[rRf]|--recursive\b|--force\b)/, why: "suppression de fichiers (rm -r / -f)" },
  { re: /\bsudo\s+rm\b/, why: "suppression de fichiers en root (sudo rm)" },
  { re: /\bfind\b[^|;&]*\s-delete\b|\bfind\b[^|;&]*-exec\s+rm\b/, why: "suppression de fichiers (find -delete)" },
  { re: /\b(shred|srm)\b/, why: "effacement définitif de fichiers" },
  { re: /\bprune\b[^|;&]*\s-(a|af|fa)\b|\bprune\b[^|;&]*--all\b|\bsystem\s+prune\b/, why: "nettoyage Docker (prune)" },
  { re: /\bdocker\s+(rm|rmi|volume\s+rm)\b[^|;&]*\s-f\b/, why: "suppression forcée Docker" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+push\b[^|;&]*(\s--force\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s--force-with-lease\b|\s\+\S|\s--delete\b|\s-d\b|\s\S+\s+:\S)/, why: "push forcé ou suppression de branche distante" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+reset\b[^|;&]*--hard\b/, why: "git reset --hard (modifications perdues)" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+clean\b[^|;&]*\s-[a-zA-Z]*f/, why: "git clean -f (fichiers non suivis supprimés)" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+branch\b[^|;&]*\s-D\b/, why: "suppression de branche" },
  { re: /\bgit\b(?:\s+-[Cc]\s+\S+)*\s+(checkout\s+(-f\b|--\s+\.)|restore\b[^|;&]*\s\.(\s|$)|stash\s+(clear|drop)\b)/, why: "modifications locales abandonnées" },
  { re: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, why: "suppression SQL (DROP / TRUNCATE)" },
  { re: /\bDELETE\s+FROM\s+[\w."`]+\s*(;|"|'|$)/i, why: "DELETE sans WHERE" },
  { re: /\b(mkfs|fdisk|diskutil\s+erase\w*)\b/, why: "formatage de disque" },
  { re: /\bdd\s+[^|;&]*\bof=/, why: "écriture brute sur un disque (dd)" },
  { re: />\s*\/dev\/(disk|sd|nvme)/, why: "écriture sur un périphérique" },
  { re: /\bchmod\s+(-R\s+)?777\b|\bchown\s+-R\b/, why: "droits modifiés récursivement" },
  { re: /\b(kubectl|helm)\s+(delete|uninstall)\b/, why: "suppression Kubernetes" },
  { re: /\bterraform\s+(destroy|apply\s+[^|;&]*-auto-approve)\b/, why: "terraform destructif" },
  { re: /\b(glab|gh)\s+(mr|pr)\s+merge\b/, why: "fusion de MR / PR" },
  { re: /\bprod(uction)?\b[^|;&]*\b(rm|drop|delete|restart|stop|down)\b|\b(rm|drop|delete|restart|stop|down)\b[^|;&]*\bprod(uction)?\b/i, why: "action sur la production" },
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
      /* invalid regex in .herdr-desk.json: ignored */
    }
  }
  return out;
}

/** What the command triggers, if anything. Blocking wins over confirming. */
export function checkCommand(command: string, project?: ProjectGuards | null): GuardHit | null {
  const cmd = command.replace(/\s+/g, " ").trim();
  for (const re of compile(project?.block)) if (re.test(cmd)) return { level: "block", why: `interdit par le projet (${re.source})` };
  for (const re of compile(project?.confirm)) if (re.test(cmd)) return { level: "confirm", why: `motif du projet (${re.source})` };
  for (const g of DEFAULT_GUARDS) if (g.re.test(cmd)) return { level: "confirm", why: g.why };
  return null;
}
