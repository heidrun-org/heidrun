### browse_files.md
- Action: change
- Page type: how-to
- Title: Browse files and folders
- Reader goal: Find a file or folder in the repository of the selected workspace.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`
- Sections:
  - Browse the folder tree: Give numbered steps to select a workspace, open **Files** with the first folder icon in the left sidebar icon bar, and unfold folders to find a file.
  - Refresh the folder tree: Explain how to use the circular-arrow **Refresh** button and check the updated list.
  - Fold all folders: Explain how to use **Collapse all folders**, shown as a square containing a minus sign, and reopen individual folders.
  - Troubleshooting: Give supported causes, numbered solutions, and visible checks for workspace selection and a temporarily disabled **Refresh** button.
  - Related pages: Link to opening files, creating files or folders, and the Files reference.
- Troubleshooting: “Select a workspace.” appears; “This workspace is not a Git repository.” appears; **Refresh** is disabled while the list loads.
- Related pages: `open_a_file.md`, `create_a_file_or_folder.md`, `files_sidebar_reference.md`
- Leave out: Polling conditions, shared application state, sorting implementation, exact colors, and repeated descriptions of every control.

### open_a_file.md
- Action: change
- Page type: how-to
- Title: Open a file
- Reader goal: View a file from the Files sidebar section in the large Git window.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`
- Sections:
  - Open a file from the Files sidebar section: Give numbered steps to open **Files**, unfold the containing folders, and click the file row to open the large Git window.
  - Troubleshooting: Explain that **Diff** and **Side by side** are disabled for an unchanged file because there are no changes to compare, and direct the reader to read the whole file already displayed.
  - Related pages: Link to browsing files, copying a path, and the Files reference.
- Troubleshooting: **Diff** and **Side by side** are disabled for an unchanged file.
- Related pages: `browse_files.md`, `copy_a_file_path.md`, `files_sidebar_reference.md`
- Leave out: Editing in the separate Files window, unrelated large Git window controls, highlighting implementation, and invented recovery steps for file-reading errors.

### create_a_file_or_folder.md
- Action: change
- Page type: how-to
- Title: Create a file or folder
- Reader goal: Create an empty file or folder in a chosen location in the repository.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`
- Sections:
  - Choose the destination folder: Give numbered steps to select a folder, select a file to use the containing folder, or click empty space to use the repository root.
  - Create a file or folder: Locate **New file** and **New folder** as the first two header buttons, then separate entering a name from pressing **Enter** and describe the selected new row and the opening of a new file.
  - Cancel creation: Explain how **Escape** or clicking outside the name box cancels creation.
  - Troubleshooting: Separate the unsupported `/` character from an existing name, with a cause, numbered solution, and visible check for each problem.
  - Related pages: Link to finding the destination, opening the created file, and the Files reference.
- Troubleshooting: “A name cannot contain the character /. Select a folder first.” appears; an existing-name error appears and the name box stays open.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Backend calls, folder-memory data structures, renaming, moving, deleting, editing, and unsupported remedies for other creation errors.

### copy_a_file_path.md
- Action: change
- Page type: how-to
- Title: Copy a file path
- Reader goal: Copy a file path in the form needed by another application or a terminal.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`
- Sections:
  - Copy a file path: Give numbered steps to find a file, right-click the file row, choose **Copy absolute path** for the full location or **Copy relative path** for the location from the workspace folder, and check the message showing the copied path.
  - Troubleshooting: Explain that folders have no path-copy menu and give steps to right-click a file row instead.
  - Related pages: Link to finding files, opening files, and the Files reference.
- Troubleshooting: The path-copy menu does not appear when a folder row is right-clicked.
- Related pages: `browse_files.md`, `open_a_file.md`, `files_sidebar_reference.md`
- Leave out: Clipboard implementation, menu positioning calculations, and invented remedies for clipboard or path-resolution errors.

### change_the_files_list_appearance.md
- Action: change
- Page type: how-to
- Title: Change the Files list appearance
- Reader goal: Adjust the spacing and folder-level guide lines in the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`
- Sections:
  - Change indentation: Locate **More options** as the three vertical dots at the right of the header, then give numbered steps to choose **Small**, **Medium**, or **Large** under **Indentation**.
  - Change row height: Give numbered steps to reopen **More options** and choose **Compact** or **Comfortable** under **Row height**.
  - Show or hide indent guides: Explain that indent guides are vertical lines showing folder levels, then give numbered steps to reopen **More options** and choose **Show** or **Hide**.
  - Check the appearance: Describe checking the changed tree and the check mark beside each saved choice.
  - Related pages: Link to browsing files and the Files reference.
- Troubleshooting: none.
- Related pages: `browse_files.md`, `files_sidebar_reference.md`
- Leave out: Pixel measurements, defaults, settings keys, styling variables, and repetition of the reference tables.

### files_sidebar_reference.md
- Action: change
- Page type: reference
- Title: Files sidebar section
- Reader goal: Look up the contents, controls, and visible states of the Files sidebar section.
- Sources: `docs/agents_rules/user_interface/sidebars/files.md`; `docs/agents_rules/glossary.md`
- Sections:
  - Folder tree: Describe tracked and new files, folders before files, alphabetical ordering, and ignored folders appearing without expandable contents when showing ignored files is enabled.
  - Row indicators: Use a table for folder arrows, file-kind icons, changed-file letters, dots marking folders containing changes, and the selected-row outline.
  - Header buttons: List the five buttons in screen order, their identifying appearance, and their purpose, including that the header remains visible while scrolling.
  - More options: Use a table to describe the indentation, row-height, and indent-guide choices and the check mark identifying the saved choice.
  - File path menu: Use a table for **Copy absolute path** and **Copy relative path**, including that the menu belongs to file rows.
  - Selection and folder state: Describe one selected row per workspace, restored selection when returning to a workspace, and retained folder folds when changing sidebar sections.
  - Empty folders and list limits: State that newly created empty folders remain visible until Heidrun restarts, folders removed outside Heidrun disappear after refresh, and the list-too-long message means only part of the list is shown.
  - Related pages: Link to the task pages for browsing, creating, copying paths, and changing appearance.
- Troubleshooting: none; remove the existing numbered troubleshooting instructions from this reference page.
- Related pages: `browse_files.md`, `create_a_file_or_folder.md`, `copy_a_file_path.md`, `change_the_files_list_appearance.md`
- Leave out: Task procedures, exact dimensions and colors, settings keys, internal limits, backend checks, and unrelated Files window features.

### Sidebar
- Get started
  - Introduction — `index.md`; keep unchanged.
- How-to guides
  - Browse files and folders — `browse_files.md`
  - Open a file — `open_a_file.md`
  - Create a file or folder — `create_a_file_or_folder.md`
  - Copy a file path — `copy_a_file_path.md`
  - Change the Files list appearance — `change_the_files_list_appearance.md`
- Reference
  - Files sidebar section — `files_sidebar_reference.md`
  - Keyboard shortcuts — `shortcuts.md`; keep unchanged.