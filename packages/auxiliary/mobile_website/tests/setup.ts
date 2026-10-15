import { afterEach, vi } from 'vitest';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	if (typeof document !== 'undefined') {
		document.body.innerHTML = '';
		window.localStorage.clear();
	}
});
