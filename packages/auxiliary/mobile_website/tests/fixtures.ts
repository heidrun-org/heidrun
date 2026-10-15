import type { AgentView } from '../src/mobile_types';
import { FakeMac } from './fake_mac';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Fixtures — the coding agents and the fake Mac that most tests start from
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Builds the same four coding agents for the tests of the screens.
 */
export class Fixtures {
	/**
	 * A coding agent that waits for a yes or no about a command.
	 * @returns The coding agent.
	 */
	static blocked(): AgentView {
		return FakeMac.agent({
			paneId: 'p-blocked',
			status: 'blocked',
			menu: {
				question: 'Run this command?',
				detail: 'rm -rf build',
				options: [
					{
						n: 1,
						label: 'Yes',
					},
					{
						n: 2,
						label: 'Yes, and do not ask again',
					},
					{
						n: 3,
						label: 'No',
					},
				],
			},
		});
	}

	/**
	 * A coding agent that finished its work and asks a question.
	 * @returns The coding agent.
	 */
	static asking(): AgentView {
		return FakeMac.agent({
			paneId: 'p-asking',
			tab: 'review-12',
			status: 'done',
			question: 'Which file should I change?',
		});
	}

	/**
	 * A coding agent that finished its work and asks nothing.
	 * @returns The coding agent.
	 */
	static finished(): AgentView {
		return FakeMac.agent({
			paneId: 'p-finished',
			tab: 'docs',
			status: 'done',
		});
	}

	/**
	 * A coding agent that is still working, so it does not need the developer.
	 * @returns The coding agent.
	 */
	static working(): AgentView {
		return FakeMac.agent({
			paneId: 'p-working',
			name: 'Codex',
			kind: 'codex',
			status: 'working',
		});
	}

	/**
	 * A fake Mac with the four coding agents. The three that need the developer are listed in the wrong order on
	 * purpose.
	 * @returns The fake Mac.
	 */
	static mac(): FakeMac {
		const snapshot = FakeMac.snapshotOf(
			[Fixtures.working(), Fixtures.finished(), Fixtures.asking(), Fixtures.blocked()],
			['p-finished', 'p-asking', 'p-blocked'],
		);
		snapshot.quotas = [
			{
				name: '5-hour limit',
				percent: 42,
			},
		];
		return new FakeMac(snapshot);
	}
}
