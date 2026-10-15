import { afterEach, vi } from 'vitest';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
	window.localStorage.clear();
});
