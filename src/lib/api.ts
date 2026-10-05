import { invoke } from "@tauri-apps/api/core";
import type { CodexUsage, PaneInfo, SessionSnapshot } from "./types";

export function request<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return invoke<T>("herdr_request", { method, params });
}

export function cli(args: string[]): Promise<string> {
  return invoke<string>("herdr_cli", { args });
}

export async function snapshot(): Promise<SessionSnapshot> {
  const r = await request<{ snapshot: SessionSnapshot }>("session.snapshot");
  return r.snapshot;
}

export function watchPanes(paneIds: string[]): Promise<void> {
  return invoke("herdr_watch_panes", { paneIds });
}

export function paths(): Promise<{ socket: string; socket_exists: boolean; bin: string; bin_exists: boolean }> {
  return invoke("herdr_paths");
}

export function codexUsage(sessionIds: string[]): Promise<CodexUsage> {
  return invoke("codex_usage", { sessionIds });
}

// ---- Layout ---------------------------------------------------------------

export async function newTab(workspaceId: string, cwd?: string | null, label?: string): Promise<PaneInfo> {
  const r = await request<{ root_pane: PaneInfo }>("tab.create", {
    workspace_id: workspaceId,
    cwd: cwd ?? null,
    label: label ?? null,
    focus: false,
  });
  return r.root_pane;
}

export async function split(paneId: string, direction: "right" | "down", cwd?: string | null): Promise<PaneInfo> {
  const r = await request<{ pane: PaneInfo }>("pane.split", {
    target_pane_id: paneId,
    direction,
    cwd: cwd ?? null,
    focus: false,
  });
  return r.pane;
}

export function newWorkspace(cwd: string | null, label: string | null) {
  return request("workspace.create", { cwd, label, focus: false });
}

export function closePane(paneId: string) {
  return request("pane.close", { pane_id: paneId });
}

export function renameWorkspace(workspaceId: string, label: string) {
  return request("workspace.rename", { workspace_id: workspaceId, label });
}

export function renameTab(tabId: string, label: string) {
  return request("tab.rename", { tab_id: tabId, label });
}

/** `null` clears the custom label and goes back to the automatic name. */
export function renamePane(paneId: string, label: string | null) {
  return request("pane.rename", { pane_id: paneId, label });
}

export function moveWorkspace(workspaceId: string, insertIndex: number) {
  return request("workspace.move", { workspace_id: workspaceId, insert_index: insertIndex });
}

export function moveTab(tabId: string, insertIndex: number) {
  return request("tab.move", { tab_id: tabId, insert_index: insertIndex });
}

export function closeTab(tabId: string) {
  return request("tab.close", { tab_id: tabId });
}

// ---- Input ----------------------------------------------------------------

export function prompt(target: string, text: string) {
  return request("agent.prompt", { target, text });
}

export function sendKeys(paneId: string, keys: string[]) {
  return request("pane.send_keys", { pane_id: paneId, keys });
}

/** `pane run` submits text + Enter atomically and honours bracketed paste. */
export function run(paneId: string, command: string) {
  return cli(["pane", "run", paneId, command]);
}

export async function read(paneId: string, lines = 80): Promise<string> {
  const r = await request<{ read: { text: string } }>("pane.read", {
    pane_id: paneId,
    source: "recent_unwrapped",
    lines,
  });
  return r.read.text;
}

/** Resolves when a line of the pane matches the regex. */
export async function waitForOutput(paneId: string, regex: string, timeoutMs = 3_600_000): Promise<string | null> {
  const r = await request<{ matched_line?: string | null }>("pane.wait_for_output", {
    pane_id: paneId,
    source: "recent",
    match: { type: "regex", value: regex },
    timeout_ms: timeoutMs,
  });
  return r.matched_line ?? null;
}
