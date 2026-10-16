import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';
import { Icon } from '../src/components/icon';
import type { IconName } from '../src/components/icon';

const iconNames: IconName[] = [
	'arrow-clockwise',
	'bell',
	'chevron-left',
	'grid',
	'lightning-charge',
	'play',
	'send-fill',
	'stop-fill',
	'view-stacked',
];

describe('Icons', () => {
	it('draws each icon as the SVG of Bootstrap Icons, with the size asked, hidden from screen readers', () => {
		for (const name of iconNames) {
			const iconHtmlContent = Icon.render(name, 22);
			expect(iconHtmlContent.startsWith('<svg'), name).toBe(true);
			expect(iconHtmlContent, name).toContain(`class="bi bi-${name}"`);
			expect(iconHtmlContent, name).toContain('width="22" height="22" aria-hidden="true"');
			expect(iconHtmlContent, name).toContain('fill="currentColor"');
		}
	});

	it('uses Bootstrap Icons in the bottom bar, in the header of a pane, and in the prompt line', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		const barIcons = [...document.querySelectorAll('.bottom-bar .bar-button svg.bi')];
		expect(barIcons.map((icon) => icon.getAttribute('class'))).toEqual([
			'bi bi-grid',
			'bi bi-bell',
			'bi bi-view-stacked',
			'bi bi-play',
		]);
		await harness.openPane('p-working');
		expect(document.querySelector('.back svg.bi-chevron-left')).not.toBeNull();
		expect(document.querySelector('.icon-button svg.bi-arrow-clockwise')).not.toBeNull();
		expect(document.querySelector('[data-action="open-macros"] svg.bi-lightning-charge')).not.toBeNull();
		expect(document.querySelector('.send-button svg.bi-send-fill')).not.toBeNull();
		expect(document.querySelector('.stop-button svg.bi-stop-fill')).not.toBeNull();
	});

	it('keeps every icon of the page in the class Icon, and draws no icon by hand', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		const svgs = [...document.querySelectorAll('svg')];
		const handDrawn = svgs.filter((svg) => svg.classList.contains('bi') === false);
		expect(handDrawn).toEqual([]);
	});
});
