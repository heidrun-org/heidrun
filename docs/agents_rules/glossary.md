# Glossary of Heidrun

This document gives one short definition for each word that Heidrun uses for a part of its window. Use these words in the code, in the documents, and in the conversations. One word means one thing, and one thing has one word.

## The three levels that come from Herdr

A workspace holds tabs. A tab holds panes.

```
Workspace
└── Tab
    └── Pane
```

### Workspace

One project folder. In most cases, the folder is one repository. A workspace holds tabs.

### Tab

One entry of the tab bar. A tab belongs to one workspace. A tab holds one or more panes.

### Pane

One terminal inside a tab. The terminal runs a shell or a coding agent, for example Claude Code or Codex. A pane belongs to one tab.

## The parts of the window

### Tab bar

The horizontal row at the top of the viewport, inside the border of the viewport. It shows the tabs of the selected workspace, one entry for each tab.

### Viewport

The main area of the window, between the left sidebar and the right sidebar. It has a border, like each sidebar. It holds the tab bar, the panes of the selected tab that are not pinned, and the column of pinned panes.

### Pinned pane

A pane that the developer keeps visible. The pin button in the header of the pane pins the pane. A pinned pane stays visible, with the same width, when the developer changes tab or workspace.

### Column of pinned panes

The column at the right edge of the viewport. It holds the pinned panes, one above the other, in every tab.

### Left sidebar

The panel on the left of the viewport. It holds sidebar sections.

### Right sidebar

The panel on the right of the viewport. It holds sidebar sections.

### Sidebar section

One part of a sidebar, for example the Needs you, the Scripts, or the Git sidebar section. A sidebar holds several sidebar sections, and shows one sidebar section at a time.

### Chat

One saved conversation between the developer and a coding agent, for example Claude Code or Codex. The coding agent saves each chat in a file on the disk of the developer. A chat belongs to a workspace when the coding agent ran in the folder of that workspace. A chat is not a pane: the pane is the terminal, and the chat is the saved conversation.

### Chats sidebar section

The sidebar section of the right sidebar that lists the chats of the selected workspace. At its top, a header that stays in place holds a line with the selector that chooses the coding agent, the Chats sort dropdown menu, and the two view buttons, then the dynamic topic bar. Below the header, the list shows the title of each chat of that coding agent, with a summary of three lines under the title. Under the list, the buttons "Show less" and "Show more" change the number of chats.

### Chats sort dropdown menu

The dropdown menu at the top of the Chats sidebar section, at the left of the two view buttons. Its button shows the name of the chosen sort key, with an icon that shows the chosen order. It has two parts: "Sort by" chooses what the chats are sorted by (created on, last updated, messages from you, issues, pull requests, or files written), and "Order" chooses "Ascending" (the smallest value first) or "Descending" (the largest value first), for the sort key that was chosen. It looks like the sort dropdown menu of the list of issues of GitHub.

### Dynamic topic

One short label of one or two words that Heidrun computes from the content of a chat, for example "sidebar" or "cache". Nobody writes it by hand. A chat has one to three dynamic topics. The Chats sidebar section shows them on the row of the chat.

### Raw dynamic topic

A dynamic topic exactly as it comes out of one chat. With the method "Keyword", Heidrun computes it from this chat and the other chats of the list, and it never asks a coding agent. With the method "Language model", a coding agent finds it from the title and the first messages of this chat. The same subject can get several raw dynamic topics, for example "sidebar" and "side bar".

### Clustered dynamic topic

The name of a cluster, which is a group of raw dynamic topics that have a close meaning. A clustered dynamic topic gives one label to one subject. The option "Enable clustered dynamic topics" of the Settings window makes the dynamic topic bar and the rows of the chats show clustered dynamic topics instead of raw dynamic topics.

### Translation table

The table, saved on the disk in the file `topic_clusters.json`, that gives the cluster of each raw dynamic topic. A coding agent, `codex` or `claude`, fills it, one call for all the new raw dynamic topics. A saved row never changes, except at a rebuild.

### Dynamic topic source information

The data that Heidrun reads in a chat to compute its dynamic topics. It has four parts: the title of the chat, the first messages that the developer typed, the folders of the files that the coding agent wrote, and the titles of the GitHub issues and of the pull requests that the chat mentioned. The messages of the coding agent are not part of it.

### Dynamic topic extraction

The choice of the method that computes the dynamic topics: "Keyword" (from the words of the dynamic topic source information, without a language model) or "Language model" (from the title and the first messages of each chat, with a coding agent, `codex` or `claude`, that is installed on this computer). The Settings window holds the choice, in its section "Dynamic topics", under the title "Extraction method".

### Dynamic topic bar

The row of small rounded buttons in the header of the Chats sidebar section, below the line of the selector of the coding agent, the Chats sort dropdown menu, and the two view buttons. The first button, "All", shows every chat. Each other button is one dynamic topic, the strongest first, and shows only the chats that have the topic. An arrow at its end, and an arrow at its start, move the bar by three topics.

### Sidebar icon bar

The narrow vertical bar of icons at the outer edge of each sidebar, like the bar of icons of Visual Studio Code. It shows one icon for each sidebar section of that sidebar. A click on an icon shows that sidebar section. When the sidebar is collapsed, the sidebar icon bar is the only part of the sidebar that stays visible.

### Status bar

The horizontal row at the bottom of the window. It holds status bar sections.

### Status bar section

One part of the status bar. It shows one piece of information, for example the usage of Claude, the usage of Codex, or the Git branch. A click on a status bar section opens its information card.

### Information card

A small card that opens on a click, never when the mouse pointer only moves over its part. It gives more detail about that part, and it can hold buttons. It opens above a status bar section, at the left of a part of a sidebar, or below a circled question mark of a page of the Settings window. The part gets a background while the pointer is over it and while the information card is open. A second click on the part, the key Escape, a click outside, and the loss of the keyboard focus close the information card. The files line of a chat in the Chats sidebar section has the first information card that opens at the left of a part of a sidebar.

### Workspace status bar section

The first status bar section, at the left end of the status bar. It shows the status dot and the name of the selected workspace. Its information card gives the details of the selected workspace, and lists the workspaces to select, rename, close, move, or create.

## Rules

- The word "tab" means only a tab of Herdr, as defined above. An icon of a sidebar icon bar is not a tab.
- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.
- The word "chat" means only a saved conversation, as defined above. A pane is not a chat.
- Write "dynamic topic bar" in full. Do not write "filter bar" or "chips" for it.
- Write "dynamic topic source information" in full.
- Write "raw dynamic topic" and "clustered dynamic topic" in full, and "translation table" for the table of the clusters. Do not write "category", "group name", or "mapping" for them. Do not write "source", "metadata", or "meta information" for it.
- The word "section" is never alone. Write "sidebar section" or "status bar section".
- Write "pinned pane" and "column of pinned panes". Do not write "docked pane", "side view", or "alongside".
