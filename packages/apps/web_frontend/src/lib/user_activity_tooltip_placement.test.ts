import { describe, expect, it } from "vitest";
import {
	USER_ACTIVITY_BAR_GAP,
	USER_ACTIVITY_CHART_MARGIN,
	UserActivityTooltipPlacement,
} from "./user_activity_tooltip_placement";

describe("UserActivityTooltipPlacement.column", () => {
	/** A chart of 504 pixels with 12 slots: the plotting area is 400 pixels wide, so each slot is 400 / 12 pixels wide. */
	const chartWidth = 504;
	const slotCount = 12;
	const slotWidth = 400 / 12;
	const halfColumn = (slotWidth * (1 - USER_ACTIVITY_BAR_GAP)) / 2;

	it("puts the tooltip at the right of a column in the left half of the chart, touching the right edge of the column", () => {
		const { side, edge } = UserActivityTooltipPlacement.column(1, slotCount, chartWidth);
		expect(side).toBe("end");
		expect(edge).toBeCloseTo(USER_ACTIVITY_CHART_MARGIN.l + 1.5 * slotWidth + halfColumn, 5);
	});

	it("puts the tooltip at the left of a column in the right half of the chart, touching the left edge of the column", () => {
		const { side, edge } = UserActivityTooltipPlacement.column(10, slotCount, chartWidth);
		expect(side).toBe("start");
		expect(edge).toBeCloseTo(USER_ACTIVITY_CHART_MARGIN.l + 10.5 * slotWidth - halfColumn, 5);
	});

	it("keeps the edge between the two sides of the plotting area for the first and the last slot", () => {
		const first = UserActivityTooltipPlacement.column(0, slotCount, chartWidth);
		const last = UserActivityTooltipPlacement.column(slotCount - 1, slotCount, chartWidth);
		expect(first.edge).toBeGreaterThan(USER_ACTIVITY_CHART_MARGIN.l);
		expect(last.edge).toBeLessThan(chartWidth - USER_ACTIVITY_CHART_MARGIN.r);
	});

	it("gives a column in the middle of the chart to one side or the other, never to both", () => {
		const sides = [5, 6].map((index) => UserActivityTooltipPlacement.column(index, slotCount, chartWidth).side);
		expect(sides).toEqual(["end", "start"]);
	});
});

describe("UserActivityTooltipPlacement.top", () => {
	it("puts the middle of the tooltip at the height of the pointer", () => {
		expect(UserActivityTooltipPlacement.top(150, 100, 400)).toBe(100);
	});

	it("keeps the tooltip inside the chart when the pointer is near the top or near the bottom", () => {
		expect(UserActivityTooltipPlacement.top(10, 100, 400)).toBe(0);
		expect(UserActivityTooltipPlacement.top(390, 100, 400)).toBe(300);
	});

	it("puts the tooltip at the top when it is taller than the chart", () => {
		expect(UserActivityTooltipPlacement.top(100, 500, 400)).toBe(0);
	});
});

describe("UserActivityTooltipPlacement.arrowTop", () => {
	it("puts the middle of the arrow at the height of the pointer", () => {
		expect(UserActivityTooltipPlacement.arrowTop(150, 100, 100)).toBe(38);
	});

	it("keeps the arrow away from the corners of the tooltip", () => {
		expect(UserActivityTooltipPlacement.arrowTop(0, 0, 100)).toBe(8);
		expect(UserActivityTooltipPlacement.arrowTop(100, 0, 100)).toBe(68);
	});

	it("gives a top when the tooltip is too short for the arrow", () => {
		expect(UserActivityTooltipPlacement.arrowTop(5, 0, 10)).toBe(8);
	});
});
