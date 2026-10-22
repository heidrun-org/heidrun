import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import VoiceLevel from "./VoiceLevel.vue";
import { LEVEL_COUNT } from "../stores/voice_input";

/** The heights of the bars of a mounted row, in pixels, from the left to the right. */
function heightsOf(wrapper: ReturnType<typeof mount>): number[] {
	return wrapper.findAll(".bar").map((bar) => Number.parseInt((bar.element as HTMLElement).style.height, 10));
}

describe("VoiceLevel", () => {
	it("always shows the same number of bars, and keeps the missing ones as dots on the left", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [1, 0.5] } });
		const heights = heightsOf(wrapper);
		expect(heights.length).toBe(LEVEL_COUNT);
		expect(heights.slice(0, LEVEL_COUNT - 2).every((height) => height === 4)).toBe(true);
		expect(heights[LEVEL_COUNT - 2]).toBe(36);
		expect(heights[LEVEL_COUNT - 1]).toBeGreaterThan(4);
		expect(heights[LEVEL_COUNT - 1]).toBeLessThan(36);
		wrapper.unmount();
	});

	it("shows only dots for silence", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: new Array<number>(LEVEL_COUNT).fill(0) } });
		expect(heightsOf(wrapper).every((height) => height === 4)).toBe(true);
		wrapper.unmount();
	});

	it("keeps the newest levels when there are more levels than bars", () => {
		const levels = [...new Array<number>(10).fill(0), ...new Array<number>(LEVEL_COUNT).fill(1)];
		const wrapper = mount(VoiceLevel, { props: { levels } });
		expect(heightsOf(wrapper).every((height) => height === 36)).toBe(true);
		wrapper.unmount();
	});

	it("keeps a level that is out of range inside the smallest and the largest height", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [-3, 7] } });
		const heights = heightsOf(wrapper);
		expect(heights[LEVEL_COUNT - 2]).toBe(4);
		expect(heights[LEVEL_COUNT - 1]).toBe(36);
		wrapper.unmount();
	});

	it("has a name for the screen reader", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [] } });
		expect(wrapper.attributes("role")).toBe("img");
		expect(wrapper.attributes("aria-label")).toBe("Level of the voice");
		wrapper.unmount();
	});
});
