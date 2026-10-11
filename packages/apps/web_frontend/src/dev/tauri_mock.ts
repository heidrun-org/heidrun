import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { TauriMockFixture } from './tauri_mock_fixture';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TauriMock — answers the Tauri commands in a plain browser, for the development server only
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The payload of the Tauri command `herdr_request`. */
type HerdrRequestPayload = {
	/** The name of the Herdr request, for example `session.snapshot`. */
	method: string;
	/** The parameters of the Herdr request. */
	params: Record<string, unknown>;
};

/**
 * A minimal replacement for the Tauri bridge. It lets a plain browser show the connected screens of the
 * application, with the fake Herdr session of `TauriMockFixture`. Every command that is not listed here fails
 * with an error, the same way as a command that the Rust side refuses.
 */
export class TauriMock {
	/**
	 * Installs the mock when the code runs in the development server and no real Tauri bridge exists.
	 * Does nothing in a production build, and does nothing inside the Tauri window.
	 */
	static install(): void {
		if (import.meta.env.DEV === false) {
			return;
		}
		const tauriWindow = window as unknown as { __TAURI_INTERNALS__?: unknown };
		if (tauriWindow.__TAURI_INTERNALS__ !== undefined) {
			return;
		}
		mockWindows('main');
		mockIPC(TauriMock._handleCommand, {
			shouldMockEvents: true,
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Command handlers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Answers one Tauri command.
	 *
	 * @param command - The name of the Tauri command.
	 * @param payload - The arguments of the Tauri command.
	 * @returns The value that the command returns.
	 */
	private static _handleCommand(command: string, payload?: InvokeArgs): unknown {
		if (command.startsWith('plugin:')) {
			return null;
		}
		switch (command) {
			case 'herdr_request':
				return TauriMock._handleHerdrRequest(payload as HerdrRequestPayload);
			case 'herdr_paths':
				return {
					socket: '/tmp/herdr.sock',
					socket_exists: true,
					bin: '/usr/local/bin/herdr',
					bin_exists: true,
				};
			case 'codex_usage':
				return {
					available: false,
					sessions: {},
				};
			case 'history_read':
				return [];
			case 'git_status':
			case 'mobile_status':
			case 'herdr_watch_panes':
			case 'show_main_window':
			case 'history_append':
			case 'set_unsaved':
				return null;
			default:
				throw new Error(`mock: the command "${command}" is not available in the browser`);
		}
	}

	/**
	 * Answers one Herdr request.
	 *
	 * @param requestPayload - The method and the parameters of the Herdr request.
	 * @returns The result of the Herdr request.
	 */
	private static _handleHerdrRequest(requestPayload: HerdrRequestPayload): unknown {
		switch (requestPayload.method) {
			case 'session.snapshot':
				return {
					snapshot: TauriMockFixture.buildSnapshot(),
				};
			case 'layout.set_split_ratio':
				TauriMockFixture.setSplitRatio(
					requestPayload.params.path as boolean[],
					requestPayload.params.ratio as number,
				);
				return {};
			case 'pane.read':
				return {
					read: {
						text: TauriMockFixture.readPaneText(String(requestPayload.params.pane_id)),
					},
				};
			default:
				return {};
		}
	}
}
