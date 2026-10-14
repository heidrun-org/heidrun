# Judgement of the documentation: 3.9 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.7 | 3 | 3 | 4 | 3 | 4 | 5 | 20 | 2 sentences | 0 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 4.7 | 4 | 5 | 5 | 5 | 4 | 5 | 10 | 1 sentences | 0 | no | 2 links |
| copy_a_file_path.md | how-to | 4.7 | 4 | 5 | 4 | 5 | 5 | 5 | 11 | 1 sentences | 0 | no | 3 links |
| create_a_file_or_folder.md | how-to | 4.2 | 4 | 4 | 4 | 4 | 4 | 5 | 19 | 2 sentences | 0 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.5 | 3 | 3 | 3 | 4 | 4 | 4 | 28 | 4 sentences | 1 | no | 3 links |
| open_a_file.md | how-to | 4.3 | 4 | 4 | 5 | 4 | 4 | 5 | 11 | 1 sentences | 0 | no | 3 links |

Site: navigation 3, consistency 3.

- The group 'Get started' holds only the page 'Introduction', which is still a placeholder. No page tells a new reader how to show the Files sidebar section. Add a short tutorial, or add the icon of the section to the first page of the group.
- The sections 'Related pages' are not symmetric. The reference page links to 'Browse', 'Open', and 'Copy', but not to 'Create a file or folder' or 'Change the Files list appearance', although it documents both. The page 'Copy a file path' links to the reference for a menu that the reference does not describe. No page links to 'Keyboard shortcuts'.
- The words and the facts are not consistent. The title 'Change the Files list appearance' uses 'Files list', but the other pages use the glossary word 'Files sidebar section'. 'Large Git window' and 'name box' are not defined for the reader. The order of the tree, the ignored folders, and the buttons 'Refresh' and 'Collapse all folders' appear in several pages. The page 'Keyboard shortcuts' says that a right click in the file explorer gives 'New file or folder, rename / move, Trash', but the Files sidebar section has no rename, move, or Trash.

### browse_files.md (3.7)

Accurate and in good shape, but it mixes description into a how-to page, leaves the reader without a way to open the section, and covers only one of the failures that a reader can meet.

- Step 1 does not say how to open the Files sidebar section. Say in plain words where its icon is: the first icon of the icon bar of the left sidebar, above the Scripts icon.
- Step 2 describes the tree and is not an action. The paragraph after the steps ('The tree shows files tracked by Git... ignored folders...') is reference content that the reference page also holds. It also names 'the option to show ignored files' without saying where the option is. Move the paragraph to the reference page, or say where the option is.
- Troubleshooting covers one symptom only. Add the messages that a reader can meet: 'Select a workspace.' when no workspace is selected, and 'The list is too long: only the first files are shown.' when the repository has too many files. Give each one a cause, a solution, and a check. Also describe the icons of the buttons 'Refresh' and 'Collapse all folders', because the buttons show only an icon.

### change_the_files_list_appearance.md (4.7)

Short, correct, and in the right order; it needs the icon of the button, the glossary word in the title, and the default choices.

- 'More options' is a button that shows only three vertical dots. Say so in step 1, so the reader finds it.
- The title and the first sentence say 'Files list'. The glossary word is 'Files sidebar section', which the other pages use. Rename the title and the first sentence.
- The page does not say that Heidrun keeps the choices, and it does not give the default choices (Medium, Comfortable, Show). The reader cannot go back to the default. Add one sentence.

### copy_a_file_path.md (4.7)

A clear, correct three-step page; only the place of the confirmation message and one missing limit keep it from a 5.

- The sentence 'Heidrun shows a message with the copied path' comes after step 3, but the message appears right after step 2. Attach it to step 2 and show the text that the reader sees: 'Copied: <path>'.
- The page says 'file row' but does not say that a folder row has no menu. A reader who right-clicks a folder gets nothing. Add one short sentence.
- The link 'Files sidebar section' says 'to look up what the tree shows', but the reference page does not describe the menu with 'Copy absolute path' and 'Copy relative path'. Fix the reference page, then say 'to look up the menu of a file row' here.

### create_a_file_or_folder.md (4.2)

Good page with correct facts and a real Troubleshooting section; it needs the empty-folder case and a clearer split of the causes.

- A failure that the reader can meet is missing: a new empty folder disappears from the tree after Heidrun restarts, because Git does not list empty folders. Add it to Troubleshooting with a cause, a solution, and a check.
- The Troubleshooting entry has two causes with one solution, and its symptom does not show the message that the reader sees. Split it into two entries. For the slash, quote the message: 'A name cannot contain the character /. Select a folder first.'
- 'Choose where to create the item' is a prose paragraph before the steps. Make it step 1 of the list, so all actions are in one list. Move the cancel sentence and the result sentence out of the paragraph after step 2 into short separate lines.

### files_sidebar_reference.md (3.5)

Correct as far as it goes, but not complete enough to look things up, and the page that links here for the file menu finds nothing about it.

- The page leaves out what the sources say about the rows: a click on a folder folds or unfolds it, a click on a file opens it in the large Git window, and a right click on a file opens a menu with 'Copy absolute path' and 'Copy relative path'. The section 'Rows and selection' says only that a click selects a row, which is misleading by omission. Add a table 'Actions on a row' that also covers the click on empty space, and say that a folder row has no menu.
- The section 'Folder tree' is one long paragraph, not a table, and its sentence about 'New folder' ('also appear while Heidrun remains open') is hard to understand. Use a table or bullets, and write: 'A new empty folder stays in the tree until Heidrun restarts, because Git does not list empty folders.' Also explain the status letters and the dot on a folder that holds changes.
- The section 'Tree updates' repeats the row 'Collapse all folders' of the table of buttons. Remove the repeat. Add the default of each choice of 'More options' (Medium, Comfortable, Show) and say where the option to show ignored files is.

### open_a_file.md (4.3)

Correct and easy to follow, but thin: it repeats a prerequisite and leaves the reader in a new window with no way out.

- Steps 1 and 2 are conditions that the page 'Browse files and folders' already explains. Turn them into one sentence that links to that page, so the click is the main step.
- The page does not say how to close the large Git window, which is a new window for the reader. The window shows 'Close (Escape)'. Add the key Escape and the close button.
- The last sentence names 'Diff' and 'Side by side' without saying what they are. Say in one line what the reader sees for a changed file (the changes since the last commit) and for an unchanged file (the whole file).