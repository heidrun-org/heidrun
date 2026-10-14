### browse_files.md
- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder and control which folders are open in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`, `packages/apps/web_frontend/src/components/FilesPanel.vue`, `packages/apps/web_frontend/src/stores/files.ts`, `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Browse the folder tree: Explain what appears in the tree, how folders and files are ordered, and that ignored folders appear only when ignored files are shown and cannot be opened.
  - Fold and unfold folders: Explain how to open or fold a folder and that **Collapse all folders** folds every folder.
  - Troubleshooting: Explain what to do when the selected workspace is not a Git repository.
  - Related pages: Link to opening a file, creating a file or folder, and looking up the tree and its controls.
- Troubleshooting: The Files sidebar section says the workspace is not a Git repository.
- Related pages: `open_a_file.md`, `create_a_file_or_folder.md`, `files_sidebar_reference.md`
- Leave out: Instructions for opening a file, creating items, copying paths, and changing appearance; these have their own pages.

### change_the_files_list_appearance.md
- Action: change
- Page type: how-to
- Title: Change the Files list appearance
- Reader goal: Adjust indentation, row height, and indent guides in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`, `packages/apps/web_frontend/src/components/FilesPanel.vue`, `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose the list appearance: Show how to open **More options** and choose indentation, row height, and indent guides.
  - Related pages: Link to browsing the tree and looking up the available controls.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`
- Leave out: Internal setting names, exact dimensions, and default choices.

### copy_a_file_path.md
- Action: keep
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s absolute path or its path relative to the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`, `packages/apps/web_frontend/src/components/FilesPanel.vue`, `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Copy a file path: Explain how to open a file row’s context menu, choose a path, and see the copied path.
  - Related pages: Link to finding a file, opening it, and looking up the Files sidebar section.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: The context menu’s implementation details and behavior unrelated to copying a path.

### create_a_file_or_folder.md
- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the selected workspace’s repository.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`, `packages/apps/web_frontend/src/components/FilesPanel.vue`, `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose where to create the item: Explain how the selected row determines the destination folder, and that no selection uses the repository root.
  - Create the file or folder: Explain how to start naming, enter a name, and press **Enter**; say that the new row is selected and a new file opens in the large Git window.
  - Cancel: Explain that **Escape** or clicking outside the name box cancels creation.
  - Troubleshooting: Explain what the reader sees when a name contains `/` or already exists, and how to correct the name.
  - Related pages: Link to finding the destination folder, looking up the controls, and opening a file.
- Troubleshooting: An error appears and the name box stays open because the name contains `/` or already exists.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `open_a_file.md`
- Leave out: File editing, renaming, moving, deleting, and behavior of unrelated Files window controls.

### open_a_file.md
- Action: keep
- Page type: how-to
- Title: Open a file
- Reader goal: Open a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`, `packages/apps/web_frontend/src/components/FilesPanel.vue`, `packages/apps/web_frontend/src/components/GitModal.vue`, `packages/apps/web_frontend/src/i18n/locales/en/gitModal.json`
- Sections:
  - Open a file from the Files sidebar section: Explain how to select a Git workspace, find a file, and open it; describe what appears for an unchanged file.
  - Related pages: Link to finding a file, looking up the Files sidebar section, and copying a path.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `copy_a_file_path.md`
- Leave out: Git window controls beyond the disabled **Diff** and **Side by side** options for an unchanged file.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up what the Files sidebar section shows and what its controls do.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`, `packages/apps/web_frontend/src/components/FilesPanel.vue`, `packages/apps/web_frontend/src/stores/files.ts`, `packages/apps/web_frontend/src/components/GitModal.vue`, `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Folder tree: Describe which files and folders appear, their order, row indicators, and the behavior of ignored folders.
  - Header buttons: Give a table of the five buttons and their actions.
  - More options: Give a table of the indentation, row height, and indent guide choices.
  - Selection and folder state: Describe selection, clearing selection, and how selection and open folders persist across sidebar sections and workspaces.
  - File context menu: Describe which rows have a context menu, its two path-copy actions, and how it closes.
  - Refresh and limits: Describe when the tree is read again, what **Refresh** does, and what the reader sees when the list is too long.
  - Related pages: Link to browsing, opening a file, and copying a path.
- Troubleshooting: none
- Related pages: `browse_files.md`, `open_a_file.md`, `copy_a_file_path.md`
- Leave out: Internal state names, pixel values, visual styling measurements, and implementation details.

### Sidebar
- Get started
  - Introduction
- How-to guides
  - Browse files and folders
  - Open a file
  - Create a file or folder
  - Copy a file path
  - Change the Files list appearance
- Reference
  - Files sidebar section
  - Keyboard shortcuts