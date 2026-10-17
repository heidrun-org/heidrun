import { describe, expect, it } from 'vitest';
import type { BoundaryViolation } from '../src/boundary_types.ts';
import { FrontendBoundaryCheck } from '../src/frontend_boundary_check.ts';

/**
 * Gives the identifiers of the rules that the violations break.
 * @param violations - The violations.
 * @returns The identifiers, in the order of the violations.
 */
function ruleIds(violations: BoundaryViolation[]): string[] {
	return violations.map((violation) => violation.ruleId);
}

/**
 * Checks the text of a web page file of the scope.
 * @param relativePath - The path of the file relative to the folder of the web frontend source.
 * @param text - The text of the file.
 * @returns The violations.
 */
function check(relativePath: string, text: string): BoundaryViolation[] {
	return FrontendBoundaryCheck.check(`packages/apps/web_frontend/src/${relativePath}`, relativePath, text);
}

describe('FrontendBoundaryCheck.isInScope', () => {
	it('is true for the stores, the components, and the libraries of the Past chats sidebar section and of the Statistics window', () => {
		const paths = [
			'stores/chats.ts',
			'stores/chat_references.ts',
			'stores/dynamic_topics.ts',
			'components/ChatsPanel.vue',
			'components/ChatFilesLine.vue',
			'components/PersonWorkTab.vue',
			'components/UserActivityTab.vue',
			'components/StatisticsModal.vue',
			'lib/chat_dates.ts',
			'lib/ai_cost.ts',
			'lib/person_work.ts',
			'lib/user_activity_slots.ts',
		];
		for (const path of paths) {
			expect(FrontendBoundaryCheck.isInScope(path), path).toBe(true);
		}
	});

	it('is false for a test file and for a file of another part', () => {
		const paths = ['stores/chats.test.ts', 'components/ChatsPanel.test.ts', 'stores/git.ts', 'components/TerminalView.vue'];
		for (const path of paths) {
			expect(FrontendBoundaryCheck.isInScope(path), path).toBe(false);
		}
	});
});

describe('FrontendBoundaryCheck.check', () => {
	it('accepts a call of a command of the list, with and without type arguments', () => {
		const text = [
			'await invoke("chats_synchronize", { folder });',
			'const found = await invoke<ChatsOfFolder>("chats_list", { folder });',
			'const rows = await invoke<Record<string, (a: string) => void>>("chat_references_find", {});',
		].join('\n');
		expect(check('stores/chats.ts', text)).toEqual([]);
	});

	it('reports a command that is not in the list', () => {
		const violations = check('stores/chats.ts', 'const log = await invoke<string>("git_log", { cwd });');
		expect(ruleIds(violations)).toEqual(['frontend-command']);
		expect(violations[0]?.message).toContain('git_log');
	});

	it('reports a call whose command is not a plain string', () => {
		expect(ruleIds(check('stores/chats.ts', 'await invoke(commandName, {});'))).toEqual(['frontend-dynamic-command']);
		expect(ruleIds(check('stores/chats.ts', 'await invoke(`chats_${kind}`, {});'))).toEqual(['frontend-dynamic-command']);
	});

	it('reports invoke that gets another name or that is passed as a value', () => {
		expect(ruleIds(check('stores/chats.ts', 'import { invoke as call } from "@tauri-apps/api/core";'))).toEqual([
			'frontend-invoke-alias',
		]);
		expect(ruleIds(check('stores/chats.ts', 'const call = invoke;'))).toEqual(['frontend-invoke-alias']);
		expect(check('stores/chats.ts', 'import { invoke } from "@tauri-apps/api/core";')).toEqual([]);
	});

	it('reports a network request and a program that the web page starts', () => {
		expect(ruleIds(check('stores/chats.ts', 'const r = await fetch("https://api.github.com");'))).toEqual([
			'frontend-network',
		]);
		expect(ruleIds(check('stores/chats.ts', 'import { Command } from "@tauri-apps/plugin-shell";'))).toEqual([
			'frontend-program',
		]);
		expect(ruleIds(check('stores/chats.ts', 'window.__TAURI_INTERNALS__.invoke("x");'))).toContain('frontend-raw-tauri');
	});

	it('reports the live reader of the forge, except in the store of the references', () => {
		const text = 'import { loadForgeReferenceDetails } from "./forge_reference_details";';
		expect(ruleIds(check('stores/chats.ts', text))).toEqual(['frontend-live-forge']);
		expect(check('stores/chat_references.ts', text)).toEqual([]);
	});

	it('does not report a comment, and reads the script of a Vue file only for its code', () => {
		const vue = [
			'<template>',
			'  <!-- fetch("https://x") -->',
			'  <p>Don\'t panic</p>',
			'</template>',
			'<script setup lang="ts">',
			'// await invoke("git_log")',
			'/* await fetch("x") */',
			'await invoke("chats_list", { folder });',
			'const address = "https://example.com/a";',
			'</script>',
		].join('\n');
		expect(check('components/ChatsPanel.vue', vue)).toEqual([]);
		const bad = vue.replace('await invoke("chats_list", { folder });', 'await invoke("git_log", { folder });');
		expect(ruleIds(check('components/ChatsPanel.vue', bad))).toEqual(['frontend-command']);
	});

	it('gives the line number of the call', () => {
		const violations = check('stores/chats.ts', 'const a = 1;\nconst b = 2;\nawait invoke("git_log");\n');
		expect(violations[0]).toMatchObject({
			filePath: 'packages/apps/web_frontend/src/stores/chats.ts',
			lineNumber: 3,
			excerpt: 'await invoke("git_log");',
		});
	});
});
