// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

vi.mock('vitepress', () => ({
	withBase: (path: string) => `/heidrun${path}`,
	useData: () => ({
		frontmatter: {
			value: {
				layout: 'home',
			},
		},
	}),
}));

import HomeFeature from '../docs/.vitepress/theme/home/home_feature.vue';
import HomeHeroNote from '../docs/.vitepress/theme/home/home_hero_note.vue';
import HomeProblem from '../docs/.vitepress/theme/home/home_problem.vue';
import HomeQuickStart from '../docs/.vitepress/theme/home/home_quick_start.vue';
import HomeValhalla from '../docs/.vitepress/theme/home/home_valhalla.vue';
import { FEATURES, HERO_NOTE, QUICK_START, VALHALLA } from '../docs/.vitepress/theme/home/home_content';

describe('HomeHeroNote', () => {
	it('shows the note under the buttons of the hero', () => {
		expect(mount(HomeHeroNote).text()).toBe(HERO_NOTE);
	});
});

describe('HomeProblem', () => {
	it('shows five terminals, each with the state of its coding agent for screen readers', () => {
		const wrapper = mount(HomeProblem);
		expect(wrapper.findAll('.home-terminal')).toHaveLength(5);
		const labels = wrapper.findAll('.home-terminal-dot').map((dot) => dot.attributes('aria-label'));
		expect(labels.every((label) => (label ?? '').length > 0)).toBe(true);
	});
});

describe('HomeValhalla', () => {
	it('outlines the Needs you sidebar section at first', () => {
		const wrapper = mount(HomeValhalla);
		const pressed = wrapper.findAll('.home-valhalla-part').filter((button) => button.attributes('aria-pressed') === 'true');
		expect(pressed).toHaveLength(1);
		expect(pressed[0].text()).toContain('Needs you sidebar section');
	});

	it('moves the outline to the part that the developer chooses', async () => {
		const wrapper = mount(HomeValhalla);
		await wrapper.findAll('.home-valhalla-part')[0].trigger('click');
		const box = VALHALLA.parts[0].box;
		const style = wrapper.get('.home-valhalla-outline').attributes('style') ?? '';
		expect(style).toContain(`left: ${box.left}%`);
		expect(style).toContain(`top: ${box.top}%`);
		expect(wrapper.findAll('.home-valhalla-part')[0].attributes('aria-pressed')).toBe('true');
	});

	it('shows the screenshot of the window under the base path of the site', () => {
		expect(mount(HomeValhalla).get('.home-shot img').attributes('src')).toBe(`/heidrun${VALHALLA.screenshot.src}`);
	});
});

describe('HomeFeature', () => {
	it('shows the title, the joke, and the screenshot of the section that it names', () => {
		const feature = FEATURES[0];
		const wrapper = mount(HomeFeature, {
			props: {
				sectionId: feature.id,
			},
		});
		expect(wrapper.get('h2').text()).toBe(feature.title);
		expect(wrapper.text()).toContain(feature.joke);
		expect(wrapper.get('.home-shot img').attributes('alt')).toBe(feature.screenshot?.alt);
	});

	it('shows the text alone, in one column, for a section without a screenshot', () => {
		const feature = FEATURES.find((candidate) => candidate.screenshot === undefined);
		if (feature === undefined) {
			return;
		}
		const wrapper = mount(HomeFeature, {
			props: {
				sectionId: feature.id,
			},
		});
		expect(wrapper.find('.home-shot').exists()).toBe(false);
		expect(wrapper.find('.home-split').exists()).toBe(false);
	});

	it('puts the screenshot on the left in the second section', () => {
		const wrapper = mount(HomeFeature, {
			props: {
				sectionId: FEATURES[1].id,
			},
		});
		expect(wrapper.classes()).toContain('is-reversed');
	});

	it('fails with a clear message for an unknown section', () => {
		expect(() => mount(HomeFeature, {
			props: {
				sectionId: 'no-such-section',
			},
		})).toThrow('no-such-section');
	});
});

describe('HomeQuickStart', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('copies the four commands to the clipboard, and says so on the button for two seconds', async () => {
		vi.useFakeTimers();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText,
			},
			configurable: true,
		});
		const wrapper = mount(HomeQuickStart);
		const button = wrapper.get('.home-quick-start-copy');
		expect(button.text()).toBe(QUICK_START.source.copyText);
		await button.trigger('click');
		await flushPromises();
		expect(writeText).toHaveBeenCalledWith(QUICK_START.source.commands.join('\n'));
		expect(button.text()).toBe(QUICK_START.source.copiedText);
		vi.advanceTimersByTime(2000);
		await flushPromises();
		expect(button.text()).toBe(QUICK_START.source.copyText);
	});
});
