### browse_files.md

- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder in the repository of the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`
- Sections:
  - Browse the folder tree: Give numbered steps to select a workspace, click the folder icon at the top of the left sidebar icon bar, and unfold folders to find a row.
  - Refresh the folder tree: Explain how to use **Refresh** after changes outside Heidrun and check the resulting list.
  - Collapse all folders: Explain how to fold every folder with the minus-in-a-square header button.
  - Troubleshooting: Cover workspace messages, **Refresh** being disabled during loading, and the message that only the first files are shown.
  - Related pages: Link to opening files, creating files or folders, and the reference page.
- Troubleshooting: “Select a workspace.”; “This workspace is not a Git repository.”; **Refresh** is disabled while loading; “The list is too long: only the first files are shown.” — the sources provide no recovery for list truncation.
- Related pages: `open_a_file.md`, `create_a_file_or_folder.md`, `files_sidebar_reference.md`
- Leave out: Sorting implementation, automatic reload triggers, exact list limits, and unsupported remedies for omitted files.

### open_a_file.md

- Action: change
- Page type: how-to
- Title: Open a file
- Reader goal: View a repository file in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`
- Sections:
  - Open a file from the Files sidebar section: Give numbered steps to find and click a file, check that the large Git window opens, and close the large Git window with **Escape**.
  - Troubleshooting: Explain why **Diff** and **Side by side** are disabled for an unchanged file and how to view the whole file with **File**.
  - Related pages: Link to browsing files, copying a path, and the reference page.
- Troubleshooting: **Diff** and **Side by side** are disabled because the selected file has no changes.
- Related pages: `browse_files.md`, `copy_a_file_path.md`, `files_sidebar_reference.md`
- Leave out: Editing, staging, committing, unrelated large Git window controls, and internal file-loading details.

### create_a_file_or_folder.md

- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in the intended repository folder.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`
- Sections:
  - Choose the destination: Give numbered steps for selecting a folder, selecting a file to use that file’s folder, or clicking empty space to use the repository root.
  - Create the file or folder: Locate **New file** and **New folder** in the header, describe the name box beneath the destination folder, and separate entering the name from pressing **Enter**.
  - Cancel creation: Explain cancellation with **Escape** or a click outside the name box.
  - Troubleshooting: Cover rejected names and the disappearance of newly created empty folders after restarting Heidrun.
  - Related pages: Link to browsing files, opening files, and the reference page.
- Troubleshooting: The name box stays open because the name contains `/` or already exists; a newly created empty folder no longer appears after restarting Heidrun because Git does not list empty folders — do not imply that the folder was deleted or promise that **Refresh** restores the row.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Backend calls, stored folder lists, rename, move, delete, editing, and unsupported recovery instructions.

### copy_a_file_path.md

- Action: change
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file’s location for use elsewhere.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`
- Sections:
  - Copy a file path: Explain an absolute path as the full location on the computer and a relative path as the location from the workspace folder, then give numbered steps to right-click a file and choose the appropriate menu item.
  - Troubleshooting: Explain that folder rows have no path-copy menu and direct the reader to choose a file row.
  - Related pages: Link to browsing files, opening files, and the reference page.
- Troubleshooting: The path-copy menu does not appear when the reader right-clicks a folder.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Clipboard implementation, menu positioning, repeated menu descriptions, and invented clipboard-error remedies.

### change_the_files_list_appearance.md

- Action: change
- Page type: how-to
- Title: Change the Files list appearance
- Reader goal: Adjust spacing and folder-level guides in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`
- Sections:
  - Change the list appearance: Locate **More options** as the three vertical dots in the header, explain the three choices in plain words, and give numbered steps that reopen the menu before each additional choice.
  - Check the selected choices: Explain that the tree changes immediately, check marks identify the selected choices, and Heidrun saves the choices.
  - Related pages: Link to browsing files and the reference page.
- Troubleshooting: none
- Related pages: `browse_files.md`, `files_sidebar_reference.md`
- Leave out: Pixel measurements, defaults, setting names, storage implementation, and unsupported settings-recovery advice.

### files_sidebar_reference.md

- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up the Files sidebar section’s controls, row meanings, and limits.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`, `docs/agents_rules/glossary.md`
- Sections:
  - Folder tree: Describe tracked and new files, alphabetical ordering with folders first, and ignored folders appearing only when the option to show ignored files is enabled.
  - Header buttons: Use a table listing the five buttons in screen order, their icon descriptions, and their effects.
  - More options: Use a table describing **Indentation**, **Row height**, and **Indent guides**, with their named choices and the meaning of a check mark.
  - Rows and selection: Use a table describing folder arrows, file icons, status letters, the dot for folders containing changes, and the selected-row appearance.
  - Selection and folder state: Describe selection belonging to each workspace, selection surviving sidebar changes and closing the large Git window, and returning to a workspace revealing its selected row.
  - File context menu: Use a table describing **Copy absolute path** and **Copy relative path**, with no procedural instructions.
  - Availability and limits: Describe workspace messages, loading and truncation messages, ignored folders that cannot unfold, empty-folder visibility until restart, and the absence of rename, move, delete, or edit controls.
  - Related pages: Link to the task guides instead of repeating their instructions.
- Troubleshooting: none; remove the existing troubleshooting steps and retain descriptive messages and limits.
- Related pages: `browse_files.md`, `create_a_file_or_folder.md`, `copy_a_file_path.md`, `change_the_files_list_appearance.md`
- Leave out: Task steps, repeated file-opening instructions, exact dimensions and colors, internal identifiers, and implementation details.

### Sidebar

1. **Get started**
   - Introduction — `index.md` — unchanged.
2. **How-to guides**
   - Browse files and folders — `browse_files.md`
   - Open a file — `open_a_file.md`
   - Create a file or folder — `create_a_file_or_folder.md`
   - Copy a file path — `copy_a_file_path.md`
   - Change the Files list appearance — `change_the_files_list_appearance.md`
3. **Reference**
   - Files sidebar section — `files_sidebar_reference.md`
   - Keyboard shortcuts — `shortcuts.md` — unchanged.