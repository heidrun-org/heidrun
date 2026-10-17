import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DataLayerBoundaryChecker } from '../src/data_layer_boundary_checker.ts';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');

describe('the real repository', () => {
	it('has no place in the desktop application that gets data without a package of the data layer', () => {
		const violations = DataLayerBoundaryChecker.checkDesktop(repositoryPath);
		expect(DataLayerBoundaryChecker.describe(violations)).toBe('');
	});

	it('has no place in the web page that gets data without a Tauri command of the data layer', () => {
		const violations = DataLayerBoundaryChecker.checkFrontend(repositoryPath);
		expect(DataLayerBoundaryChecker.describe(violations)).toBe('');
	});

	it('checks the Rust files and the web page files that the issue names', () => {
		const rustFilePaths = DataLayerBoundaryChecker.listRustScopeFiles(repositoryPath);
		expect(rustFilePaths).toEqual(
			expect.arrayContaining([
				'packages/apps/desktop_tauri/src/past_chats/chats.rs',
				'packages/apps/desktop_tauri/src/past_chats/chat_references.rs',
				'packages/apps/desktop_tauri/src/past_chats/chats_files.rs',
				'packages/apps/desktop_tauri/src/statistics/ai_cost.rs',
				'packages/apps/desktop_tauri/src/statistics/person_work.rs',
				'packages/apps/desktop_tauri/src/statistics/user_activity_records.rs',
			]),
		);
		const frontendFilePaths = DataLayerBoundaryChecker.listFrontendScopeFiles(repositoryPath);
		expect(frontendFilePaths).toEqual(
			expect.arrayContaining([
				'packages/apps/web_frontend/src/stores/chats.ts',
				'packages/apps/web_frontend/src/stores/chat_references.ts',
				'packages/apps/web_frontend/src/components/ChatsPanel.vue',
				'packages/apps/web_frontend/src/components/PersonWorkTab.vue',
				'packages/apps/web_frontend/src/components/UserActivityTab.vue',
			]),
		);
	});
});
