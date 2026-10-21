import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignRules } from './design_rules';
import { ThemePalette } from './theme_palette';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThemePaletteTest — named colour teams update and persist across appearances
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

beforeEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('style');
	vi.resetModules();
});

describe('the named application colour teams', () => {
	it('keeps action text and links readable and keyboard focus visible in both appearances', () => {
		for (const team of ThemePalette.COLOR_TEAMS.slice(1)) {
			for (const mode of ['dark', 'light'] as const) {
				expect(DesignRules.contrast(team[mode]['action-text'], team[mode]['action-bg']), `${team.id} ${mode} action`)
					.toBeGreaterThanOrEqual(4.5);
				expect(DesignRules.contrast(team[mode].link, team[mode].bg), `${team.id} ${mode} link`)
					.toBeGreaterThanOrEqual(4.5);
				expect(DesignRules.contrast(team[mode].focus, team[mode].bg), `${team.id} ${mode} focus`)
					.toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('applies a selected team immediately and keeps it when the appearance changes', async () => {
		const { ThemePalette } = await import('./theme_palette');
		ThemePalette.activate('dark');
		ThemePalette.selectTeam('ocean');
		expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#2767c8');
		expect(document.documentElement.style.getPropertyValue('--link')).toBe('#78b7ff');
		expect(document.documentElement.style.getPropertyValue('--working')).toBe('');
		ThemePalette.activate('light');
		expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#145bb8');
		expect(ThemePalette.selectedTeam.value).toBe('ocean');
	});

	it('restores the selected team after the application reloads', async () => {
		const first = await import('./theme_palette');
		first.ThemePalette.selectTeam('forest');
		vi.resetModules();
		const second = await import('./theme_palette');
		second.ThemePalette.activate('dark');
		expect(second.ThemePalette.selectedTeam.value).toBe('forest');
		expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#287c4b');
	});

	it('ignores an unknown saved team and an unknown selection', async () => {
		localStorage.setItem('heidrun.color-team', 'unknown');
		const { ThemePalette } = await import('./theme_palette');
		expect(ThemePalette.selectedTeam.value).toBe('amber');
		ThemePalette.activate('dark');
		ThemePalette.selectTeam('unknown');
		expect(document.documentElement.style.length).toBe(0);
	});
});
