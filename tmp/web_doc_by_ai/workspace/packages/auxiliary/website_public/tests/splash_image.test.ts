// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('vitepress', () => ({
	withBase: (path: string) => `/heidrun${path}`,
}));

import SplashImage from '../docs/.vitepress/theme/splash_image.vue';

describe('SplashImage', () => {
	it('shows the splash image under the base path of the site', () => {
		const wrapper = mount(SplashImage);
		expect(wrapper.get('img').attributes('src')).toBe('/heidrun/heidrun_splash_screen.png');
	});

	it('describes the picture for screen readers', () => {
		const alt = mount(SplashImage).get('img').attributes('alt') ?? '';
		expect(alt).toContain('Heiðrún');
		expect(alt.length).toBeGreaterThan(30);
	});

	it('wraps the image in a block of the class splash-image', () => {
		expect(mount(SplashImage).classes()).toContain('splash-image');
	});
});
