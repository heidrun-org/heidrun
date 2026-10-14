# Judgement of the documentation: 3.6 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.5 | 3 | 3 | 4 | 4 | 3 | 4 | 20 | 1 sentences | 0 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 3.7 | 3 | 3 | 4 | 5 | 3 | 4 | 11 | 1 sentences | 0 | no | 3 links |
| copy_a_file_path.md | how-to | 4.3 | 3 | 4 | 5 | 5 | 4 | 5 | 11 | 1 sentences | 0 | no | 3 links |
| create_a_file_or_folder.md | how-to | 3.8 | 3 | 4 | 4 | 4 | 4 | 4 | 19 | 2 sentences | 0 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.7 | 3 | 4 | 4 | 3 | 4 | 4 | 33 | 3 sentences | 0 | yes | 3 links |
| open_a_file.md | how-to | 3.5 | 3 | 2 | 4 | 5 | 3 | 4 | 11 | 1 sentences | 0 | no | 3 links |

Site: navigation 3, consistency 3.

- The 'Get started' section goes to a placeholder page and there is no tutorial. No page says how to open the Files sidebar section. The page 'Change the Files list appearance' is in the Related pages of no other page, and the reference links to only three of the four how-to pages.
- The same facts are on several pages: the Troubleshooting section is in two pages with the same words, and opening a file is in three pages. The Related pages lines often give the same weak reason, such as 'to look up what the tree shows'.
- The words change from page to page: 'Files list', 'Files sidebar section', 'folder tree', and 'tree'. 'Large Git window' is never explained. The page of shortcuts says that a right click in the 'File explorer' gives rename, move, and Trash, and no page explains how that differs from the Files sidebar section.

### browse_files.md (3.5)

Clear steps, but the reader cannot start without a guess, and the page repeats other pages.

- Step 1 does not say how to open the Files sidebar section (the folder icon, the first icon of the sidebar icon bar). The header buttons have only an icon, so say that the name shows when the pointer rests on a button.
- The Troubleshooting section is word for word the same as in the page 'Files sidebar section'. It also leaves out two messages that the Files sidebar section can show: 'Select a workspace.' and 'The list is too long: only the first files are shown.'
- The section 'Refresh or fold the tree' is one paragraph with two actions. Turn it into steps, and say that no button unfolds every folder. 'Folders appear before files...' is reference detail, so remove it.

### change_the_files_list_appearance.md (3.7)

Short and correct, but it reads as a list of menu names with no result and no check.

- Steps 2 to 4 are three independent choices written as one sequence. Say 'choose any of these', and say that a check mark shows the choice that is on.
- 'Files list' is not a glossary term, and it is in the title and in the sidebar. Use 'Files sidebar section'. Also say that 'More options' is the button with three vertical dots at the right end of the header.
- The page gives no result and no check. Say that the choices are saved, and say what the defaults are (Medium, Comfortable, Show). The link 'Create a file or folder' does not help the reader here.

### copy_a_file_path.md (4.3)

Accurate and in the right order, but it does not warn about the folder rows, which is the failure the reader is most likely to meet.

- Only a file row has the context menu. A right click on a folder row does nothing. Add a short Troubleshooting section with the symptom, the cause, the solution, and a check.
- Step 1 does not say how to open the Files sidebar section. It does not say that the workspace must be a Git repository.
- Step 3 is filler. Replace it with one line that says when to choose the absolute path and when to choose the relative path (relative to the folder of the workspace).

### create_a_file_or_folder.md (3.8)

Good first draft with a correct Troubleshooting section. It is missing the cancel behavior and the loss of an empty folder after a restart.

- Say that the key Escape, or a click outside the name box, cancels the creation. A reader who clicks away loses the name box. Also say that an empty new folder is forgotten when Heidrun restarts, because Git does not list an empty folder.
- The section 'Choose where to create the item' does not say how to put the item in the repository root when a row is selected (click the empty space of the Files sidebar section). Make it the first numbered step.
- The two header buttons have only an icon, and the page does not say how to open the Files sidebar section. Say that an error message appears when the name already exists or contains /, as the Troubleshooting section expects.

### files_sidebar_reference.md (3.7)

A useful skeleton with two good tables, but incomplete for a page that readers use to look things up.

- The page leaves out facts that a reference must hold. The facts are: the context menu items 'Copy absolute path' and 'Copy relative path' on file rows only; the name box rules (Enter, Escape, no /); the meaning of the status letters (M, A, D, R, U); the defaults of the three options; and the two messages 'Select a workspace.' and 'The list is too long...'. It also does not say that the section only creates files and folders, and never renames, moves, deletes, or edits them.
- 'Selecting rows' and 'Opening files' are prose, and the Troubleshooting section has numbered steps. Both break the reference type. Put the prose in tables, and do not repeat the Troubleshooting text of 'Browse files and folders'.
- 'The tree shows files tracked by Git and new files' leaves out the ignored folders, which show but do not unfold. The Related pages do not link 'Create a file or folder' or 'Change the Files list appearance'.

### open_a_file.md (3.5)

Correct but thin, and it adds almost nothing to the two pages that already say the same.

- The page repeats step 3 of 'Browse files and folders' and the section 'Opening files' of the reference. Merge it into 'Browse files and folders', or add what is unique: a changed file opens with a diff, and how to close the large Git window.
- Steps 1 and 2 are preconditions, not actions ('Find the file' has no way to do it). Link to 'Browse files and folders', and say how to open the Files sidebar section.
- 'Large Git window' is not defined in the glossary and the page does not explain it. The page covers only the unchanged file, and it has no Troubleshooting for 'Select a workspace.' or for a workspace that is not a Git repository.