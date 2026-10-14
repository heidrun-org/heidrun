### browse_files.md
- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder and control which folders are open in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Browse the folder tree: Explain which files and folders appear, their order, and how to fold or unfold a folder.
  - Refresh or fold the tree: Explain how to reread the tree and fold every folder.
  - Troubleshooting: Explain what the reader sees when the selected workspace is not a Git repository and how to choose a Git workspace.
  - Related pages: Link to the reference, open-a-file, and create-a-file-or-folder pages.
- Troubleshooting: The Files sidebar section says the workspace is not a Git repository.
- Related pages: `files_sidebar_reference.md`, `open_a_file.md`, `create_a_file_or_folder.md`
- Leave out: File opening steps, row appearance settings, selection colors, and implementation details.

### open_a_file.md
- Action: keep
- Page type: how-to
- Title: Open a file
- Reader goal: Open a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/components/GitModal.vue`; `packages/apps/web_frontend/src/i18n/locales/en/gitModal.json`
- Sections:
  - Open a file from the Files sidebar section: Explain how to find and open a file, and what appears for an unchanged file.
  - Related pages: Link to browsing, the Files sidebar section reference, and copying a file path.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `copy_a_file_path.md`
- Leave out: File creation, path copying, and internal window behavior.

### create_a_file_or_folder.md
- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the selected workspace’s repository.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose where to create the item: Explain how the selected row determines the destination folder, or how the repository root is used when no row is selected.
  - Create the file or folder: Give the steps, explain how to cancel, and state that a new file opens in the large Git window.
  - Troubleshooting: Explain what happens when a name contains `/` or already exists, and how to correct the name.
  - Related pages: Link to browsing, the Files sidebar section reference, and opening a file.
- Troubleshooting: The name box stays open after an invalid or already-used name.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `open_a_file.md`
- Leave out: Rename, move, delete, or edit actions; those are not available in the Files sidebar section.

### copy_a_file_path.md
- Action: keep
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s absolute path or its path relative to the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Copy a file path: Explain how to open the file’s context menu, choose a path, and confirm the copied text.
  - Related pages: Link to browsing, opening a file, and the Files sidebar section reference.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Folder context menus and other file changes.

### change_the_files_list_appearance.md
- Action: keep
- Page type: how-to
- Title: Change the Files list appearance
- Reader goal: Change the indentation, row height, or indent guides in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose the list appearance: Explain where to choose indentation, row height, and whether to show indent guides.
  - Related pages: Link to browsing and the Files sidebar section reference.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`
- Leave out: Exact pixel sizes and internal setting names.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up what the Files sidebar section displays and what its controls do.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Folder tree: Describe tracked and new files, ignored folders when showing ignored files is enabled, empty folders created in Heidrun, ordering, and status marks.
  - Header buttons: Describe the five buttons and their purposes.
  - More options: List the indentation, row height, and indent guide choices.
  - Rows and selection: Describe selecting a row, clearing the selection, and selection being remembered by workspace.
  - Tree updates: Describe when the tree refreshes and that there is no control to unfold every folder.
  - Related pages: Link to browsing, opening a file, and copying a file path.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `copy_a_file_path.md`
- Leave out: Selection colors, exact dimensions, internal setting names, and the unsupported claim that changed folders have a dot.

### Sidebar
- **Get started**
  - Introduction
- **How-to guides**
  - `browse_files.md`
  - `open_a_file.md`
  - `create_a_file_or_folder.md`
  - `copy_a_file_path.md`
  - `change_the_files_list_appearance.md`
- **Reference**
  - `files_sidebar_reference.md`
  - Keyboard shortcuts