import Fs from 'node:fs';
import Path from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import DialogCloseButton from './DialogCloseButton.vue';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DialogCloseButtonTest — every dialog closes with a big X that has no border and no background
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `DialogCloseButton.vue`.
 */
class DialogCloseButtonTestHelper {
	/**
	 * Lists the Vue components of the folder `components` and of its subfolders, as paths.
	 *
	 * @param folderPath - The folder to read.
	 * @returns The paths of the `.vue` files.
	 */
	static listComponentPaths(folderPath: string): string[] {
		const pathList: string[] = [];
		for (const entry of Fs.readdirSync(folderPath, { withFileTypes: true })) {
			const entryPath = Path.join(folderPath, entry.name);
			if (entry.isDirectory()) {
				pathList.push(...DialogCloseButtonTestHelper.listComponentPaths(entryPath));
			} else if (entry.name.endsWith('.vue')) {
				pathList.push(entryPath);
			}
		}
		return pathList;
	}
}

describe('DialogCloseButton', () => {
	it('is a button with the big X icon, the Bootstrap class btn, no border, and a larger font size', () => {
		const wrapper = mount(DialogCloseButton, { props: { title: 'Close the window', label: 'Close' } });
		const button = wrapper.get('button');
		expect(button.attributes('type')).toBe('button');
		expect(button.classes()).toEqual(expect.arrayContaining(['btn', 'border-0', 'fs-4']));
		expect(button.find('.bi-x-lg').exists()).toBe(true);
		expect(button.text()).toBe('');
	});

	it('gives the tooltip and the name for the screen reader', () => {
		const wrapper = mount(DialogCloseButton, { props: { title: 'Close the window', label: 'Close' } });
		expect(wrapper.get('button').attributes('title')).toBe('Close the window');
		expect(wrapper.get('button').attributes('aria-label')).toBe('Close');
	});

	it('passes the click to the handler of the parent', async () => {
		const onClick = vi.fn();
		const wrapper = mount(DialogCloseButton, { props: { title: 'Close', label: 'Close' }, attrs: { onClick } });
		await wrapper.get('button').trigger('click');
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('is the only close button: no component draws the square Bootstrap close button', () => {
		const componentPathList = DialogCloseButtonTestHelper.listComponentPaths(__dirname);
		expect(componentPathList.length).toBeGreaterThan(20);
		for (const componentPath of componentPathList) {
			const sourceText = Fs.readFileSync(componentPath, 'utf8');
			expect({ componentPath, hasSquareCloseButton: /class="[^"]*\bbtn-close\b/.test(sourceText) }).toEqual({
				componentPath,
				hasSquareCloseButton: false,
			});
		}
	});
});
