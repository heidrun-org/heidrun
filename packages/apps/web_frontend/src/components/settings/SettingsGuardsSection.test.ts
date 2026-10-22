import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsGuardsSection from './SettingsGuardsSection.vue';
import { DEFAULT_GUARDS } from '../../lib/guards';
import { parseProjectConfig, type ProjectGuard } from '../../lib/project_config';
import { forgetProjectGuards, guardFocus, guardHit } from '../../stores/guards';
import { closeGuardWindow, guardWindow } from '../../stores/guard_window';
import { project } from '../../stores/project';
import { state } from '../../stores/session';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

enableAutoUnmount(afterEach);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SettingsGuardsSectionTest — the section Guards shows the guards of the project and writes the file .heidrun/config.json
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `SettingsGuardsSection.vue`. The file `.heidrun/config.json` is a value in memory.
 */
class SettingsGuardsSectionTestHelper {
	/** The root folder of the project of the tests. */
	static readonly ROOT = '/work/app';

	/** The identifier of the workspace of the tests. */
	static readonly WORKSPACE_ID = 'w1';

	/** The content of the file `.heidrun/config.json` in memory, as the last write left it. */
	static fileConfig: unknown = null;

	/** A guard of the project that asks to confirm. */
	static readonly PUBLISH: ProjectGuard = {
		name: 'Publish',
		description: 'Publishing cannot be undone.',
		action: 'confirm',
		matches: [{ type: 'startsWith', text: 'npm publish' }],
	};

	/** A guard of the project that forbids. */
	static readonly DEPLOY: ProjectGuard = {
		name: 'Deploy',
		action: 'block',
		matches: [
			{ type: 'contains', text: 'deploy.sh' },
			{ type: 'regex', text: '--prod$' },
		],
	};

	/** The key of a built-in guard that the tests turn off. */
	static readonly GIT_CLEAN_KEY = 'guards.why.gitClean';

	/**
	 * Puts `config` in the file in memory, selects the workspace, and loads the project, as the application does.
	 *
	 * @param config - The content of the file `.heidrun/config.json`.
	 */
	static installProject(config: Record<string, unknown>): void {
		SettingsGuardsSectionTestHelper.fileConfig = config;
		mocks.invoke.mockImplementation(async (name: string, args?: { config?: unknown }) => {
			if (name === 'project_load') {
				return {
					root: SettingsGuardsSectionTestHelper.ROOT,
					config_path: `${SettingsGuardsSectionTestHelper.ROOT}/.heidrun/config.json`,
					config: SettingsGuardsSectionTestHelper.fileConfig,
					detected: [],
				};
			}
			if (name === 'project_save') {
				SettingsGuardsSectionTestHelper.fileConfig = args?.config;
			}
			return null;
		});
		state.selectedWorkspaceId = SettingsGuardsSectionTestHelper.WORKSPACE_ID;
		project.byWorkspace[SettingsGuardsSectionTestHelper.WORKSPACE_ID] = {
			root: SettingsGuardsSectionTestHelper.ROOT,
			config_path: `${SettingsGuardsSectionTestHelper.ROOT}/.heidrun/config.json`,
			config: parseProjectConfig(config),
			detected: [],
		};
		project.errors[SettingsGuardsSectionTestHelper.WORKSPACE_ID] = undefined;
	}

	/**
	 * Counts the writes of the file `.heidrun/config.json`.
	 *
	 * @returns The number of calls of the command `project_save`.
	 */
	static countSaves(): number {
		return mocks.invoke.mock.calls.filter(([name]) => name === 'project_save').length;
	}

	/**
	 * Finds the switch of a built-in guard.
	 *
	 * @param wrapper - The mounted section.
	 * @param key - The key of the built-in guard.
	 * @returns The switch input of the row.
	 */
	static getBuiltInSwitch(wrapper: ReturnType<typeof mount>, key: string) {
		return wrapper.get(`[data-guard="builtin:${key}"] input[type="checkbox"]`);
	}

	/**
	 * Finds the row of a guard.
	 *
	 * @param wrapper - The mounted section.
	 * @param idText - The text that names the guard, for example `project:Publish`.
	 * @returns The row.
	 */
	static getRow(wrapper: ReturnType<typeof mount>, idText: string) {
		const row = wrapper.findAll('[data-guard]').find((item) => item.attributes('data-guard') === idText);
		if (row === undefined) {
			throw new Error(`The row ${idText} is missing.`);
		}
		return row;
	}
}

describe('the section Guards', () => {
	beforeEach(() => {
		mocks.invoke.mockReset();
		forgetProjectGuards();
		closeGuardWindow();
		guardFocus.guard = null;
		state.selectedWorkspaceId = null;
		project.byWorkspace = {};
		project.errors = {};
	});

	it('asks the developer to select a workspace when no project is open', () => {
		const wrapper = mount(SettingsGuardsSection);
		expect(wrapper.get('[data-field="no-project"]').text()).toContain('No project is open');
		expect(wrapper.find('[data-field="guards"]').exists()).toBe(false);
	});

	it('shows the project and one row for each hardcoded guard, with a switch turned on', () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		const wrapper = mount(SettingsGuardsSection);
		expect(wrapper.get('[data-field="project-line"]').text()).toBe('Project: /work/app');
		const switchList = wrapper.findAll('[data-kind="builtin"] input[type="checkbox"]');
		expect(switchList).toHaveLength(DEFAULT_GUARDS.length);
		for (const switchInput of switchList) {
			expect((switchInput.element as HTMLInputElement).checked).toBe(true);
			expect(switchInput.attributes('role')).toBe('switch');
		}
	});

	it('shows a plain sentence, and no input, when the project has no guard of its own', () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		const wrapper = mount(SettingsGuardsSection);
		const sentence = wrapper.get('[data-field="no-project-guard"]');
		expect(sentence.text()).toBe('This project has no guard of its own yet.');
		expect(sentence.element.tagName).toBe('P');
		expect(wrapper.findAll('input[type="text"], textarea')).toHaveLength(0);
	});

	it('shows the guards of the project first, in the order of the file, then the hardcoded guards', () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.PUBLISH, SettingsGuardsSectionTestHelper.DEPLOY] },
		});
		const wrapper = mount(SettingsGuardsSection);
		const kinds = wrapper.findAll('[data-guard]').map((row) => row.attributes('data-kind'));
		expect(kinds).toEqual(['project', 'project', ...DEFAULT_GUARDS.map(() => 'builtin')]);
		const names = wrapper.findAll('[data-kind="project"] [data-field="name"]').map((name) => name.text());
		expect(names).toEqual(['Publish', 'Deploy']);
		expect(wrapper.find('[data-field="no-project-guard"]').exists()).toBe(false);
	});

	it('shows a guard of the project with its action, its description, and its lines', () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.PUBLISH, SettingsGuardsSectionTestHelper.DEPLOY] },
		});
		const wrapper = mount(SettingsGuardsSection);
		const publish = SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:Publish');
		expect(publish.get('[data-field="action"]').text()).toBe('Ask to confirm');
		expect(publish.get('[data-field="description"]').text()).toBe('Publishing cannot be undone.');
		expect(publish.findAll('[data-field="line"]').map((line) => line.text())).toEqual(['Starts with npm publish']);
		const deploy = SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:Deploy');
		expect(deploy.get('[data-field="action"]').text()).toBe('Forbid');
		expect(deploy.find('[data-field="description"]').exists()).toBe(false);
		expect(deploy.findAll('[data-field="line"]').map((line) => line.text())).toEqual(['Contains deploy.sh', 'Regular expression --prod$']);
	});

	it('shows a hardcoded guard like a guard of the project, and adds the label Hardcoded', () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.PUBLISH] },
		});
		const wrapper = mount(SettingsGuardsSection);
		const gitClean = SettingsGuardsSectionTestHelper.getRow(wrapper, `builtin:${SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY}`);
		expect(gitClean.get('[data-field="name"]').text()).toBe('git clean -f (untracked files deleted)');
		expect(gitClean.get('[data-field="action"]').text()).toBe('Ask to confirm');
		expect(gitClean.get('[data-field="description"]').text()).toBe('git clean with the option -f, alone or with other letters, for example -fd.');
		expect(gitClean.findAll('[data-field="description"] code').map((code) => code.text())).toEqual(['git clean', '-f', '-fd']);
		const gitCleanGuard = DEFAULT_GUARDS.find((guard) => guard.whyKey === SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY);
		expect(gitClean.findAll('[data-field="line"]').map((line) => line.text())).toEqual([`Regular expression ${gitCleanGuard?.re.source}`]);
		expect(gitClean.get('[data-field="hardcoded"]').text()).toBe('Hardcoded');
		const publish = SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:Publish');
		expect(publish.find('[data-field="hardcoded"]').exists()).toBe(false);
		expect(wrapper.findAll('[data-field="hardcoded"]')).toHaveLength(DEFAULT_GUARDS.length);
		for (const guard of DEFAULT_GUARDS) {
			const row = SettingsGuardsSectionTestHelper.getRow(wrapper, `builtin:${guard.whyKey}`);
			expect(row.get('[data-field="description"]').text(), guard.whyKey).not.toBe('');
		}
	});

	it('shows the lines of an old list as guards named after the pattern', () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [], guards: { block: ['deploy\\.sh'], confirm: ['^make'] } });
		const wrapper = mount(SettingsGuardsSection);
		const deploy = SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:deploy\\.sh');
		expect(deploy.get('[data-field="action"]').text()).toBe('Forbid');
		expect(deploy.get('[data-field="line"]').text()).toBe('Regular expression deploy\\.sh');
		expect(SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:^make').get('[data-field="action"]').text()).toBe('Ask to confirm');
	});

	it('gives the switch of a hardcoded guard a label with the name of the guard', () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		const wrapper = mount(SettingsGuardsSection);
		const switchInput = SettingsGuardsSectionTestHelper.getBuiltInSwitch(wrapper, SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY);
		expect(switchInput.attributes('aria-label')).toBe('Turn the guard git clean -f (untracked files deleted) on or off for this project');
	});

	it('shows a hardcoded guard that the project turned off with its switch turned off', () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { disabled: [SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY] },
		});
		const wrapper = mount(SettingsGuardsSection);
		const gitClean = SettingsGuardsSectionTestHelper.getBuiltInSwitch(wrapper, SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY);
		expect((gitClean.element as HTMLInputElement).checked).toBe(false);
		const gitResetHard = SettingsGuardsSectionTestHelper.getBuiltInSwitch(wrapper, 'guards.why.gitResetHard');
		expect((gitResetHard.element as HTMLInputElement).checked).toBe(true);
	});

	it('turns a hardcoded guard off, writes the list disabled in the file, and the next command passes', async () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		expect((await guardHit('git clean -fd', SettingsGuardsSectionTestHelper.ROOT))?.level).toBe('confirm');
		const wrapper = mount(SettingsGuardsSection);
		await SettingsGuardsSectionTestHelper.getBuiltInSwitch(wrapper, SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY).setValue(false);
		await flushPromises();
		expect(SettingsGuardsSectionTestHelper.fileConfig).toEqual({
			version: 1,
			launchers: [],
			guards: { disabled: [SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY] },
		});
		expect(await guardHit('git clean -fd', SettingsGuardsSectionTestHelper.ROOT)).toBeNull();
	});

	it('turns a hardcoded guard on again and removes the key guards when nothing is left', async () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { disabled: [SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY] },
		});
		const wrapper = mount(SettingsGuardsSection);
		await SettingsGuardsSectionTestHelper.getBuiltInSwitch(wrapper, SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY).setValue(true);
		await flushPromises();
		expect(SettingsGuardsSectionTestHelper.fileConfig).toEqual({ version: 1, launchers: [] });
		expect((await guardHit('git clean -fd', SettingsGuardsSectionTestHelper.ROOT))?.level).toBe('confirm');
	});

	it('puts the switch back and keeps the project unchanged when the file cannot be written', async () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		mocks.invoke.mockRejectedValue('disk full');
		const wrapper = mount(SettingsGuardsSection);
		const switchInput = SettingsGuardsSectionTestHelper.getBuiltInSwitch(wrapper, SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY);
		await switchInput.setValue(false);
		await flushPromises();
		expect((switchInput.element as HTMLInputElement).checked).toBe(true);
		expect(project.byWorkspace[SettingsGuardsSectionTestHelper.WORKSPACE_ID]?.config.guards).toBeUndefined();
	});

	it('opens the guard window to add a guard', async () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		const wrapper = mount(SettingsGuardsSection);
		await wrapper.get('[data-field="add-guard"]').trigger('click');
		expect(guardWindow).toMatchObject({ isOpen: true, mode: 'new' });
	});

	it('opens the guard window to edit a guard of the project', async () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.PUBLISH] },
		});
		const wrapper = mount(SettingsGuardsSection);
		await SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:Publish').get('[data-field="edit"]').trigger('click');
		expect(guardWindow).toMatchObject({ isOpen: true, mode: 'edit', name: 'Publish' });
	});

	it('opens the guard window to read a hardcoded guard, which has no button to edit and no button to remove', async () => {
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		const wrapper = mount(SettingsGuardsSection);
		const row = SettingsGuardsSectionTestHelper.getRow(wrapper, `builtin:${SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY}`);
		expect(row.find('[data-field="edit"]').exists()).toBe(false);
		expect(row.find('[data-field="remove"]').exists()).toBe(false);
		await row.get('[data-field="view"]').trigger('click');
		expect(guardWindow).toMatchObject({ isOpen: true, mode: 'view', builtInKey: SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY });
	});

	it('removes a guard of the project, writes the file, and removes the key guards when nothing is left', async () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.DEPLOY] },
		});
		expect((await guardHit('make deploy.sh', SettingsGuardsSectionTestHelper.ROOT))?.level).toBe('block');
		const wrapper = mount(SettingsGuardsSection);
		await SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:Deploy').get('[data-field="remove"]').trigger('click');
		await flushPromises();
		expect(SettingsGuardsSectionTestHelper.fileConfig).toEqual({ version: 1, launchers: [] });
		expect(await guardHit('make deploy.sh', SettingsGuardsSectionTestHelper.ROOT)).toBeNull();
		expect(wrapper.find('[data-guard="project:Deploy"]').exists()).toBe(false);
	});

	it('keeps the other guards, and moves the old lists to the key projectGuards, when it removes a guard', async () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.PUBLISH], block: ['deploy'], disabled: [SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY] },
		});
		const wrapper = mount(SettingsGuardsSection);
		await SettingsGuardsSectionTestHelper.getRow(wrapper, 'project:Publish').get('[data-field="remove"]').trigger('click');
		await flushPromises();
		expect(SettingsGuardsSectionTestHelper.fileConfig).toEqual({
			version: 1,
			launchers: [],
			guards: {
				projectGuards: [{ name: 'deploy', action: 'block', matches: [{ type: 'regex', text: 'deploy' }] }],
				disabled: [SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY],
			},
		});
	});

	it('shows the error and blocks every change when the file .heidrun/config.json cannot be read', () => {
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.PUBLISH] },
		});
		project.errors[SettingsGuardsSectionTestHelper.WORKSPACE_ID] = 'guards.confirm: invalid';
		const wrapper = mount(SettingsGuardsSection);
		expect(wrapper.get('[data-field="load-error"]').text()).toBe('guards.confirm: invalid');
		for (const control of wrapper.findAll('input, button:not([data-field="view"])')) {
			expect(control.attributes('disabled'), control.html()).toBeDefined();
		}
	});

	it('highlights the guard that stopped the command, and scrolls to it', async () => {
		const scrollIntoView = vi.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
		SettingsGuardsSectionTestHelper.installProject({ version: 1, launchers: [] });
		guardFocus.guard = { kind: 'builtin', key: SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY };
		const wrapper = mount(SettingsGuardsSection);
		await flushPromises();
		const focusedRows = wrapper.findAll('[data-focused="true"]');
		expect(focusedRows).toHaveLength(1);
		expect(focusedRows[0].attributes('data-guard')).toBe(`builtin:${SettingsGuardsSectionTestHelper.GIT_CLEAN_KEY}`);
		expect(focusedRows[0].classes()).toContain('theme-warning');
		expect(scrollIntoView).toHaveBeenCalled();
	});

	it('highlights a guard of the project, and clears the highlight when the section closes', async () => {
		Element.prototype.scrollIntoView = vi.fn();
		SettingsGuardsSectionTestHelper.installProject({
			version: 1,
			launchers: [],
			guards: { projectGuards: [SettingsGuardsSectionTestHelper.DEPLOY] },
		});
		guardFocus.guard = { kind: 'project', name: 'Deploy' };
		const wrapper = mount(SettingsGuardsSection);
		await flushPromises();
		expect(wrapper.get('[data-focused="true"] [data-field="name"]').text()).toBe('Deploy');
		wrapper.unmount();
		expect(guardFocus.guard).toBeNull();
	});
});
