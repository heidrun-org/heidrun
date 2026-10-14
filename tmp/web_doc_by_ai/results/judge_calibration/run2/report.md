# Judgement of the documentation: 4.5 out of 5

Rubric 2; scope: selected pages; agent: claude; model: claude-sonnet-5-5; effort: high.

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sample_90.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 12 | 2 sentences | 0 | no | 2 links |
| sample_73.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 16 | 3 sentences | 0 | yes | 2 links |
| sample_46.md | reference | 4.5 | 5 | 5 | 5 | 5 | 5 | 2 | 15 | 3 sentences | 0 | no | 2 links |
| sample_12.md | how-to | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 12 | 2 sentences | 0 | no | 2 links |
| sample_81.md | how-to | 4.8 | 5 | 5 | 5 | 5 | 5 | 4 | 16 | 3 sentences | 0 | yes | 2 links |
| sample_34.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_55.md | how-to | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 16 | 3 sentences | 0 | yes | 2 links |
| sample_28.md | how-to | 4.2 | 3 | 5 | 5 | 5 | 5 | 2 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_63.md | how-to | 4.2 | 2 | 5 | 3 | 5 | 5 | 5 | 20 | 2 sentences | 1 | yes | 2 links |
| sample_07.md | reference | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 15 | 3 sentences | 0 | no | 2 links |
| sample_42.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_19.md | how-to | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 21 | 3 sentences | 1 | yes | 2 links |

Site: navigation 5, consistency 5.



Limitations and outside-scope observations (not scored):

- The pages are independent candidates. Site scores are set to 5 as required.
- Candidate names for the pages 'Read a Markdown file' and 'Read a TypeScript file' are not in the supplied sidebar. This cannot change any score here.
- The rule file says the empty folder is remembered until Heidrun restarts. I did not run the application to see a restart.

### sample_90.md (4.0)

The page describes a feature that does not exist for the file type it names, so the task fails.

- The page documents Reading mode for a TypeScript file, which the application does not offer.

Evidence:

- accuracy / blocker / Before you start; Steps, step 3: The page says Reading is available for every file and tells the reader to click Reading for a TypeScript file. Impact: The Reading button does not exist for a TypeScript file. The reader looks for a control that is not there, and the page's only task cannot be done.. Source: packages/apps/web_frontend/src/components/GitModal.vue. Line 260: `<button v-if="md" ... gitModal.read>`; line 48: `settings.diffMode === "read" && !md.value ? "file" : settings.diffMode`; src/lib/markdown.ts: isMarkdown tests `.(md|markdown|mdx)$`. Recommendation: Remove the page, or say that Reading appears only for Markdown files and that a TypeScript file is shown as a whole file.
- taskSuccess / blocker / Steps, step 3; closing sentence: 'The TypeScript file is shown in Reading mode.' Impact: Reading mode for a TypeScript file does not exist, so the stated task cannot be done.. Source: packages/apps/web_frontend/src/components/GitModal.vue. The Reading button is rendered only when `md` is true. Recommendation: Describe the real behaviour for a TypeScript file (whole-file view), or drop the task.

### sample_73.md (4.0)

The main step is wrong against the source, so the task fails as written.

- Step 3 tells the reader to type a name with a slash. Heidrun rejects that name with an error.

Evidence:

- accuracy / blocker / Steps, step 3: 'Type `notes/today.md` to create a folder and a file together. The slash is accepted in the name box.' Impact: Heidrun rejects a name with a slash, shows an error notification, and creates nothing. Following the step exactly fails.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. Lines 193-196: `if (name.includes("/")) { toast(t("filesPanel.nameHasSlash"), "error"); ... return; }`; filesPanel.json: 'A name cannot contain the character /. Select a folder first.'; the rule file says the name cannot contain `/`. Recommendation: Tell the reader to type a name without a slash. To put a file in a folder, select the folder first.
- taskSuccess / blocker / Steps, step 3: The page tells the reader to type `notes/today.md`. Impact: The reader who follows the example sees an error and no file is created. The troubleshooting section covers only a duplicate name.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. The slash check blocks creation. Recommendation: Replace the example with a plain name such as `example.md`.
- accuracy / minor / Image under step 3: The step types `notes/today.md`, but the image and caption show `example.md`. Impact: The picture and the instruction disagree.. Source: packages/auxiliary/website_public/docs/public/documentation_images/files/new_file.png. The image shows a name box with `example.md` inside `docs`. Recommendation: Make the typed name match the image.

### sample_46.md (4.5)

The row action table is correct, but one false claim about deleting folders makes the reference unreliable.

- The Empty folders section says wrongly that Heidrun deletes the empty folder from disk after a restart.

Evidence:

- accuracy / blocker / Empty folders: 'After restart, Heidrun deletes the empty folder from disk.' Impact: A false claim of data deletion makes this lookup content unreliable. The reader may avoid creating folders or may fear data loss.. Source: docs/agents_rules/user_interface/sidebars/files.md. The tree 'remembers the new empty folders ... until Heidrun restarts'. Only a Refresh asks the backend which remembered folders still exist (dirs_existing in packages/apps/desktop_tauri/src/files.rs). Nothing deletes a folder. Recommendation: Say that the folder stays on disk but is no longer shown in the tree after a restart, because Git does not list it.

### sample_12.md (5.0)

The steps are correct. The page says that Reading appears only for Markdown files, and the code agrees.


Evidence:


### sample_81.md (4.8)

The steps and the troubleshooting are correct. The wrong screenshot is a local flaw.

- The screenshot shows the path-copy context menu, but the caption describes a name box.

Evidence:

- accuracy / minor / Image under step 3: The caption says 'Name box inside docs with example.md typed', but the image is copy_path.png. Impact: That image shows the file context menu on README.md, not a name box. The reader sees a picture that does not match the step. The text still lets the reader finish the task.. Source: packages/auxiliary/website_public/docs/public/documentation_images/files/copy_path.png. The image shows the selected README.md with the menu items 'Copy absolute path' and 'Copy relative path'. There is no name box. Recommendation: Use new_file.png, which shows the name box.

### sample_34.md (4.0)

The page sends the reader to the wrong row, and the troubleshooting contradicts the rule.

- The page says that a folder row opens the path-copy context menu. Folder rows have no context menu.

Evidence:

- accuracy / blocker / Steps, step 3; Troubleshooting: Step 3: 'Right-click the folder row to open the context menu and copy that folder path.' Troubleshooting: 'A folder row has the same path-copy context menu as a file.' Impact: A folder row has no context menu. The reader right-clicks a folder, sees nothing, and cannot copy a path. The troubleshooting text then tells the reader to right-click a file instead, which contradicts it.. Source: docs/agents_rules/user_interface/sidebars/files.md. 'The row of a folder has no context menu.' FilesPanel.vue binds @contextmenu to file rows only. Recommendation: Tell the reader to right-click the file row, and say that a folder row has no context menu.
- taskSuccess / blocker / Steps, steps 3-4: Step 3 sends the reader to a folder row, so no menu opens for step 4. Impact: The task of copying a file path cannot be done by following the steps.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. Line 445: `@contextmenu="openFileMenu($event, entry.row)"` on the file row. Recommendation: Right-click the file row.

### sample_55.md (5.0)

The steps, the image, and the duplicate-name troubleshooting match the source.


Evidence:


### sample_28.md (4.2)

The steps are right, but the swapped table leads the reader to copy the wrong path.

- The table swaps the absolute path result and the relative path result.

Evidence:

- accuracy / blocker / Table under the steps: 'Copy absolute path' is shown with `docs/README.md`, and 'Copy relative path' is shown with `/Users/alex/projects/example/docs/README.md`. Impact: The two results are swapped. The 'Use when' text is swapped with them. The reader picks the wrong item and pastes the wrong kind of path.. Source: docs/agents_rules/user_interface/sidebars/files.md. 'Copy absolute path' puts the absolute path of the file on the clipboard. 'Copy relative path' puts the path relative to the workspace folder. Recommendation: Swap the copied text and the 'Use when' text so that each matches its item.
- taskSuccess / material / Steps, step 4, and the table: Step 4 tells the reader to choose an item 'using the table below', and the table gives the wrong result for each item. Impact: The reader can open the menu and copy, but the choice goes by the table, so the reader gets the opposite path.. Source: docs/agents_rules/user_interface/sidebars/files.md. See the finding on accuracy. Recommendation: Correct the table.

### sample_63.md (4.2)

The facts are right, but the missing right-click step breaks the procedure.

- No step opens the context menu with a right-click.
- The troubleshooting section ends after the cause.

Evidence:

- taskSuccess / blocker / Steps, step 3: Step 3 says 'Choose Copy absolute path or Copy relative path'. No step tells the reader to right-click the file row. Impact: The reader never opens the context menu, so the two items cannot be chosen. The page does not say how to start the copy.. Source: docs/agents_rules/user_interface/sidebars/files.md. The items are in a context menu that opens from a right-click on a file row. Recommendation: Add a step before step 3: right-click the file row to open the context menu.
- order / material / Steps, steps 2-3: The steps go from unfolding the folders straight to choosing a menu item. The action that opens the menu is missing. The next text then says 'The menu closes'. Impact: The sequence has a gap, so the reader must guess how the menu opens.. Source: docs/agents_rules/user_interface/sidebars/files.md. A right-click opens the context menu. Recommendation: Insert the right-click step.
- taskSuccess / minor / Troubleshooting: 'A folder row has no path-copy context menu.' The text ends there, with a trailing space. It gives no recovery and no check. Impact: The reader who right-clicks a folder is not told what to do next.. Source: docs/agents_rules/user_interface/sidebars/files.md. 'The row of a folder has no context menu.' Recommendation: Add: right-click a file row instead, and check that the two items appear.

### sample_07.md (5.0)

The lookup table and the empty folder note match the source.


Evidence:


### sample_42.md (4.0)

The page replaces a real menu item with an invented one, so the relative path task fails.

- The page names a menu item 'Upload file to GitHub' that does not exist.

Evidence:

- accuracy / blocker / Steps, step 4; table; Troubleshooting: The page names a menu item 'Upload file to GitHub' and says that it copies `docs/README.md`. Impact: The context menu has no such item. The relative-path item is replaced by it. The reader looks for an item that does not exist, and the relative-path choice is missing.. Source: docs/agents_rules/user_interface/sidebars/files.md. The context menu has two items: 'Copy absolute path' and 'Copy relative path'. The new_file.png and copy_path.png images agree. Recommendation: Use 'Copy relative path' in step 4, the table, and the troubleshooting section.
- taskSuccess / blocker / Steps, step 4: 'Choose Copy absolute path or Upload file to GitHub'. Impact: The relative path cannot be copied by following the page. The reader may think that an upload feature exists.. Source: docs/agents_rules/user_interface/sidebars/files.md. See the finding on accuracy. Recommendation: Name the real second item.

### sample_19.md (5.0)

The steps, the table, and the troubleshooting match the source and the interface.


Evidence:
