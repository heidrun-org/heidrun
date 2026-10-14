// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const state = vi.hoisted(() => ({
	layout: 'home',
	isDark: false,
}));

vi.mock('vitepress', () => ({
	useData: () => ({
		frontmatter: {
			value: {
				layout: state.layout,
			},
		},
		isDark: {
			value: state.isDark,
		},
	}),
}));

import HomeFluxLines from '../docs/.vitepress/theme/home_flux_lines.vue';
import FluxLines from '../docs/.vitepress/theme/flux_lines.vue';

const mountHome = () => mount(HomeFluxLines, {
	global: {
		stubs: {
			FluxLines: true,
		},
	},
});

describe('HomeFluxLines', () => {
	beforeEach(() => {
		state.layout = 'home';
		state.isDark = false;
	});

	it('shows the background on a page with the layout home', () => {
		const wrapper = mountHome();
		expect(wrapper.find('.home-flux-lines').exists()).toBe(true);
		expect(wrapper.findComponent(FluxLines).exists()).toBe(true);
	});

	it('shows nothing on a page with another layout', () => {
		state.layout = 'doc';
		const wrapper = mountHome();
		expect(wrapper.find('.home-flux-lines').exists()).toBe(false);
		expect(wrapper.findComponent(FluxLines).exists()).toBe(false);
	});

	it('draws dark lines on the light theme', () => {
		const options = mountHome().findComponent(FluxLines).props('options');
		expect(options.lightMode).toBe(true);
	});

	it('draws bright golden lines on the dark theme', () => {
		state.isDark = true;
		const options = mountHome().findComponent(FluxLines).props('options');
		expect(options.lightMode).toBeUndefined();
		expect(options.colors).toContain('#ffbe3c');
	});

	it('keeps the lines faint on both themes, so the text of the page stays easy to read', () => {
		for (const isDark of [false, true]) {
			state.isDark = isDark;
			const options = mountHome().findComponent(FluxLines).props('options');
			expect(options.opacity).toBeLessThanOrEqual(0.7);
		}
	});
});
