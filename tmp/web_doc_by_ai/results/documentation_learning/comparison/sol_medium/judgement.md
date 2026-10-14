# Judgement of the documentation: 3.6 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.5 | 3 | 3 | 3 | 4 | 4 | 4 | 35 | 1 sentences | 3 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 3.7 | 4 | 3 | 3 | 5 | 3 | 4 | 19 | 1 sentences | 0 | no | 2 links |
| copy_a_file_path.md | how-to | 4.3 | 4 | 4 | 4 | 5 | 4 | 5 | 19 | 1 sentences | 1 | yes | 3 links |
| create_a_file_or_folder.md | how-to | 4.0 | 4 | 4 | 4 | 4 | 4 | 4 | 39 | 2 sentences | 2 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.8 | 4 | 4 | 3 | 4 | 4 | 4 | 46 | 2 sentences | 3 | no | 4 links |
| open_a_file.md | how-to | 3.7 | 3 | 3 | 4 | 5 | 3 | 4 | 18 | 1 sentences | 1 | yes | 3 links |

Site: navigation 3, consistency 3.

- The "Get started" section holds only the page Introduction, which is a placeholder ("This page is a placeholder"), and no page has a link back to it. A new user has no tutorial and no entry point; the first page is not a start.
- The page Keyboard shortcuts says that a right click in the file explorer gives "New file or folder, rename / move, Trash", while the Files sidebar section only has a right click on a file to copy its path and has no rename, move, or delete. The five pages and the page Keyboard shortcuts contradict each other, and none of the pages links to the page Keyboard shortcuts.
- The same thing has several names across the pages: "Files list", "folder tree", "file list", "list appearance", "folder-level lines", and "indent guides". Use one name for each thing. The pages "Browse files and folders" and "Open a file" also overlap (both begin with the same three steps), and the term "large Git window" is used in four pages without any definition.

### browse_files.md (3.5)

Correct and well sourced, but padded with filler and with a duplicated step, and the "find a file" goal in the title is only met by unfolding folders one by one.

- Steps 3 and 4 of "Browse the folder tree" are the same action repeated; merge them into one step: "Click folder rows to unfold them until you see the file or folder you need".
- The page splits "Refresh" and "Fold all folders" into two sections of one or two steps each, and adds filler ("Check the folder tree for the updated files and folders", "the tree shows the top-level rows with their folders folded"). Put both under one section "Keep the tree tidy", or cut the filler.
- Troubleshooting: "Select a workspace." and "This workspace is not a Git repository." have the same solution, "Select a workspace that is a Git repository", and the page never says how to select a workspace. Merge them or add the step. The message "The list is too long: only the first files are shown." is a failure the reader can meet in a large repository, but the page does not mention it.

### change_the_files_list_appearance.md (3.7)

Right facts and right type, but the vocabulary is mixed and one section is filler; the reader cannot find the default choices.

- The words change from one place to the next: the title says "Files list", the text says "folder-level guide lines" and "folder tree", the menu says "Indent guides". Use the names of the screen and of the other pages: "Files sidebar section", "folder tree", "indent guides".
- The section "Check the appearance" is filler: step 2 ("check the check mark") repeats the menu. Delete the section, or write the check in the steps ("The folder tree changes at once").
- The page does not give the default choice of each group (Medium, Comfortable, Show), so a reader cannot go back to the start state. It also repeats "Reopen More options" in each section, although the three choices make one task; one numbered list with three choices would be shorter.

### copy_a_file_path.md (4.3)

Short, accurate and almost ready; only the wording of the check and of the menu name needs repair.

- Step 4, "Check the message showing the copied path", is a check and not an action, and the message text is not given. Write the real text: "Copied: <path>".
- The section title "Copy a file path" repeats the title of the page, and the path-copy menu is called "small menu" in step 2 and "path-copy menu" in Troubleshooting. Use one name for the menu.
- The Troubleshooting case only repeats a rule ("right-click a file, not a folder"). It is useful but it is better as one line in step 2: "Folder rows have no menu".

### create_a_file_or_folder.md (4.0)

The best how-to of the set: clear order and a useful destination table, but it hides one side effect and gives a long fix where a short one exists.

- The table says to "Click the file row" to choose the destination, but a click on a file row also opens the file in the large Git window. The page does not say this, so the reader is surprised. Add that side effect.
- Troubleshooting for the slash: the name box stays open after the error, so the shortest fix is to remove the "/" and press Enter. The page sends the reader through Escape and four more steps; give the short fix first, then the long one for a wanted folder.
- "An existing-name error appears" does not quote the message; the message comes from the operating system and is not fixed. Say that the message text can differ, and describe the symptom as "a red message appears and the name box stays open". The "large Git window" is named without a word of explanation.

### files_sidebar_reference.md (3.8)

Accurate and mostly in tables, but it is missing the click actions and the defaults, and its order puts rare cases first.

- There is no table of mouse actions, so the page does not say what a click on a folder row, a click on a file row, and a right click on a file row do. The page also does not say that the section only reads files and creates new empty ones (no rename, move, or delete); the reader may look for those buttons. Add a table "Mouse actions" and one sentence about what the section cannot do.
- The order does not follow what the reader looks up first: the page begins with a paragraph on ignored files, a rare case, before the header buttons and the mouse actions. Start with Header buttons, then Mouse actions, then Row indicators; move "Empty folders and list limits" and the ignored-files paragraph to the end.
- "Selection and folder state" and "Empty folders and list limits" are prose paragraphs inside a reference page, and "The list is too long..." says what the message means but not what to do. Turn them into short table rows, and give the defaults of "More options" (Medium, Comfortable, Show).

### open_a_file.md (3.7)

Correct but thin: it repeats the browse page, leaves a key term unexplained, and presents a normal behavior as a failure.

- The "large Git window" is never explained. Say in one sentence that it is the same window as the Source control sidebar section and how to close it, or the reader does not know what opens.
- The Troubleshooting case "Diff and Side by side are disabled" is not a failure; the buttons are disabled by design when a file has no change. The solution "Read the whole file already displayed" is not a solution and the check has no value. Move this to one note after step 4 ("For a file with no change, the window shows the whole file and the buttons Diff and Side by side are disabled").
- Steps 1 to 3 repeat the page "Browse files and folders". Replace steps 1 to 3 with a link to that page, and keep only "Click the file row".