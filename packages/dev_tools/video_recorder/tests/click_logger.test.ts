import ChildProcess from 'node:child_process';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

const isMacos = process.platform === 'darwin';

/**
 * Runs the click logger script with `osascript`.
 * @param args The arguments of the script.
 * @returns The standard output, the standard error output, and the exit code.
 */
function runClickLogger(args: string[]): { stdout: string; stderr: string; exitCode: number | null } {
	const result = ChildProcess.spawnSync(
		'osascript',
		['-l', 'JavaScript', Path.join(__dirname, '..', 'src', 'click_logger.js'), ...args],
		{ encoding: 'utf8' },
	);
	return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status };
}

describe.skipIf(isMacos === false)('click_logger.js', () => {
	it('finds a window of the application Finder', () => {
		const result = runClickLogger(['window', 'Finder']);
		if (result.exitCode === 0) {
			const window = JSON.parse(result.stdout) as { windowId: number; width: number; height: number };
			expect(window.windowId).toBeGreaterThan(0);
			expect(window.width).toBeGreaterThan(0);
		} else {
			expect(result.stderr).toContain('No visible window of the application Finder');
		}
	});

	it('exits with code 1 and says so when the application has no visible window', () => {
		const result = runClickLogger(['window', 'No Such Application']);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('No visible window of the application No Such Application');
	});

	it('exits with code 64 and prints the usage when the command is unknown', () => {
		const result = runClickLogger(['dance']);
		expect(result.exitCode).toBe(64);
		expect(result.stderr).toContain('Usage');
	});
});
