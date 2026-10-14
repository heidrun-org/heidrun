### browse_files.md
- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder and control which folders are open.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Find a file or folder: Explain the folder-first alphabetical order and how to fold or unfold folders.
  - Refresh or fold the tree: Explain **Refresh** and **Collapse all folders**.
  - Troubleshooting: Explain what to do when the selected workspace is not a Git repository.
- Troubleshooting: The Files sidebar section says the workspace is not a Git repository.
- Related pages: `files_sidebar_reference.md`, `open_a_file.md`, `create_a_file_or_folder.md`
- Leave out: Instructions for opening files, copying paths, and changing the tree’s appearance.

### change_the_files_list_appearance.md
- Action: change
- Page type: how-to
- Title: Change the appearance of the folder tree
- Reader goal: Adjust how folder depth and rows appear in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose indentation: Explain how to choose **Small**, **Medium**, or **Large** from **More options**.
  - Choose row height and indent guides: Explain the **Row height** and **Indent guides** choices, including what indent guides show.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `create_a_file_or_folder.md`
- Leave out: Default values and pixel measurements.

### copy_a_file_path.md
- Action: keep
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s absolute path or its path relative to the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Copy a file path: Explain how to open the file’s context menu, choose a path, and see the copied path.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Folder context menus and context-menu closing behavior.

### create_a_file_or_folder.md
- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the selected workspace’s repository.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose where to create the item: Explain how the selected folder, selected file, or no selection determines the destination.
  - Create the file or folder: Explain **New file**, **New folder**, entering a name, and how to cancel.
  - Troubleshooting: Explain what to do when the name box stays open after an invalid or already-used name.
- Troubleshooting: The name box stays open after Enter because the name contains `/` or already exists in the destination folder.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `open_a_file.md`
- Leave out: File editing, renaming, moving, and deleting.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up what the folder tree shows and what its controls do.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/components/GitModal.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Folder tree: Describe which files and folders can appear, their order, row contents, and the notice shown when the list is truncated.
  - Header buttons: Describe the five buttons and their actions.
  - More options: List the indentation, row height, and indent-guide choices.
  - Rows and selection: Explain row selection, workspace-specific selection, and what happens when a folder or empty space is clicked.
  - Opening files: Explain the large Git window’s display of an unchanged file and disabled controls.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `copy_a_file_path.md`, `create_a_file_or_folder.md`
- Leave out: Internal setting names, visual color values, and implementation details.

### open_a_file.md
- Action: keep
- Page type: how-to
- Title: Open a file
- Reader goal: View a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/components/GitModal.vue`; `packages/apps/web_frontend/src/i18n/locales/en/gitModal.json`
- Sections:
  - Open a file from the Files sidebar section: Explain how to find and open a file, and what appears for an unchanged file.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `copy_a_file_path.md`
- Leave out: How the large Git window works beyond the result of opening an unchanged file.

### Sidebar

- Get started
  - `index.md` — Introduction
- How-to guides
  - `browse_files.md` — Browse files and folders
  - `open_a_file.md` — Open a file
  - `create_a_file_or_folder.md` — Create a file or folder
  - `copy_a_file_path.md` — Copy a file path
  - `change_the_files_list_appearance.md` — Change the appearance of the folder tree
- Reference
  - `files_sidebar_reference.md` — Files sidebar section
  - `shortcuts.md` — Keyboard shortcuts