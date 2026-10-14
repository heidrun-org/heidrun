### browse_files.md
- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder and control which folders are open in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Browse the folder tree: Explain how to select a workspace that is a Git repository, unfold folders, and open a file; note which files and optional ignored folders appear.
  - Refresh or fold the tree: Explain how **Refresh** reads the tree again and **Collapse all folders** folds every folder.
  - Troubleshooting: Explain what to do when the selected workspace is not a Git repository.
- Troubleshooting: “The Files sidebar section says the workspace is not a Git repository.”
- Related pages: `open_a_file.md`, `create_a_file_or_folder.md`, `files_sidebar_reference.md`
- Leave out: Internal file limits, sorting implementation, and unrelated Files window controls.

### open_a_file.md
- Action: keep
- Page type: how-to
- Title: Open a file
- Reader goal: Open a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/components/GitModal.vue`
- Sections:
  - Open a file from the Files sidebar section: Give the steps to find and open a file, and explain that an unchanged file appears as a whole file with **Diff** and **Side by side** disabled.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `copy_a_file_path.md`
- Leave out: Controls and behavior of the large Git window that are unrelated to opening a file.

### create_a_file_or_folder.md
- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the repository of the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose where to create the item: Explain how the selected folder, selected file, or no selection determines the destination.
  - Create the file or folder: Give the steps to choose **New file** or **New folder**, enter a name, and confirm; explain that a new file opens in the large Git window and a new row is selected.
  - Troubleshooting: Explain what to do when the name contains `/` or already exists, and how to cancel name entry.
- Troubleshooting: “The name box stays open after Enter.”
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `open_a_file.md`
- Leave out: File editing, renaming, moving, and deletion.

### copy_a_file_path.md
- Action: keep
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s absolute path or its path relative to the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`
- Sections:
  - Copy a file path: Explain how to open a file row’s context menu, choose one of the two path options, and confirm the copied path in the message Heidrun shows.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: File or folder context menus outside the Files sidebar section.

### change_the_files_list_appearance.md
- Action: change
- Page type: how-to
- Title: Change the Files sidebar section appearance
- Reader goal: Adjust indentation, row height, and indent guides in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose the appearance: Give the steps to choose indentation, row height, and whether indent guides show; state that the choices are saved.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `create_a_file_or_folder.md`
- Leave out: Internal setting names and exact pixel sizes.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up what the Files sidebar section shows and what its controls do.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Folder tree: Describe tracked and new files, optional ignored folders, folders that cannot unfold, sorting, changed-file marks, and the message shown when the list is too long.
  - Header buttons: Describe the five buttons in their displayed order.
  - More options: List the indentation, row height, and indent guide choices.
  - Selecting and folding rows: Explain row selection, clearing selection, and how selection and folder state behave when changing sidebar sections or workspaces.
  - Opening files: Describe how file rows open in the large Git window and what happens for an unchanged file.
  - File context menu: List the two path-copy choices and explain that folders have no context menu.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `copy_a_file_path.md`
- Leave out: Internal setting names, implementation details, and step-by-step task instructions.

### Sidebar

- Get started: Introduction
- How-to guides: Browse files and folders; Open a file; Create a file or folder; Copy a file path; Change the Files sidebar section appearance
- Reference: Files sidebar section; Keyboard shortcuts