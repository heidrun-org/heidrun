# Judgement of the documentation: 3.5 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.0 | 3 | 3 | 3 | 2 | 3 | 4 | 20 | 2 sentences | 0 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 4.2 | 4 | 4 | 4 | 5 | 3 | 5 | 10 | 1 sentences | 0 | no | 2 links |
| copy_a_file_path.md | how-to | 4.3 | 4 | 4 | 4 | 5 | 4 | 5 | 11 | 1 sentences | 0 | no | 3 links |
| create_a_file_or_folder.md | how-to | 3.8 | 4 | 4 | 4 | 4 | 3 | 4 | 21 | 2 sentences | 0 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.2 | 3 | 3 | 3 | 3 | 3 | 4 | 32 | 4 sentences | 3 | no | 3 links |
| open_a_file.md | how-to | 3.7 | 3 | 3 | 4 | 4 | 3 | 5 | 11 | 2 sentences | 0 | no | 3 links |

Site: navigation 3, consistency 3.

- The page 'Change the Files list appearance' is not linked from the section 'Related pages' of any page, and the reference page links to only 3 of the 5 how-to pages (it has no link to 'Create a file or folder' or to the appearance page). Add the missing links, so the reference leads to every task that uses it.
- The page 'Introduction' is a placeholder ('This page is a placeholder') and there is no tutorial page. A new user who opens the sidebar section 'Get started' finds no path to a first success. Write a short tutorial that links to the how-to pages, or remove the entry until the page exists.
- The same words differ between pages: 'Files list' (title and sidebar entry) against 'Files sidebar section' (glossary), and the same Related pages target is described with different sentences ('to open a file in the large Git window' against 'to view a file in the large Git window'). Only 2 of 5 how-to pages have Troubleshooting, and the sections 'Browse the folder tree' and 'Folder tree' overlap, as do the two tables of 'More options'. Use one name and one description for each, and keep the description in one place.

### browse_files.md (3.0)

The facts are right, but a how-to page that mixes a few real actions with a description of the tree is hard to follow.

- The section 'Browse the folder tree' is not a task. Steps 2 and 3 only describe what the tree shows, and the paragraph about status letters and dots is reference content. Replace them with real actions (find a folder, click the row to open it, look for the colored letter to see which file changed) and move the description to the reference page.
- Step 3 says 'If ignored files are shown', but the page never says where to turn that option on. The option is the checkbox 'Ignored files' in the Files window, not in the Files sidebar section. Say where it is, or remove the step.
- The header buttons show only an icon. The page says 'Select Collapse all folders in the header' and does not say that the reader must look for an icon and hover to read its name. The Troubleshooting section also misses two failures the sources show: the message 'Select a workspace.' and the message that only the first files are shown. Step 2 of its solution, 'Open the Files sidebar section', repeats the place where the reader already is.

### change_the_files_list_appearance.md (4.2)

Short, one type, and correct; it only needs the glossary name, the way to find the button, and a visible result.

- The title and the page use 'Files list', a name that is not in the glossary. The glossary name is 'Files sidebar section'. Use the glossary name in the title and in the sidebar entry.
- Step 1 says 'Select More options', but this button shows only three vertical dots. Say 'the button with three vertical dots', or the reader may not find it.
- The page gives no result. Add one line that says each choice applies at once, that a check mark shows the choice in use, and that the choices are kept the next time (the rule says they are saved).

### copy_a_file_path.md (4.3)

Clear and correct three-step page; only the place of the result message and the missing troubleshooting for a right click on a folder weaken it.

- The sentence 'Heidrun shows the copied path in a message' comes after step 3. Put it in step 2 as the result, because the reader sees the message before pasting.
- The page does not say that a folder row has no context menu. This is the failure a reader meets most often. Add a short Troubleshooting section (symptom: no menu appears; cause: the right-clicked row is a folder; solution: right-click a file row; check: the two items appear). Also say that an error message appears if the absolute path cannot be read.
- The Related pages line 'to view a file in the large Git window' uses a name that the page never explains. Use words for a user, as in the other pages.

### create_a_file_or_folder.md (3.8)

A good task page with the right order (choose place, create, cancel, fix); the messages and the unexplained words need work.

- The section 'Cancel' is one sentence under its own heading. Merge it into the steps as a note, and say that clicking anywhere outside the name box also throws away the name that was typed. An empty name closes the box with no message; say that too.
- The Troubleshooting section says only 'An error appears'. Quote the two messages the user can see: 'A name cannot contain the character /. Select a folder first.' and the error for a name that exists already. Then the reader can match the symptom.
- The page says 'the large Git window' and 'the name box' with no explanation. Say that the new file opens in a window that shows its content, and that the name box is a text field that appears in the tree. The buttons 'New file' and 'New folder' show only an icon; say so.

### files_sidebar_reference.md (3.2)

Correct, but a mix of tables and long paragraphs, and it lacks the click actions, the icons, and the defaults that a reader would look up.

- The reference is incomplete. 'Clicking a file or folder selects its row' omits that a click on a file opens the file in the large Git window, and that a click on a folder folds or unfolds it. The table 'Header buttons' has no column for the icon, so the reader cannot match an icon to a name. Add an icon column and a row for the click actions.
- The sections 'Selection and folder state' and 'Refresh and limits' are long paragraphs of behavior, not look-up items. Sentences like 'Each reading checks whether empty folders ... still exist on disk; Heidrun remembers those folders until it restarts' are internal details. Turn them into short table rows or remove them.
- The section 'More options' repeats the page 'Change the Files list appearance', and the section 'Folder tree' repeats 'Browse files and folders'. Keep the full table here and make each how-to page link to it. Also add the three default values and the pixel sizes, because a reference is where a reader looks them up.

### open_a_file.md (3.7)

Short and correct, but the reader learns neither what the window is nor how to leave it, and the first two steps are not actions.

- Steps 1 and 2 are conditions, not actions. Merge into one line 'In the Files sidebar section, click the file row.' and put the Git repository condition in a note, with the message 'This workspace is not a Git repository.' as the symptom.
- The page says 'the large Git window' three times and never says what it is, what it shows, or how to close it. Say that a window opens with the content of the file and that Escape closes it (the file gitModal.json gives 'Close the Git window (Escape)').
- The last paragraph is explanation, not a step: 'An unchanged file appears as a whole file. The Diff and Side by side options are disabled'. Say what the reader sees and what to do (read the file; use Diff only for a changed file), or remove it.