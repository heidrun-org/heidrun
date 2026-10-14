# Judgement of the documentation: 3.3 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.2 | 3 | 3 | 3 | 3 | 3 | 4 | 21 | 2 sentences | 0 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 3.8 | 3 | 3 | 4 | 5 | 4 | 4 | 12 | 1 sentences | 0 | no | 3 links |
| copy_a_file_path.md | how-to | 4.3 | 4 | 4 | 5 | 5 | 4 | 4 | 11 | 1 sentences | 0 | no | 3 links |
| create_a_file_or_folder.md | how-to | 3.3 | 3 | 3 | 3 | 4 | 3 | 4 | 19 | 3 sentences | 0 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.2 | 3 | 3 | 3 | 3 | 3 | 4 | 31 | 5 sentences | 1 | no | 3 links |
| open_a_file.md | how-to | 3.5 | 3 | 2 | 4 | 5 | 3 | 4 | 11 | 1 sentences | 0 | no | 3 links |

Site: navigation 2, consistency 3.

- The first sidebar entry, 'Get started > Introduction', opens a placeholder page ('This page is a placeholder'). There is no tutorial, so a new reader has no path to a first success and no page says where the Files sidebar section is. Write the Introduction page or hide the entry until then.
- Three pages say the same thing: 'Browse files and folders' step 4, 'Open a file', and the reference section 'Opening files'. The page 'Files sidebar section' and the page 'Copy a file path' also share the context menu text. Keep one place for each fact and link to it.
- Names and Related pages are uneven. The file name says 'files list' while the title says 'Files sidebar section'. Related pages are mostly the same three links, and some do not give the reader a useful next step (for example 'Create a file or folder' under the appearance page). 'Keyboard shortcuts' is in the sidebar but no Files page links to it.

### browse_files.md (3.2)

The steps are clear and the Troubleshooting section is accurate, but a new user cannot find the Files sidebar section from this page. The page also repeats other pages and does not match its own title.

- No page says where the Files sidebar section is. Step 2 says 'Open the Files sidebar section', but the sources put its icon first in the left sidebar icon bar. Add that location.
- 'When the option to show ignored files is on' does not say where the option is. It is a checkbox in the Files window, not in this sidebar section. Name where it is, or remove the sentence.
- The page mixes tasks. Step 4 (open a file) repeats 'Open a file'. The sentence 'Heidrun also reads the tree again when the repository or its changed-file count changes' is an internal detail. The header buttons are icon-only, and the page never says so. Remove the repeated step and the internal sentence, and say how to recognise each button.

### change_the_files_list_appearance.md (3.8)

It is a short and correct how-to page, but it hides the one action that matters (open the menu again for each choice) and gives no defaults.

- 'More options' is an icon button (three vertical dots), and the page does not say so. The menu also closes after each choice, so the reader must reopen it for steps 3 and 4. Say both.
- The page does not give the current defaults (Medium, Comfortable, Show), the sizes behind each choice, or the check mark that shows the current choice. A reader cannot go back to the original look or see what 'Small' changes. Add them, here or in the reference page.
- The title says 'Files sidebar section appearance' but the file name says 'files list'. The last related page ('Create a file or folder') does not help with appearance.

### copy_a_file_path.md (4.3)

Short, ordered, and correct. It is the best of the how-to pages, but it leaves out the rule that folders have no menu.

- The page does not say that only file rows have the right-click menu. A reader who right-clicks a folder finds nothing. Add one sentence.
- The H2 repeats the H1 ('Copy a file path'), which adds nothing. Also, filesPanel.json is not a named source, although it holds the English menu labels.
- The page does not say where the path goes (the clipboard) or what the message looks like ('Copied: <path>'). A reader may wonder whether the copy worked.

### create_a_file_or_folder.md (3.3)

The steps are useful, but the page puts a description before them and its Troubleshooting leaves out the most likely failure and the disappearing empty folder.

- The reader meets the destination rules before the steps, as a block of prose. Merge them into the steps: 'Optional: select the destination folder', then 'Select New file or New folder', then 'Type the name in the box that appears in the tree'. Add how to clear the selection (click empty space) to put the item in the root.
- Troubleshooting is incomplete. The message says 'Select a folder first', and the solution does not tell the reader to select the destination folder instead of typing 'src/name'. The page also leaves out that a new empty folder disappears when Heidrun restarts, because Git does not list empty folders. The symptom should name the error message that appears.
- The buttons 'New file' and 'New folder' are icon-only and the page does not say so. 'Press Escape or click outside the name box to cancel' should be a step note, not a paragraph.

### files_sidebar_reference.md (3.2)

Its structure is right for a reference page and the header table is good, but it leaves out the values a reader looks up and relies on prose where tables belong.

- The 'Folder tree' section is one dense paragraph of five sentences, and 'Selecting and folding rows' is also prose. Turn them into tables or short bullets.
- Look-up facts are missing. The reference gives no defaults (Medium, Comfortable, Show) and no sizes (12/20/28 pixels, 24/30 pixels). It does not list the status letters (A, M, D, R, U), and it does not say where the sidebar icon is or where the 'show ignored files' option is. It also omits that the section cannot rename, move, delete, or edit a file.
- The sections 'Opening files' and 'File context menu' repeat the how-to pages, and the 'Selecting and folding rows' text drifts into behaviour description, with some internal detail ('only one row is selected for the current workspace'). Keep them as short table rows and link to the how-to pages.

### open_a_file.md (3.5)

Correct, but it is almost empty. It adds little beyond the other two pages that already say the same thing.

- The page repeats step 4 of 'Browse files and folders' and the 'Opening files' section of the reference. Merge it into one page or give it its own value, for example what a changed file shows compared with an unchanged one.
- 'The large Git window' is not defined as its own glossary entry and the page does not describe it. 'Diff' and 'Side by side' appear with no explanation, and the page does not say how to close the window or what a changed file looks like.
- Step 1 and step 2 repeat what the reader already did on the previous page. The page does not say where the Files sidebar section is.