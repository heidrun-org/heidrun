### browse_files.md
- Action: keep
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find files and folders in a workspace’s Files sidebar section and control which folders are open.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`
- Sections:
  - Browse the folder tree: Open the Files sidebar section, then select folders or files in the tree.
  - Refresh or fold the tree: Use **Refresh** to read the tree again or **Collapse all folders** to fold every folder.
- Troubleshooting: The Files sidebar section says the workspace is not a Git repository.
- Related pages: `files_sidebar_reference.md`, `open_a_file.md`, `create_a_file_or_folder.md`
- Leave out: Details about selection persistence, row appearance, and menu choices.

### change_the_files_list_appearance.md
- Action: keep
- Page type: how-to
- Title: Change the Files list appearance
- Reader goal: Adjust indentation, row height, and indent guides in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`
- Sections:
  - Choose the list appearance: Use **More options** to choose indentation, row height, and whether to show indent guides.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `create_a_file_or_folder.md`
- Leave out: Exact pixel sizes, saved setting names, and default choices.

### copy_a_file_path.md
- Action: keep
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s absolute path or its path relative to the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`
- Sections:
  - Copy a file path: Open the file row’s context menu, choose a path type, and paste the copied path.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Context menu closing behavior and the fact that copying does not change a file.

### create_a_file_or_folder.md
- Action: keep
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the repository of the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose where to create the item: Select a folder, a file, or no row to set the destination.
  - Create the file or folder: Use **New file** or **New folder**, enter a name, and press **Enter**.
- Troubleshooting: The name box stays open after Enter because the name contains `/` or already exists in the selected folder.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `open_a_file.md`
- Leave out: Internal storage of empty folders and unsupported rename, move, delete, and edit operations.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up what the Files sidebar section shows and what its controls do.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/components/GitModal.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`; `packages/apps/web_frontend/src/i18n/locales/en/gitModal.json`
- Sections:
  - Folder tree: Describe which files and folders appear, their order, and the status marks for changed files and folders.
  - Header buttons: Explain the purpose of each Files sidebar section header button.
  - More options: List the indentation, row height, and indent guide choices.
  - Selecting rows: Explain how selecting a row works and how to clear the selection.
  - Opening files: Explain where a selected file opens and how unchanged files appear.
- Troubleshooting: The Files sidebar section says the workspace is not a Git repository.
- Related pages: `browse_files.md`, `open_a_file.md`, `copy_a_file_path.md`
- Leave out: Internal setting names, exact dimensions, selection colors, and implementation details.

### open_a_file.md
- Action: keep
- Page type: how-to
- Title: Open a file
- Reader goal: Open a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/components/GitModal.vue`
- Sections:
  - Open a file from the Files sidebar section: Find and select a file to open it in the large Git window.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `copy_a_file_path.md`
- Leave out: How to use the Source control sidebar section and details of diff controls beyond the unchanged-file behavior.

### Sidebar

- Get started: `index.md` (Introduction)
- How-to guides: `browse_files.md` (Browse files and folders), `open_a_file.md` (Open a file), `create_a_file_or_folder.md` (Create a file or folder), `copy_a_file_path.md` (Copy a file path), `change_the_files_list_appearance.md` (Change the Files list appearance)
- Reference: `files_sidebar_reference.md` (Files sidebar section), `shortcuts.md` (Keyboard shortcuts)