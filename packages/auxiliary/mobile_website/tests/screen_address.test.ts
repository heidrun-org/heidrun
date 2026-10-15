import { describe, expect, it } from 'vitest';
import { ScreenAddress } from '../src/screen_address';

describe('ScreenAddress', () => {
	it('writes the address of each screen of the bottom bar', () => {
		expect(ScreenAddress.format('home', null)).toBe('#/home');
		expect(ScreenAddress.format('needs_you', null)).toBe('#/needs-you');
		expect(ScreenAddress.format('panes', null)).toBe('#/panes');
		expect(ScreenAddress.format('macros', null)).toBe('#/macros');
		expect(ScreenAddress.format('launchers', null)).toBe('#/launchers');
	});

	it('writes the address of a pane after the screen where it was opened', () => {
		expect(ScreenAddress.format('panes', 'p-1')).toBe('#/panes/p-1');
		expect(ScreenAddress.format('needs_you', 'p-1')).toBe('#/needs-you/p-1');
	});

	it('encodes the characters of a pane identifier that an address does not allow', () => {
		expect(ScreenAddress.format('panes', 'w1Y:p/B ?#')).toBe('#/panes/w1Y%3Ap%2FB%20%3F%23');
	});

	it('reads back what it wrote, for every screen and for a strange pane identifier', () => {
		for (const tab of ['home', 'needs_you', 'panes', 'macros', 'launchers'] as const) {
			for (const paneId of [null, 'p-1', 'w1Y:p/B ?#', 'é']) {
				expect(ScreenAddress.parse(ScreenAddress.format(tab, paneId))).toEqual({
					tab,
					paneId,
				});
			}
		}
	});

	it('leads to the screen Home when the address is empty, wrong, or unknown', () => {
		for (const hash of ['', '#', '#/', '#/nothing', '#/nothing/p-1', '#t=abc']) {
			expect(ScreenAddress.parse(hash), hash).toEqual({
				tab: 'home',
				paneId: null,
			});
		}
	});

	it('reads an address without the first slash, and ignores what comes after the pane', () => {
		expect(ScreenAddress.parse('#panes')).toEqual({
			tab: 'panes',
			paneId: null,
		});
		expect(ScreenAddress.parse('#/panes/p-1/more')).toEqual({
			tab: 'panes',
			paneId: 'p-1',
		});
	});

	it('opens the screen of the bottom bar when the pane identifier is empty or badly encoded', () => {
		expect(ScreenAddress.parse('#/panes/')).toEqual({
			tab: 'panes',
			paneId: null,
		});
		expect(ScreenAddress.parse('#/panes/%E0%A4%A')).toEqual({
			tab: 'panes',
			paneId: null,
		});
	});
});
