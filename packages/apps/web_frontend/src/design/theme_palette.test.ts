import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignRules } from './design_rules';
import { ThemePalette } from './theme_palette';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThemePaletteTest — named color themes update and persist across appearances
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

beforeEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('style');
	vi.resetModules();
});

describe('the named application color themes', () => {
	it('keeps action text and links readable and keyboard focus visible in both appearances', () => {
		for (const colorTheme of ThemePalette.COLOR_THEMES.slice(1)) {
			for (const mode of ['dark', 'light'] as const) {
				expect(DesignRules.contrast(colorTheme[mode]['action-text'], colorTheme[mode]['action-bg']), `${colorTheme.id} ${mode} action`)
					.toBeGreaterThanOrEqual(4.5);
				expect(DesignRules.contrast(colorTheme[mode].link, colorTheme[mode].bg), `${colorTheme.id} ${mode} link`)
					.toBeGreaterThanOrEqual(4.5);
				expect(DesignRules.contrast(colorTheme[mode].focus, colorTheme[mode].bg), `${colorTheme.id} ${mode} focus`)
					.toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('applies a selected theme immediately and keeps it when the appearance changes', async () => {
		const { ThemePalette } = await import('./theme_palette');
		ThemePalette.activate('dark');
		ThemePalette.selectTheme('ocean');
		expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#2767c8');
		expect(document.documentElement.style.getPropertyValue('--link')).toBe('#78b7ff');
		expect(document.documentElement.style.getPropertyValue('--working')).toBe('');
		ThemePalette.activate('light');
		expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#145bb8');
		expect(ThemePalette.selectedTheme.value).toBe('ocean');
	});

	it('restores the selected theme after the application reloads', async () => {
		const first = await import('./theme_palette');
		first.ThemePalette.selectTheme('forest');
		vi.resetModules();
		const second = await import('./theme_palette');
		second.ThemePalette.activate('dark');
		expect(second.ThemePalette.selectedTheme.value).toBe('forest');
		expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#287c4b');
	});

	it('ignores an unknown saved theme and an unknown selection', async () => {
		localStorage.setItem('heidrun.color-theme', 'unknown');
		const { ThemePalette } = await import('./theme_palette');
		expect(ThemePalette.selectedTheme.value).toBe('amber');
		ThemePalette.activate('dark');
		ThemePalette.selectTheme('unknown');
		expect(document.documentElement.style.length).toBe(0);
	});
});
