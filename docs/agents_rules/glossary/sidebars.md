# Glossary of Heidrun: sidebars

- Created: 14 October 2026
- Last updated: 14 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](index.md), [User interface of Heidrun: sidebars](../user_interface/sidebars/index.md)
- Related issue: [issue 405](https://github.com/heidrun-org/heidrun/issues/405)

This document gives one short definition for each word of the sidebars and their sidebar sections. The other words of Heidrun are in [index.md](index.md).

## The sidebars

### Left sidebar

The panel on the left of the viewport. It holds sidebar sections.

### Right sidebar

The panel on the right of the viewport. It holds sidebar sections.

### Sidebar section

One part of a sidebar, for example the Needs you, the Scripts, the Source control, or the Files sidebar section. A sidebar holds several sidebar sections, and shows one sidebar section at a time.

### Source control sidebar section

The sidebar section of the left sidebar that shows the Git changes of the selected workspace, as the source control view of VS Code does. From the top: a header with the title "Source Control" and its buttons, the commit message box, the commit button, the group "Staged Changes", and the group "Changes". It shows only the local Git repository, nothing of GitHub or GitLab. It replaces the Git sidebar section.

### Code hosting sidebar section

The sidebar section of the left sidebar that shows what lives on GitHub or on GitLab for the repository of the selected workspace: a list of the open issues, and a list of the open pull requests (GitHub) or merge requests (GitLab). A row has three lines and no button. A click on a row opens an information card. The words for its search, such as "saved search", are in [code_hosting.md](code_hosting.md).

### Files sidebar section

The sidebar section of the left sidebar that shows the whole folder tree of the Git repository of the selected workspace. A click on a folder folds or unfolds it. A click on a file opens the file in the large Git window. A right click on a file opens a context menu that copies the path of the file. It only reads files.

### Sidebar icon bar

The narrow vertical bar of icons at the outer edge of each sidebar, like the bar of icons of Visual Studio Code. It shows one icon for each sidebar section of that sidebar. A click on an icon shows that sidebar section. When the sidebar is collapsed, the sidebar icon bar is the only part of the sidebar that stays visible.

## Rules

- The word "section" is never alone. Write "sidebar section" or "status bar section".
