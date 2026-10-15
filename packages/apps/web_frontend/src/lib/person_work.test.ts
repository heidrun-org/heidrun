import { describe, expect, it } from "vitest";
import {
	PersonWork,
	type PersonWorkCommit,
	type PersonWorkItems,
	type PersonWorkOpenedItem,
} from "./person_work";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

/** A time of the clock of the computer, as an ISO 8601 text in UTC. `monthDay` counts from the 1st of October 2026. */
function at(monthDay: number, hour: number): string {
	return new Date(2026, 9, monthDay, hour, 0, 0).toISOString();
}

function commit(
	authorName: string,
	authorEmail: string,
	committedAt: string,
	insertions = 0,
	deletions = 0,
): PersonWorkCommit {
	return { authorName, authorEmail, committedAt, insertions, deletions };
}

function opened(author: string | null, createdAt: string): PersonWorkOpenedItem {
	return { author, createdAt };
}

function items(parts: Partial<PersonWorkItems>): PersonWorkItems {
	return { repository: "heidrun-org/heidrun", commits: [], pullRequests: [], issues: [], codeHostingError: null, ...parts };
}

describe("PersonWork.findPersons", () => {
	it("gives the same person to a commit author and to a login that differ by case, space, hyphen, and accent", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Jérôme Étienne", "jerome@example.com", at(12, 10))],
				pullRequests: [opened("jerome-etienne", at(12, 11))],
				issues: [opened("JeromeEtienne", at(13, 11))],
			}),
		);
		expect(persons).toHaveLength(1);
		expect(persons[0]).toEqual({ id: "jeromeetienne", name: "Jérôme Étienne", itemCount: 3 });
	});

	it("gives the same person to two emails with the same name", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Eric", "eric@home.example", at(12, 10)), commit("Eric", "eric@work.example", at(12, 11))],
			}),
		);
		expect(persons).toEqual([{ id: "eric", name: "Eric", itemCount: 2 }]);
	});

	it("reads the login in an email of GitHub that hides the address", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Someone Else", "12345+ada-lovelace@users.noreply.github.com", at(12, 10))],
				pullRequests: [opened("ada-lovelace", at(12, 11))],
			}),
		);
		expect(persons).toHaveLength(1);
		expect(persons[0].id).toBe("adalovelace");
		expect(persons[0].itemCount).toBe(2);
	});

	it("shows the name that is written the most often, and the login for a person with no commit", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [
					commit("JEROME ETIENNE", "jerome@example.com", at(12, 10)),
					commit("Jerome Etienne", "jerome@example.com", at(12, 11)),
					commit("Jerome Etienne", "jerome@example.com", at(12, 12)),
					commit("Jérôme Étienne", "jerome@example.com", at(12, 13)),
				],
				pullRequests: [opened("only-login", at(12, 11))],
			}),
		);
		expect(persons.map((person) => person.name)).toEqual(["Jerome Etienne", "only-login"]);
	});

	it("puts the person with the most items first, and ignores an item with no author", () => {
		const persons = PersonWork.findPersons(
			items({
				commits: [commit("Eric", "e@example.com", at(12, 10)), commit("Jerome", "j@example.com", at(12, 10))],
				pullRequests: [opened("jerome", at(12, 11)), opened(null, at(12, 11))],
			}),
		);
		expect(persons.map((person) => [person.name, person.itemCount])).toEqual([
			["Jerome", 2],
			["Eric", 1],
		]);
	});

	it("gives no person when there is no item", () => {
		expect(PersonWork.findPersons(items({}))).toEqual([]);
	});

	it("uses the email of an author whose name has no letter that a computer can read", () => {
		const persons = PersonWork.findPersons(
			items({ commits: [commit("王", "wang@example.com", at(12, 10)), commit("李", "li@example.com", at(12, 10))] }),
		);
		expect(persons.map((person) => person.id).sort()).toEqual(["li@example.com", "wang@example.com"]);
	});
});

describe("PersonWork.compute", () => {
	const sample = items({
		commits: [
			commit("Jerome Etienne", "j@example.com", at(8, 9), 10, 2),
			commit("Jerome Etienne", "j@example.com", at(14, 9), 5, 1),
			commit("Jerome Etienne", "j@example.com", at(14, 14), 3, 3),
			commit("Eric", "e@example.com", at(14, 10), 7, 0),
			commit("Jerome Etienne", "j@example.com", at(7, 23), 100, 50),
		],
		pullRequests: [opened("jeromeetienne", at(14, 11)), opened("jeromeetienne", at(10, 11)), opened("eric", at(14, 12))],
		issues: [opened("jeromeetienne", at(13, 11)), opened("jeromeetienne", at(2, 11)), opened("eric", at(13, 11))],
	});

	it("gives one day for each day of the time range, the last day being today", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect(result.days).toHaveLength(7);
		expect(result.days[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(result.days[6].startedAt).toBe(new Date(2026, 9, 14).getTime());
		expect(result.days[6].endedAt).toBe(new Date(2026, 9, 15).getTime());
	});

	it("counts the commits and the pull requests of the person in each day", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect(result.days.map((day) => [day.commitCount, day.pullRequestCount])).toEqual([
			[1, 0],
			[0, 0],
			[0, 1],
			[0, 0],
			[0, 0],
			[0, 0],
			[2, 1],
		]);
	});

	it("counts the totals of the person in the time range, and nothing of another person", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect([result.commitCount, result.pullRequestCount, result.issueCount]).toEqual([3, 2, 1]);
		const eric = PersonWork.compute(sample, "eric", NOW, 7);
		expect([eric.commitCount, eric.pullRequestCount, eric.issueCount]).toEqual([1, 1, 1]);
	});

	it("adds the lines added and the lines deleted of the commits of the person in the time range", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		expect([result.insertionCount, result.deletionCount]).toEqual([18, 6]);
		const eric = PersonWork.compute(sample, "eric", NOW, 7);
		expect([eric.insertionCount, eric.deletionCount]).toEqual([7, 0]);
	});

	it("does not add the lines of a commit outside the time range, and adds them again for thirty days", () => {
		const sevenDays = PersonWork.compute(sample, "jeromeetienne", NOW, 7);
		const thirtyDays = PersonWork.compute(sample, "jeromeetienne", NOW, 30);
		expect([sevenDays.insertionCount, sevenDays.deletionCount]).toEqual([18, 6]);
		expect([thirtyDays.insertionCount, thirtyDays.deletionCount]).toEqual([118, 56]);
	});

	it("gives no line for a person with no commit", () => {
		const result = PersonWork.compute(items({ pullRequests: [opened("eric", at(14, 12))] }), "eric", NOW, 7);
		expect([result.insertionCount, result.deletionCount]).toEqual([0, 0]);
	});

	it("counts an item of the first day and of the last day, and no item of the day before or of the day after", () => {
		const edges = items({
			commits: [
				commit("Eric", "e@example.com", new Date(2026, 9, 7, 23, 59, 59).toISOString()),
				commit("Eric", "e@example.com", new Date(2026, 9, 8, 0, 0, 0).toISOString()),
				commit("Eric", "e@example.com", new Date(2026, 9, 14, 23, 59, 59).toISOString()),
				commit("Eric", "e@example.com", new Date(2026, 9, 15, 0, 0, 0).toISOString()),
			],
		});
		const result = PersonWork.compute(edges, "eric", NOW, 7);
		expect(result.commitCount).toBe(2);
		expect(result.days[0].commitCount).toBe(1);
		expect(result.days[6].commitCount).toBe(1);
	});

	it("gives thirty days for the longest time range, and counts the older items in it", () => {
		const result = PersonWork.compute(sample, "jeromeetienne", NOW, 30);
		expect(result.days).toHaveLength(30);
		expect(result.commitCount).toBe(4);
		expect(result.pullRequestCount).toBe(2);
		expect(result.issueCount).toBe(2);
	});

	it("gives days with no count for a person with no item, and ignores a time that is not a time", () => {
		const result = PersonWork.compute(
			items({ commits: [commit("Eric", "e@example.com", "yesterday")] }),
			"eric",
			NOW,
			7,
		);
		expect(result.commitCount).toBe(0);
		expect(result.days.every((day) => day.commitCount === 0 && day.pullRequestCount === 0)).toBe(true);
	});
});
