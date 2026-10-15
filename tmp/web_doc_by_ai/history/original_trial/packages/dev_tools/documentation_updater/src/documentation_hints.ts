import { ChangeLogGit } from 'change_log_generator';
import { DocumentationGit } from './documentation_git.ts';
import { DocumentationPaths } from './documentation_paths.ts';
import type { DocumentationHintSet } from './documentation_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationHints — collects what changed between the last documented commit and the current commit
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Collects the hints for the coding agent, with no coding agent: the merged pull requests, the fixed issues, the
 * changed files, and the diff of the rules.
 */
export class DocumentationHints {
	/** The largest size of the diff of the rules, in characters. A longer diff is cut. */
	static readonly maximumRulesDiffLength = 60_000;

	/**
	 * Collects the hints of the range from the last documented commit to the current commit. A range counts only
	 * the merged pull requests (the commits whose subject starts with `Merge pull request #`).
	 * @param repositoryPath The root folder of the Git repository.
	 * @param lastDocumentedCommit The last documented commit, or null on the first run. Without it, the hints are
	 * empty and the coding agent does only the full check.
	 * @returns The hints.
	 */
	static collect(repositoryPath: string, lastDocumentedCommit: string | null): DocumentationHintSet {
		const currentCommit = DocumentationGit.findCurrentCommit(repositoryPath);
		if (lastDocumentedCommit === null) {
			return {
				lastDocumentedCommit,
				currentCommit,
				mergedPullRequests: [],
				fixedIssueNumbers: [],
				changedFiles: [],
				rulesDiff: '',
				isRulesDiffTruncated: false,
			};
		}
		const mergedPullRequests = ChangeLogGit.listMergedPullRequests(repositoryPath, {
			fromTag: lastDocumentedCommit,
			toTag: null,
		});
		const fixedIssueNumbers = DocumentationGit.listFixedIssueNumbers(repositoryPath, lastDocumentedCommit);
		const changedFiles = DocumentationGit.listChangedFiles(repositoryPath, lastDocumentedCommit, [
			DocumentationPaths.rulesFolder,
			DocumentationPaths.glossaryFile,
			...DocumentationPaths.applicationFolders,
		]);
		const fullRulesDiff = DocumentationGit.readDiff(repositoryPath, lastDocumentedCommit, [
			DocumentationPaths.rulesFolder,
			DocumentationPaths.glossaryFile,
		]);
		const isRulesDiffTruncated = fullRulesDiff.length > DocumentationHints.maximumRulesDiffLength;
		return {
			lastDocumentedCommit,
			currentCommit,
			mergedPullRequests,
			fixedIssueNumbers,
			changedFiles,
			rulesDiff: isRulesDiffTruncated ? fullRulesDiff.slice(0, DocumentationHints.maximumRulesDiffLength) : fullRulesDiff,
			isRulesDiffTruncated,
		};
	}
}
