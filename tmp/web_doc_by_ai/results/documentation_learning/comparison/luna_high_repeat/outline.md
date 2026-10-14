### browse_files.md
- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder and choose which folders are open in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Browse the folder tree: Explain how to open the Files sidebar section, find entries, and fold or unfold folders; mention that ignored folders appear only when the matching option is enabled and cannot be unfolded.
  - Refresh or fold the tree: Explain **Refresh** and **Collapse all folders**.
  - Troubleshooting: Explain what to do when the selected workspace is not a Git repository.
  - Related pages: Link to opening a file, creating a file or folder, and looking up the Files sidebar section.
- Troubleshooting: The Files sidebar section says the workspace is not a Git repository.
- Related pages: `open_a_file.md`, `create_a_file_or_folder.md`, `files_sidebar_reference.md`
- Leave out: How to open a file in detail, create entries, or change the tree’s appearance.

### open_a_file.md
- Action: keep
- Page type: how-to
- Title: Open a file
- Reader goal: View a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/components/GitModal.vue`; `packages/apps/web_frontend/src/i18n/locales/en/gitModal.json`
- Sections:
  - Open a file from the Files sidebar section: Give the steps to select a workspace and click a file, and explain what appears for an unchanged file.
  - Related pages: Link to browsing the folder tree, the Files sidebar section reference, and copying a file path.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `copy_a_file_path.md`
- Leave out: How to browse the tree or copy a path.

### create_a_file_or_folder.md
- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the selected workspace’s repository.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/desktop_tauri/src/files.rs`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose where to create the item: Explain how the selected folder, selected file, or no selection determines the destination.
  - Create the file or folder: Give the steps, explain the selected new row and the large Git window behavior for a new file, and say how to cancel the name box.
  - Troubleshooting: Explain what to do when a name contains `/` or already exists.
  - Related pages: Link to browsing for a destination, opening a file, and looking up the header controls.
- Troubleshooting: The name box stays open after Enter.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Renaming, moving, deleting, or editing files.

### copy_a_file_path.md
- Action: keep
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s absolute path or its path relative to the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Copy a file path: Give the steps to open the file’s context menu, choose a path, and paste it; mention the confirmation message.
  - Related pages: Link to browsing for a file, opening it, and looking up the folder tree.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Copying paths for folders or changing files.

### change_the_files_list_appearance.md
- Action: change
- Page type: how-to
- Title: Change the appearance of the folder tree
- Reader goal: Adjust the indentation, row height, and indent guides in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`
- Sections:
  - Choose the folder tree appearance: Give the steps for choosing indentation, row height, and whether to show indent guides.
  - Related pages: Link to browsing the tree, looking up the available choices, and creating a file or folder.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`, `create_a_file_or_folder.md`
- Leave out: Internal setting names, exact dimensions, and defaults.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up what the folder tree shows and what its controls do.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`; `packages/apps/web_frontend/src/components/FilesPanel.vue`; `packages/apps/web_frontend/src/stores/files.ts`; `packages/apps/web_frontend/src/components/GitModal.vue`; `packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json`; `packages/apps/web_frontend/src/i18n/locales/en/gitModal.json`
- Sections:
  - Folder tree contents and rows: Describe the listed files and folders, their order, ignored folders, status marks, and row contents.
  - Header buttons: Use a table to describe the five buttons and their actions.
  - More options: Use a table to list the choices for indentation, row height, and indent guides; explain that a check mark shows the active choice.
  - Selection and open folders: Describe how selection and folder state behave when changing workspaces, sidebar sections, or closing the large Git window.
  - File context menu: Describe the two path-copy choices and the confirmation message.
  - Related pages: Link to browsing the tree, opening a file, and copying a path.
- Troubleshooting: None.
- Related pages: `browse_files.md`, `open_a_file.md`, `copy_a_file_path.md`
- Leave out: Step-by-step tasks covered by the how-to pages, internal setting names, exact dimensions, and defaults.

### Sidebar
- Get started
  - Introduction — `index.md`
- How-to guides
  - Browse files and folders — `browse_files.md`
  - Open a file — `open_a_file.md`
  - Create a file or folder — `create_a_file_or_folder.md`
  - Copy a file path — `copy_a_file_path.md`
  - Change the appearance of the folder tree — `change_the_files_list_appearance.md`
- Reference
  - Files sidebar section — `files_sidebar_reference.md`
  - Keyboard shortcuts — `shortcuts.md`