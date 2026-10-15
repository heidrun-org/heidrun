import { describe, expect, it } from "vitest";
import { UserActivityWorkspaces } from "./user_activity_workspaces";

/** A record with only the folder of its workspace. */
function record(workspaceFolder: string): { workspaceFolder: string } {
	return { workspaceFolder };
}

describe("UserActivityWorkspaces.choices", () => {
	it("gives one choice for each folder of the records, even when a folder has many records", () => {
		const records = [record("/work/alpha"), record("/work/beta"), record("/work/alpha")];
		expect(UserActivityWorkspaces.choices(records, null, [])).toEqual([
			{ folder: "/work/alpha", name: "alpha" },
			{ folder: "/work/beta", name: "beta" },
		]);
	});

	it("gives the label of a workspace that is open, and the last part of the folder of a workspace that is closed", () => {
		const records = [record("/work/alpha"), record("/work/beta")];
		const openWorkspaces = [{ folder: "/work/alpha", label: "Alpha app" }];
		expect(UserActivityWorkspaces.choices(records, null, openWorkspaces)).toEqual([
			{ folder: "/work/alpha", name: "Alpha app" },
			{ folder: "/work/beta", name: "beta" },
		]);
	});

	it("adds the workspace of the running period, even when it has no record", () => {
		const choices = UserActivityWorkspaces.choices([record("/work/alpha")], "/work/gamma", []);
		expect(choices.map((choice) => choice.folder)).toEqual(["/work/alpha", "/work/gamma"]);
	});

	it("does not add the workspace of the running period twice", () => {
		expect(UserActivityWorkspaces.choices([record("/work/alpha")], "/work/alpha", [])).toHaveLength(1);
	});

	it("writes the folder after the name when two workspaces have the same name", () => {
		const records = [record("/one/app"), record("/two/app"), record("/work/beta")];
		expect(UserActivityWorkspaces.choices(records, null, [])).toEqual([
			{ folder: "/one/app", name: "app (/one/app)" },
			{ folder: "/two/app", name: "app (/two/app)" },
			{ folder: "/work/beta", name: "beta" },
		]);
	});

	it("reads the last part of a folder with a slash at the end or with backslashes", () => {
		const choices = UserActivityWorkspaces.choices([record("/work/alpha/"), record("C:\\work\\beta")], null, []);
		expect(choices.map((choice) => choice.name)).toEqual(["alpha", "beta"]);
	});

	it("gives no choice when there is no record and no running period", () => {
		expect(UserActivityWorkspaces.choices([], null, [])).toEqual([]);
	});

	it("ignores a workspace that is open with an empty label", () => {
		const choices = UserActivityWorkspaces.choices([record("/work/alpha")], null, [{ folder: "/work/alpha", label: "" }]);
		expect(choices[0].name).toBe("alpha");
	});
});

describe("UserActivityWorkspaces.filterRecords", () => {
	const records = [record("/work/alpha"), record("/work/beta"), record("/work/alpha")];

	it("keeps only the records of the chosen workspaces, in the same order", () => {
		expect(UserActivityWorkspaces.filterRecords(records, ["/work/alpha"])).toEqual([records[0], records[2]]);
	});

	it("keeps every record when every workspace is chosen", () => {
		expect(UserActivityWorkspaces.filterRecords(records, ["/work/beta", "/work/alpha"])).toEqual(records);
	});

	it("keeps no record when no workspace is chosen", () => {
		expect(UserActivityWorkspaces.filterRecords(records, [])).toEqual([]);
	});
});

describe("UserActivityWorkspaces.runningPeriodStartedAt", () => {
	it("keeps the running period when its workspace is chosen", () => {
		expect(UserActivityWorkspaces.runningPeriodStartedAt(1000, "/work/alpha", ["/work/alpha"])).toBe(1000);
	});

	it("drops the running period when its workspace is not chosen", () => {
		expect(UserActivityWorkspaces.runningPeriodStartedAt(1000, "/work/alpha", ["/work/beta"])).toBeNull();
	});

	it("gives null when no period runs, or when no workspace is selected", () => {
		expect(UserActivityWorkspaces.runningPeriodStartedAt(null, "/work/alpha", ["/work/alpha"])).toBeNull();
		expect(UserActivityWorkspaces.runningPeriodStartedAt(1000, null, ["/work/alpha"])).toBeNull();
	});
});
