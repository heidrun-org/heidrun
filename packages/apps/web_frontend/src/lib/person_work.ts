import { CalendarDays, type CalendarDay } from "./calendar_days";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PersonWork — finds the people of a repository, and counts the work of one person for each day
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One commit, as the command `person_work_in_range` gives it. */
export type PersonWorkCommit = {
	/** The name of the author. */
	authorName: string;
	/** The email of the author. */
	authorEmail: string;
	/** The date of the commit, an ISO 8601 text. */
	committedAt: string;
	/** The number of lines that the commit adds. */
	insertions: number;
	/** The number of lines that the commit deletes. */
	deletions: number;
};

/** One pull request or one issue that a person opened, as the command `person_work_in_range` gives it. */
export type PersonWorkOpenedItem = {
	/** The login of the author, or `null` when the account of the author is deleted. */
	author: string | null;
	/** The date when the author opened the item, an ISO 8601 text. */
	createdAt: string;
};

/** What the command `person_work_in_range` gives: the three kinds of items of the repository in a time range. */
export type PersonWorkItems = {
	/** The repository, in the format `owner/name`. */
	repository: string;
	/** The commits, with no merge. */
	commits: PersonWorkCommit[];
	/** The pull requests that were opened. */
	pullRequests: PersonWorkOpenedItem[];
	/** The issues that were opened. */
	issues: PersonWorkOpenedItem[];
	/** The message of the error when GitHub could not be read, or `null`. */
	codeHostingError: string | null;
};

/** One person of the repository. */
export type PersonWorkPerson = {
	/** The identifier of the person: the name of the author or the login, in lower case, with no space and no accent. */
	id: string;
	/** The name to show: the name that the author writes the most often in the commits, or else the login. */
	name: string;
	/** The number of commits, pull requests, and issues of the person. */
	itemCount: number;
};

/** The choices of the length of the time range. */
export type PersonWorkPeriodId = "seven_days" | "thirty_days";

/** One day of the chart. */
export type PersonWorkDay = CalendarDay & {
	/** The number of commits of the person in the day. */
	commitCount: number;
	/** The number of pull requests that the person opened in the day. */
	pullRequestCount: number;
	/** The number of lines that the commits of the person add in the day. */
	insertionCount: number;
	/** The number of lines that the commits of the person delete in the day. */
	deletionCount: number;
};

/** The work of one person in a time range. */
export type PersonWorkResult = {
	/** The days of the time range, the oldest first. The last day is today. */
	days: PersonWorkDay[];
	/** The number of commits of the person in the time range. */
	commitCount: number;
	/** The number of pull requests that the person opened in the time range. */
	pullRequestCount: number;
	/** The number of issues that the person opened in the time range. */
	issueCount: number;
	/** The number of lines that the commits of the person add in the time range. */
	insertionCount: number;
	/** The number of lines that the commits of the person delete in the time range. */
	deletionCount: number;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Constants
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The number of days of each choice of the time range. The last day is today. */
export const PERSON_WORK_PERIODS: Record<PersonWorkPeriodId, { dayCount: number }> = {
	seven_days: { dayCount: 7 },
	thirty_days: { dayCount: 30 },
};

/** The longest time range, in days: the command reads this many days at once. */
export const PERSON_WORK_LONGEST_DAY_COUNT = 30;

/** The email of a person that hides the real address on GitHub: the login is before the `@`, after an optional number. */
const NO_REPLY_EMAIL = /^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/i;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PersonWork
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The calculation of the tab "Work of one person" of the Statistics window. It has no clock: the caller gives the current
 * time. The days follow the time zone of the computer.
 *
 * A commit knows its author by a name and an email, and a pull request or an issue knows its author by a login. The same
 * person is found by the name or the login written in lower case, with no space, no hyphen, and no accent: the name "Jérôme
 * Étienne" and the login "jerome-etienne" are the same person. The login in an email of the form `login@users.noreply.github.com`
 * counts as the login.
 */
export class PersonWork {
	/**
	 * Joins the items of several workspaces into one set of items. Two workspaces of the same repository, for example a
	 * folder and its worktree, read the same facts, so the repository counts once.
	 *
	 * @param itemsOfWorkspaces - What the command `person_work_in_range` gave for each workspace.
	 * @returns The items of all the repositories. The repository is the names of the repositories, and the error of GitHub is
	 * the errors of the workspaces, each one once, or `null` when no workspace has an error.
	 */
	static merge(itemsOfWorkspaces: PersonWorkItems[]): PersonWorkItems {
		const items = new Map<string, PersonWorkItems>();
		for (const candidate of itemsOfWorkspaces) {
			if (items.has(candidate.repository) === false) {
				items.set(candidate.repository, candidate);
			}
		}
		const repositories = [...items.values()];
		const errors = [...new Set(repositories.flatMap((one) => (one.codeHostingError === null ? [] : [one.codeHostingError])))];
		return {
			repository: repositories.map((one) => one.repository).join(", "),
			commits: repositories.flatMap((one) => one.commits),
			pullRequests: repositories.flatMap((one) => one.pullRequests),
			issues: repositories.flatMap((one) => one.issues),
			codeHostingError: errors.length === 0 ? null : errors.join("; "),
		};
	}

	/**
	 * Finds the people that appear in the items, the person with the most items first.
	 *
	 * @param items - The three kinds of items.
	 * @returns The people. A pull request or an issue with no author belongs to no person.
	 */
	static findPersons(items: PersonWorkItems): PersonWorkPerson[] {
		const names = new Map<string, Map<string, number>>();
		const itemCounts = new Map<string, number>();
		const countItem = (id: string): void => {
			itemCounts.set(id, (itemCounts.get(id) ?? 0) + 1);
		};
		for (const commit of items.commits) {
			const id = PersonWork._idOfCommit(commit);
			countItem(id);
			const nameCounts = names.get(id) ?? new Map<string, number>();
			nameCounts.set(commit.authorName, (nameCounts.get(commit.authorName) ?? 0) + 1);
			names.set(id, nameCounts);
		}
		const logins = new Map<string, string>();
		for (const item of [...items.pullRequests, ...items.issues]) {
			if (item.author === null) {
				continue;
			}
			const id = PersonWork._idOfLogin(item.author);
			countItem(id);
			if (logins.has(id) === false) {
				logins.set(id, item.author);
			}
		}
		const persons: PersonWorkPerson[] = [];
		for (const [id, itemCount] of itemCounts) {
			persons.push({ id, name: PersonWork._mostFrequentName(names.get(id)) ?? logins.get(id) ?? id, itemCount });
		}
		return persons.sort((first, second) => second.itemCount - first.itemCount || first.name.localeCompare(second.name));
	}

	/**
	 * Counts the work of one person for each day of a time range, and in the whole time range.
	 *
	 * @param items - The three kinds of items.
	 * @param personId - The identifier of the person, from `findPersons`.
	 * @param now - The current time, in milliseconds since 1 January 1970.
	 * @param dayCount - The number of days of the time range, today included.
	 * @returns The days, and the totals. An item outside the time range is not counted.
	 */
	static compute(items: PersonWorkItems, personId: string, now: number, dayCount: number): PersonWorkResult {
		const days: PersonWorkDay[] = CalendarDays.build(now, dayCount).map((day) => ({
			...day,
			commitCount: 0,
			pullRequestCount: 0,
			insertionCount: 0,
			deletionCount: 0,
		}));
		const result: PersonWorkResult = {
			days,
			commitCount: 0,
			pullRequestCount: 0,
			issueCount: 0,
			insertionCount: 0,
			deletionCount: 0,
		};
		for (const commit of items.commits) {
			if (PersonWork._idOfCommit(commit) !== personId) {
				continue;
			}
			const index = CalendarDays.findIndex(days, commit.committedAt);
			if (index !== -1) {
				days[index].commitCount += 1;
				days[index].insertionCount += commit.insertions;
				days[index].deletionCount += commit.deletions;
				result.commitCount += 1;
				result.insertionCount += commit.insertions;
				result.deletionCount += commit.deletions;
			}
		}
		for (const pullRequest of items.pullRequests) {
			if (pullRequest.author === null || PersonWork._idOfLogin(pullRequest.author) !== personId) {
				continue;
			}
			const index = CalendarDays.findIndex(days, pullRequest.createdAt);
			if (index !== -1) {
				days[index].pullRequestCount += 1;
				result.pullRequestCount += 1;
			}
		}
		for (const issue of items.issues) {
			if (issue.author === null || PersonWork._idOfLogin(issue.author) !== personId) {
				continue;
			}
			if (CalendarDays.findIndex(days, issue.createdAt) !== -1) {
				result.issueCount += 1;
			}
		}
		return result;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gives the identifier of the author of a commit: the login of a GitHub address that hides the email, or else the name.
	 * A name with no letter and no digit that a computer can read, for example a name in another alphabet, uses the email.
	 *
	 * @param commit - The commit.
	 * @returns The identifier of the person.
	 */
	private static _idOfCommit(commit: PersonWorkCommit): string {
		const login = NO_REPLY_EMAIL.exec(commit.authorEmail)?.[1] ?? null;
		const id = PersonWork._normalize(login ?? commit.authorName);
		return id === "" ? commit.authorEmail.toLowerCase() : id;
	}

	/**
	 * Gives the identifier of the author of a pull request or of an issue.
	 *
	 * @param login - The login of the author.
	 * @returns The identifier of the person.
	 */
	private static _idOfLogin(login: string): string {
		const id = PersonWork._normalize(login);
		return id === "" ? login.toLowerCase() : id;
	}

	/**
	 * Writes a name in lower case, with no accent, and with only the letters a to z and the digits.
	 *
	 * @param text - A name or a login.
	 * @returns The text that two spellings of the same name share.
	 */
	private static _normalize(text: string): string {
		return text
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
	}

	/**
	 * Gives the name that is written the most often. When two names are written the same number of times, the first one wins.
	 *
	 * @param nameCounts - The number of commits for each name, in the order of the first commit, or `undefined`.
	 * @returns The name, or `null` when there is no name.
	 */
	private static _mostFrequentName(nameCounts: Map<string, number> | undefined): string | null {
		let bestName: string | null = null;
		let bestCount = 0;
		for (const [name, count] of nameCounts ?? []) {
			if (count > bestCount) {
				bestName = name;
				bestCount = count;
			}
		}
		return bestName;
	}
}
