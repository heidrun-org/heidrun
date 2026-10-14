# Judgement of the documentation: 3.9 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.7 | 4 | 3 | 4 | 3 | 4 | 4 | 20 | 2 sentences | 0 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 4.5 | 4 | 4 | 5 | 5 | 4 | 5 | 11 | 1 sentences | 0 | no | 3 links |
| copy_a_file_path.md | how-to | 4.7 | 4 | 4 | 5 | 5 | 5 | 5 | 11 | 1 sentences | 0 | no | 3 links |
| create_a_file_or_folder.md | how-to | 4.0 | 4 | 4 | 4 | 4 | 4 | 4 | 20 | 3 sentences | 0 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.8 | 3 | 3 | 4 | 4 | 4 | 5 | 34 | 3 sentences | 2 | no | 3 links |
| open_a_file.md | how-to | 3.8 | 4 | 3 | 4 | 5 | 3 | 4 | 11 | 1 sentences | 0 | no | 3 links |

Site: navigation 3, consistency 4.

- The sidebar has no tutorial for a new user: the section "Get started" holds only the Introduction. The page "Keyboard shortcuts" is in the sidebar, but no page links to it from Related pages.
- Some Related pages entries are not the next thing the reader needs. For example, the page about appearance leads to "Create a file or folder", and the page about copying a path leads back to "Browse files and folders". The reference page also has no link back to the page about appearance.
- Consistency: only two of five how-to pages have a Troubleshooting section, although "Open a file" has the same condition as "Browse files and folders". The step "click a file to open it" is in two pages. The file name "change_the_files_list_appearance" does not match the title "folder tree". No page describes the icon-only buttons.

### browse_files.md (3.7)

Clear numbered steps and a real Troubleshooting section, but the page mixes in reference details and overlaps with the page "Open a file".

- The paragraph "Folders ignored by Git appear only when the option to show ignored files is enabled..." is a description, not a step, and it does not say where the option is. A reader cannot find the option, so the sentence helps nobody. Name the place of the option, or remove the sentence and keep the fact in the reference page.
- Step 2 ("Find a file or folder in the tree; folders appear before files...") is not an action, and it adds sorting details that belong in the reference page. Step 3 joins two actions with "or". Make the steps: open the Files sidebar section, click a folder to fold or unfold it, click a file to open it.
- The Troubleshooting section covers only "not a Git repository". The sources show two other messages the reader can meet: "Select a workspace." and "The list is too long: only the first files are shown." Add them, or say why the page leaves them out. Step 1 also does not describe the folder icon of the Files sidebar section.

### change_the_files_list_appearance.md (4.5)

Short, accurate, and of one type, but it leaves the reader without the default choices and without a description of the button.

- Step 1 says "Select **More options**", but the button shows only three vertical dots. Say what the button looks like, or say that its name appears when the pointer rests on it.
- The page does not say that steps 2 to 4 are independent choices, that a check mark shows the active choice, or what the default choices are (Medium, Comfortable, Show). A reader who wants to go back to the original look cannot do it.
- The file name says "files_list" but the title and the sidebar say "folder tree". The Related pages entry "Create a file or folder" is not a natural next step after a change of appearance.

### copy_a_file_path.md (4.7)

A clean three-step how-to that is accurate and in user language; it only misses the case of a folder row.

- The page does not say that a folder row has no context menu. A reader who right-clicks a folder sees nothing and has no explanation. Add one sentence, or a short Troubleshooting entry.
- The page does not show what the two choices produce. One example of an absolute path and one of a relative path would let the reader choose without a guess.
- The sentence "Heidrun shows the copied path in a message." is a result, not a step. Put it in step 2 or 3 as the check that the copy worked.

### create_a_file_or_folder.md (4.0)

Useful and mostly accurate, with a good Troubleshooting section, but the destination choice is hidden before the steps and one real trap is missing.

- The Troubleshooting entry joins two causes (a name with `/`, and a name that already exists) under one cause. The code shows two different error messages. Split the entry in two, or tell the reader to read the error message to know which cause applies.
- The section "Choose where to create the item" is a paragraph before the steps, so the reader must remember it. Make it step 1, with the result in each case (selected folder, folder of the selected file, repository root). The new-folder buttons also show only icons, and the page does not describe them.
- The page does not warn that a new empty folder disappears from the tree when Heidrun restarts. The reader who creates a folder for later will lose it. Add one sentence here, not only in the reference page.

### files_sidebar_reference.md (3.8)

Accurate and well supported by its sources, but two sections are still paragraphs and the table content is incomplete for a page that people use to look things up.

- The sections "Folder tree contents and rows" and "Selection and open folders" are dense paragraphs with five or six facts each. A reference page is for looking up. Turn them into tables or short bullet lines: one fact per line.
- Facts that a reader looks up are missing, although the rule file has them: the meaning of the status letters, the default of each choice in "More options", the keys Enter and Escape in the name box, when the tree is read again, the place of the Files icon, and the three messages "Select a workspace.", "This workspace is not a Git repository.", and "The list is too long...".
- The table "Header buttons" gives names only, and the buttons show only icons. Add a column that says what each icon looks like. The sentence "file and folder icons are grey" is filler and can go.

### open_a_file.md (3.8)

Correct and short, but it repeats a step of another page and uses two button names that the reader has not learned.

- Steps 1 and 2 are conditions, not actions, and step 3 repeats step 3 of the page "Browse files and folders". Merge the two pages, or make this page add something new, for example what the reader sees for a changed file and how to close the large Git window.
- The last sentence uses the button names **Diff** and **Side by side** without saying what they are. A new reader does not know why they are disabled. Say in plain words: the file has no changes, so there is nothing to compare.
- The page has no Troubleshooting section, although it needs a Git repository like the page "Browse files and folders", which has one. Add the symptom, the cause, the solution, and a check, or link to that section.