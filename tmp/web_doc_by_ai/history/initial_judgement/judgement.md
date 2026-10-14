# Judgement of the documentation: 3.8 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| copy_a_file_path.md | how-to | 4.5 | 4 | 4 | 5 | 5 | 4 | 5 | 5 | 1 sentences | 0 |
| create_a_file_or_folder.md | how-to | 4.3 | 4 | 4 | 4 | 5 | 4 | 5 | 6 | 1 sentences | 0 |
| files_sidebar.md | reference | 3.5 | 3 | 4 | 4 | 4 | 4 | 2 | 18 | 3 sentences | 1 |
| index.md | tutorial | 3.7 | 3 | 4 | 4 | 3 | 3 | 5 | 6 | 1 sentences | 0 |

Site: navigation 3, consistency 4.

- The tutorial sits at /documentation/, so the 'Documentation' menu opens one three-step lesson and no overview. A reader cannot see that the other pages exist, and the pages do not link to each other: the how-to pages do not link to the reference, and the reference does not link to the how-to pages.
- Words are used without explanation on every page: 'workspace' and 'the large Git window' are never explained for a new user, and 'item' and 'file or folder' are mixed. Add one short explanation of each term, on the first page.
- The reference page repeats the instructions of the how-to pages (the 'New file' and 'New folder' lines, the click on a folder or a file) and leaves out the context-menu rows, so the pages overlap in one place and have a hole in another. The sidebar also covers only the Files section; there is no 'Explanation' group, so nothing says why the section is read-only.

### copy_a_file_path.md (4.5)

Short, correct how-to with clear steps, but a reader who tries a folder row gets no answer and does not learn that the copy worked.

- The page does not say that only a file row has this menu: a right click on a folder row opens nothing, so a reader who wants a folder path is stuck. Add one sentence.
- The page does not say what happens after the click. The source says a message appears with the copied text. Add a third step or a sentence: 'A message shows the copied text. Paste it where you need it.'
- The page never says where the Files sidebar section is or how to open it. Add a short pointer to the first page, or name the folder icon of the left sidebar.

### create_a_file_or_folder.md (4.3)

Clear three-step how-to that is accurate, but it hides the fallback in the wrong step and leaves out the error cases and the empty-folder limit.

- Step 2 mixes the action with a fallback ('If no row is selected...'). Move the fallback into step 1, where the reader chooses the target folder, and say in step 2 that the buttons show only an icon, so the reader finds them by pointing at them.
- Step 3 leaves out the failure cases: the name cannot contain '/', an existing name gives an error and keeps the name box open, and Escape cancels. Add one short note.
- The page does not say that an empty new folder disappears when Heidrun restarts, because Git does not list empty folders. This is the surprise a user meets later. Add one sentence. Also replace the vague word 'item' with 'file or folder', and explain 'the large Git window' in plain words.

### files_sidebar.md (3.5)

Well-shaped reference with tables, but it states one fact that no source supports and leaves out the context menu, the defaults, and the read-only rule.

- Unsupported claim: 'a dot on a folder row marks changed files inside that folder'. The source rule files say nothing about a dot on a folder row; they only give a colored status letter on a changed file. Remove the claim, or add it to the rule file first.
- The page is incomplete as a lookup. It leaves out the right-click menu with 'Copy absolute path' and 'Copy relative path' (and that folders have no menu), the default and pixel size of each option, that 'Collapse all folders' has no 'unfold all' counterpart, and that the section only reads files and creates new empty ones. Add these as table rows.
- The button table lists four buttons, but the menu table is named 'More options' without saying that it opens from the three-dots button, the fifth button. All five buttons show only an icon. Add 'More options' to the buttons table with its icon, and say where the menu opens. Also move the sentence 'Select a folder to fold or unfold it...' into a table of behaviors, because it reads as instructions.

### index.md (3.7)

Accurate and short, but a new user does not learn where to click or what a workspace is, and nothing says the lesson is done.

- This is a three-line how-to, not a tutorial. It has no start state, no result to see, and no 'you now have...' success line. Add one: say what the reader needs first (Heidrun open, with a workspace selected) and what appears at the end.
- A new user cannot find the 'Files sidebar section': it is a folder icon, the first icon of the left sidebar, and the page does not say so. 'Selected workspace' and 'the large Git window' are also not explained. Name the icon and say in plain words what the window shows (the file, as a whole).
- Add a last step that points to the next pages (create a file, copy a path), so the lesson leads somewhere. The shortcut ⌘P to open a project file by name is in the shortcuts page and could be mentioned as the fast way.
