# The status dot

- Created: 12 October 2026
- Last updated: 13 October 2026
- Status: Maintained description of the status dot
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../agents_rules/glossary.md)

The status dot is a small colored circle. It shows the status of a pane, of a tab, of a workspace, and of the application, so that the developer sees at a glance which panes work, which one waits for an answer, and which one has finished. The three levels (workspace, tab, pane) have the definitions of [the glossary](../agents_rules/glossary.md).

## The statuses

A pane has one status at a time.

| Status | Color | Meaning |
| --- | --- | --- |
| Blocked | Red | The coding agent stopped, and it needs an answer from the developer: a question or a permission. |
| Working | Blue | The coding agent works, or a command runs in a plain terminal. The dot fades in and out slowly while the pane works. |
| Finished | Green | The coding agent or the command ended its work, and the developer did not acknowledge it yet. The value in the code is `done`. |
| Idle | Gray | The pane waits for work: the developer did not send a message to the coding agent, or did not start a command. It is also the status after the developer acknowledged or deleted the card of a finished pane. |

- The code sets the colors with the variables `--blocked`, `--working`, `--done`, and `--idle` in `packages/apps/web_frontend/src/styles.css`.
- Herdr has a fifth value, `unknown`. Herdr gives it when no rule matches the pane. The dot of this status is gray.
- A hollow gray ring is not a status. It shows that no coding agent runs in the workspace.

## The status of a pane

### A pane with a coding agent

When the developer starts a coding agent in a pane, the pane is idle. The next table gives each change of status, and the event that causes it.

| From | To | Event |
| --- | --- | --- |
| Idle | Working | The developer sends a message to the coding agent, and the agent starts to work. |
| Working | Blocked | The coding agent needs an answer, and it waits. |
| Blocked | Working | The developer answers, and the coding agent continues. |
| Working | Finished | The coding agent ends its answer. |
| Finished | Idle | The developer acknowledges or deletes the card of the pane in the Needs you sidebar section. |

A finished pane stays finished until the developer acknowledges or deletes its card.

```
idle ──▶ working ──▶ finished ──▶ idle
            │  ▲
            ▼  │
          blocked
```

### A pane with a plain terminal

A pane that runs a plain terminal follows the same state machine, so that every pane works in the same way.

- The pane starts idle.
- The pane becomes working when the developer starts a command that is not a coding agent, for example `htop`.
- The pane becomes finished when the command ends.
- A finished pane becomes idle in the same way as a pane with a coding agent: the developer acknowledges or deletes its card in the Needs you sidebar section.
- When the command is a coding agent, the pane stays idle until the developer sends a message to the agent.

## The status of a tab

The status of a tab comes from the statuses of the panes of the tab. Herdr computes it, and Heidrun shows it in the tab bar (`TabBar.vue`). The status with the highest priority wins, in this order:

1. Blocked
2. Working
3. Finished
4. Idle
5. Unknown

- One blocked pane makes the whole tab blocked, even when the other panes work.
- Herdr says in its documentation that a blocked pane makes its tab and its workspace blocked. The order of the other statuses was observed on Herdr 0.9.3 for Finished before Idle before Unknown. Heidrun uses the complete order in `STATUS_RANK` in `packages/apps/web_frontend/src/lib/tab_icon.ts`, to choose the icon of the tab.
- The dot of a tab pulses once when a pane of the tab becomes blocked.

## The status of a workspace

The status of a workspace comes from the statuses of the tabs of the workspace, with the same priority as for a tab. Herdr computes it. Heidrun shows it before the name of each workspace in the information card of the workspace status bar section (`dotClassesOf` in `WorkspaceStatusSummary.vue`).

A workspace in which no pane runs a coding agent shows the hollow ring in the place of a color.

## The status of the application

The application has one status dot, before the name of the selected workspace in the workspace status bar section, at the left end of the status bar (`dotClasses` in `WorkspaceStatusSummary.vue`). Two rules choose its color, in this order:

1. When a coding agent in **another** workspace is blocked, the dot is red. Otherwise, when a coding agent in another workspace has finished, the dot is green. The coding agents of the selected workspace never count here.
2. Otherwise, the dot shows the status of the selected workspace, or the hollow ring when no coding agent runs in it.

A coding agent in another workspace counts for the first rule only when its card is in the Needs you sidebar section (`otherWorkspaceStatus` in `session.ts`). A card leaves the section when the developer acknowledges or deletes it, and its pane becomes idle. The card of a finished coding agent also leaves the section when it is older than the delay of the section "Finished items" of the Settings window (15 minutes at the start), and an old card does not count for the dot. A coding agent that works in another workspace does not change the dot.

## The levels together

```
Application ◀── other workspaces: blocked, then finished
     │            (otherwise the selected workspace)
Workspace   ◀── the tabs of the workspace
     │
Tab         ◀── the panes of the tab
     │
Pane        ◀── the state machine of the pane
```

| Dot | Where it shows | How its status is chosen |
| --- | --- | --- |
| Pane | The header of the pane (`PaneCard.vue`) | The state machine of the pane. |
| Tab | The tab bar (`TabBar.vue`) | Herdr, from the panes of the tab. |
| Workspace | The list of workspaces in the information card (`WorkspaceStatusSummary.vue`) | Herdr, from the tabs of the workspace. |
| Application | The workspace status bar section (`WorkspaceStatusSummary.vue`) | Heidrun, from the cards of the Needs you sidebar section, then from the selected workspace. |
