# The status dot

The status dot is a small colored circle. It shows the status of a pane, of a tab, of a workspace, and of the application, so that the developer sees at a glance which coding agents work, which one waits for an answer, and which one has finished. The three levels (workspace, tab, pane) have the definitions of [the glossary](../agents_rules/glossary.md).

## The statuses

A pane has one status at a time. Herdr computes the status, and Heidrun shows it.

| Status | Color | Meaning |
| --- | --- | --- |
| Blocked | Red | The coding agent stopped, and it needs an answer from the developer: a question or a permission. |
| Working | Teal (a green-blue) | The coding agent works. The dot fades in and out slowly while the agent works. |
| Finished | Blue | The coding agent ended its work, and the developer did not see the result yet. The value in the code is `done`. |
| Idle | Gray | The coding agent waits for the first message of the developer, or the developer has seen the result. |

- The colors are the variables `--blocked`, `--working`, `--done`, and `--idle` in `packages/apps/web_frontend/src/styles.css`. Each variable has a value for the dark theme and a value for the light theme.
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
| Finished | Idle | The developer sees the pane. |

Heidrun also handles a change from Blocked to Finished, and a change from Working or Blocked straight to Idle, as the end of the work (`applySnapshot` in `packages/apps/web_frontend/src/stores/session.ts`).

```
idle ──▶ working ──▶ finished ──▶ idle
            │  ▲
            ▼  │
          blocked
```

### The change from Finished to Idle

Herdr makes this change, when the developer has seen the result of the coding agent. Heidrun never sets a status by itself: it only shows the status that Herdr gives. Heidrun does not tell Herdr what is on the screen, and selecting a pane in Heidrun changes only the selection in Heidrun (`selectPane` in `session.ts`).

### A pane without a coding agent

A pane that runs a plain terminal has no coding agent. Herdr gives the status `unknown` to this pane. Heidrun does not show this status: the dot of the pane card is the class `process`, which has the gray color of idle (`status` in `PaneCard.vue`). A command that runs in the terminal, such as `htop`, does not change the dot.

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

1. When a coding agent in **another** workspace is blocked, the dot is red. Otherwise, when a coding agent in another workspace has finished, the dot is blue. The coding agents of the selected workspace never count here, because the developer sees them.
2. Otherwise, the dot shows the status of the selected workspace, or the hollow ring when no coding agent runs in it.

A coding agent in another workspace counts for the first rule only when its card is in the To handle sidebar section (`otherWorkspaceStatus` in `session.ts`). A card is not there when the developer hides it with its close button, or when the coding agent finished longer ago than the delay of the section "Finished items" of the Settings window (15 minutes at the start). A coding agent that works in another workspace does not change the dot.

## The levels together

```
Application ◀── other workspaces: blocked, then finished
     │            (otherwise the selected workspace)
Workspace   ◀── the tabs of the workspace
     │
Tab         ◀── the panes of the tab
     │
Pane        ◀── Herdr reads the coding agent
```

| Dot | Where it shows | Source of its status |
| --- | --- | --- |
| Pane | The header of the pane (`PaneCard.vue`) | Herdr, for the pane. |
| Tab | The tab bar (`TabBar.vue`) | Herdr, from the panes of the tab. |
| Workspace | The list of workspaces in the information card (`WorkspaceStatusSummary.vue`) | Herdr, from the tabs of the workspace. |
| Application | The workspace status bar section (`WorkspaceStatusSummary.vue`) | Heidrun, from the cards of the To handle sidebar section, then from the selected workspace. |
