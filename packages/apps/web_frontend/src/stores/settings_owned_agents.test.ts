import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn(async () => [] as string[]));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsOwnedAgentsTestSetup — reloads saved coding-agent settings
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

class SettingsOwnedAgentsTestSetup {
	static async settingsFrom(saved: unknown): Promise<typeof import('./settings').settings> {
		localStorage.setItem('heidrun.settings', JSON.stringify(saved));
		vi.resetModules();
		return (await import('./settings')).settings;
	}
}

beforeEach(() => {
	localStorage.clear();
	invoke.mockReset();
	invoke.mockResolvedValue([]);
});

afterEach(() => {
	localStorage.clear();
});

describe('coding agents saved settings', () => {
	it('switches on only the installed coding agents when no choice was saved', async () => {
		invoke.mockResolvedValue(['codex', 'antigravity']);
		const settings = await SettingsOwnedAgentsTestSetup.settingsFrom({ language: 'en' });

		await vi.waitFor(() => expect(settings.ownedAgents).toEqual(['codex', 'antigravity']));
		expect(invoke).toHaveBeenCalledWith('coding_agents_available');
	});

	it('keeps an explicitly saved empty choice and does not check the command line tools', async () => {
		const settings = await SettingsOwnedAgentsTestSetup.settingsFrom({ ownedAgents: [], ownedAgentsConfigured: true });

		await Promise.resolve();
		expect(settings.ownedAgents).toEqual([]);
		expect(invoke).not.toHaveBeenCalledWith('coding_agents_available');
	});

	it('leaves all coding agents off when none of their command line tools is available', async () => {
		invoke.mockResolvedValue([]);
		const settings = await SettingsOwnedAgentsTestSetup.settingsFrom({});

		await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('coding_agents_available'));
		await Promise.resolve();
		expect(settings.ownedAgents).toEqual([]);
		expect(settings.ownedAgentsConfigured).toBe(true);
	});
});
