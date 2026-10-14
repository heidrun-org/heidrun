// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const renderer = vi.hoisted(() => ({
	start: vi.fn(),
	update: vi.fn(),
	dispose: vi.fn(),
}));

const create = vi.hoisted(() => vi.fn());

vi.mock('../docs/.vitepress/theme/flux_lines_renderer', () => ({
	FluxLinesRenderer: {
		create,
	},
}));

import FluxLines from '../docs/.vitepress/theme/flux_lines.vue';

describe('FluxLines', () => {
	beforeEach(() => {
		create.mockReset();
		create.mockReturnValue(renderer);
		renderer.start.mockReset();
		renderer.update.mockReset();
		renderer.dispose.mockReset();
	});

	it('wraps a canvas in a block of the class flux-lines', () => {
		const wrapper = mount(FluxLines);
		expect(wrapper.classes()).toContain('flux-lines');
		expect(wrapper.find('canvas.flux-lines-canvas').exists()).toBe(true);
	});

	it('hides the canvas from screen readers', () => {
		expect(mount(FluxLines).get('canvas').attributes('aria-hidden')).toBe('true');
	});

	it('creates and starts the renderer when it is mounted, with the options', () => {
		mount(FluxLines, { props: { options: { opacity: 0.5 } } });
		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][2]).toEqual({ opacity: 0.5 });
		expect(renderer.start).toHaveBeenCalledTimes(1);
	});

	it('gives the new options to the renderer when the options change', async () => {
		const wrapper = mount(FluxLines, { props: { options: { opacity: 0.5 } } });
		await wrapper.setProps({ options: { opacity: 0.9 } });
		expect(renderer.update).toHaveBeenCalledWith({ opacity: 0.9 });
	});

	it('disposes the renderer when it is unmounted', () => {
		const wrapper = mount(FluxLines);
		wrapper.unmount();
		expect(renderer.dispose).toHaveBeenCalledTimes(1);
	});

	it('shows an empty block, and does not fail, when the browser has no WebGL2', () => {
		create.mockReturnValue(null);
		const wrapper = mount(FluxLines);
		expect(wrapper.find('canvas').exists()).toBe(true);
		expect(renderer.start).not.toHaveBeenCalled();
		wrapper.unmount();
		expect(renderer.dispose).not.toHaveBeenCalled();
	});
});
