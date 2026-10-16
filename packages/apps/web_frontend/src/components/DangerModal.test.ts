import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DangerModal from './DangerModal.vue';
import { allowCommand, answerDanger, danger, forgetProjectGuards, guardFocus } from '../stores/guards';
import { settingsModal } from '../stores/settings';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

enableAutoUnmount(afterEach);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DangerModalTest — the confirmation window names the guard and lets the developer change it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `DangerModal.vue`.
 */
class DangerModalTestHelper {
	/** The root folder of the project of the tests. */
	static readonly ROOT = '/work/app';

	/**
	 * Makes the file `.heidrun/config.json` of the project hold `guards`.
	 *
	 * @param guards - The value of the key `guards`, or undefined for a file with no key `guards`.
	 */
	static installProjectGuards(guards: Record<string, unknown> | undefined): void {
		mocks.invoke.mockImplementation(async (name: string) => {
			if (name === 'project_load') {
				return {
					root: DangerModalTestHelper.ROOT,
					config_path: `${DangerModalTestHelper.ROOT}/.heidrun/config.json`,
					config: { version: 1, launchers: [], ...(guards === undefined ? {} : { guards }) },
					detected: [],
				};
			}
			return null;
		});
	}
}

describe('the confirmation window', () => {
	beforeEach(() => {
		mocks.invoke.mockReset();
		forgetProjectGuards();
		guardFocus.guard = null;
		settingsModal.open = false;
		settingsModal.section = 'general';
		answerDanger(false);
	});

	it('shows the button "Change this guard" for a built-in guard', async () => {
		DangerModalTestHelper.installProjectGuards(undefined);
		const answer = allowCommand('git clean -fd', DangerModalTestHelper.ROOT, 'Workspace');
		await flushPromises();
		const wrapper = mount(DangerModal);
		expect(wrapper.get('[data-field="change-guard"]').text()).toBe('Change this guard');
		answerDanger(false);
		await answer;
	});

	it('shows the button for a guard of the project that forbids the command, with its description', async () => {
		DangerModalTestHelper.installProjectGuards({
			projectGuards: [
				{
					name: 'Deploy',
					description: 'Deploying to production is done by the pipeline.',
					action: 'block',
					matches: [{ type: 'contains', text: 'deploy.sh' }],
				},
			],
		});
		const answer = allowCommand('./deploy.sh --prod', DangerModalTestHelper.ROOT, 'Workspace');
		await flushPromises();
		const wrapper = mount(DangerModal);
		expect(wrapper.find('[data-field="change-guard"]').exists()).toBe(true);
		expect(wrapper.get('[data-field="description"]').text()).toBe('Deploying to production is done by the pipeline.');
		answerDanger(false);
		await answer;
	});

	it('shows no description for a hardcoded guard or for a guard that has none', async () => {
		DangerModalTestHelper.installProjectGuards(undefined);
		const answer = allowCommand('git clean -fd', DangerModalTestHelper.ROOT, 'Workspace');
		await flushPromises();
		const wrapper = mount(DangerModal);
		expect(wrapper.find('[data-field="description"]').exists()).toBe(false);
		answerDanger(false);
		await answer;
	});

	it('names the guard of the project in the focus when the developer presses the button', async () => {
		DangerModalTestHelper.installProjectGuards({
			projectGuards: [{ name: 'Publish', action: 'confirm', matches: [{ type: 'startsWith', text: 'npm publish' }] }],
		});
		const answer = allowCommand('npm publish', DangerModalTestHelper.ROOT, 'Workspace');
		await flushPromises();
		const wrapper = mount(DangerModal);
		await wrapper.get('[data-field="change-guard"]').trigger('click');
		expect(await answer).toBe(false);
		expect(guardFocus.guard).toEqual({ kind: 'project', name: 'Publish' });
	});

	it('shows no button when the file .heidrun/config.json is not valid, because no single guard stopped the command', async () => {
		mocks.invoke.mockRejectedValue('invalid');
		const answer = allowCommand('ls', DangerModalTestHelper.ROOT, 'Workspace');
		await flushPromises();
		const wrapper = mount(DangerModal);
		expect(wrapper.find('[data-field="change-guard"]').exists()).toBe(false);
		answerDanger(false);
		await answer;
	});

	it('cancels the command, closes the window, and opens the section Guards on the guard that stopped the command', async () => {
		DangerModalTestHelper.installProjectGuards(undefined);
		const answer = allowCommand('git clean -fd', DangerModalTestHelper.ROOT, 'Workspace');
		await flushPromises();
		const wrapper = mount(DangerModal);
		await wrapper.get('[data-field="change-guard"]').trigger('click');
		expect(await answer).toBe(false);
		expect(danger.open).toBe(false);
		expect(settingsModal.open).toBe(true);
		expect(settingsModal.section).toBe('guards');
		expect(guardFocus.guard).toEqual({ kind: 'builtin', key: 'guards.why.gitClean' });
	});
});
