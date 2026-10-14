// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import YoutubeVideo from '../docs/.vitepress/theme/youtube_video.vue';

const wrapper = () => mount(YoutubeVideo, {
	props: {
		videoId: 'NTIw_H7UUsU',
		title: 'How to pronounce Heidrun',
	},
});

describe('YoutubeVideo', () => {
	it('embeds the video from the domain of YouTube that sets no cookie', () => {
		expect(wrapper().get('iframe').attributes('src')).toBe('https://www.youtube-nocookie.com/embed/NTIw_H7UUsU');
	});

	it('gives the iframe the title of the video for screen readers', () => {
		expect(wrapper().get('iframe').attributes('title')).toBe('How to pronounce Heidrun');
	});

	it('loads the iframe only when the reader scrolls near it', () => {
		expect(wrapper().get('iframe').attributes('loading')).toBe('lazy');
	});

	it('allows the full screen mode', () => {
		expect(wrapper().get('iframe').attributes('allowfullscreen')).toBeDefined();
	});

	it('wraps the iframe in a block of the class youtube-video', () => {
		expect(wrapper().classes()).toContain('youtube-video');
	});
});
