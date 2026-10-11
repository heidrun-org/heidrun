import { gaugeLevel } from "./format";

/** One agent in the menu of the status item. */
export type StatusItemAgent = {
  /** Identifier of the pane of the agent. */
  paneId: string;
  /** Name shown in the menu. */
  name: string;
};

/** The agents of one status, with the title of the section of the menu. */
export type StatusItemSection = {
  /** Translated title, with the number of agents. */
  title: string;
  /** The agents of the section. */
  agents: StatusItemAgent[];
};

/** The quota that the fourth slot of the status item shows. */
export type StatusItemQuota = {
  /** Share of the quota already used, from 0 to 100. */
  percent: number;
  /** Colour level of the quota. */
  level: "ok" | "warn" | "crit";
  /** Translated line shown in the menu. */
  text: string;
};

/** Everything the status item in the macOS menu bar shows. The Rust module `status_item.rs` reads the same shape. */
export type StatusItemPayload = {
  blocked: StatusItemSection;
  done: StatusItemSection;
  working: StatusItemSection;
  quota: StatusItemQuota | null;
  /** Translated text of the menu item that shows the main window. */
  openLabel: string;
  /** Translated text of a section without agent. */
  emptyLabel: string;
  /** True when an agent stays blocked for longer than the limit: the whole status item glows red. */
  isUrgent: boolean;
};

/** What `buildStatusItemPayload` needs. */
export type StatusItemInput = {
  /**
   * Every agent of the session. The status is the status of Herdr: "blocked", "done", "working", "idle"...
   * `since` is the time when the agent entered its status, in milliseconds, or `null` when it is not known.
   */
  agents: { paneId: string; name: string; status: string; since: number | null }[];
  /** The current time, in milliseconds. */
  now: number;
  /** How long an agent may stay blocked before the status item glows red, in milliseconds. 0 switches it off. */
  blockedLimitMs: number;
  /** The quota to show, or `null` when no quota is known. */
  quota: { percent: number; text: string } | null;
  /** Translated section titles, without the number of agents. */
  titles: { blocked: string; done: string; working: string };
  openLabel: string;
  emptyLabel: string;
};

function section(input: StatusItemInput, status: "blocked" | "done" | "working"): StatusItemSection {
  const agents = input.agents
    .filter((agent) => agent.status === status)
    .map((agent) => ({ paneId: agent.paneId, name: agent.name }));
  return { title: `${input.titles[status]} (${agents.length})`, agents };
}

/** True when an agent has been blocked for at least the limit. */
function isUrgent(input: StatusItemInput): boolean {
  if (input.blockedLimitMs <= 0) {
    return false;
  }
  return input.agents.some(
    (agent) => agent.status === "blocked" && agent.since !== null && input.now - agent.since >= input.blockedLimitMs,
  );
}

/** Builds the data that the status item shows from the agents and the quota of the session. */
export function buildStatusItemPayload(input: StatusItemInput): StatusItemPayload {
  const percent = input.quota === null ? null : Math.min(100, Math.max(0, input.quota.percent));
  return {
    isUrgent: isUrgent(input),
    blocked: section(input, "blocked"),
    done: section(input, "done"),
    working: section(input, "working"),
    quota: input.quota === null || percent === null ? null : { percent, level: gaugeLevel(percent), text: input.quota.text },
    openLabel: input.openLabel,
    emptyLabel: input.emptyLabel,
  };
}
