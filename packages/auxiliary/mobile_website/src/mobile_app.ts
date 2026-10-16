import { MobileApi, UnpairedError } from './mobile_api';
import type {
	CallResult,
	ConfirmRequest,
	LaunchersAnswer,
	MacrosAnswer,
	MacroView,
	ScreenName,
	Snapshot,
	TabName,
} from './mobile_types';
import { ColorPainter } from './color_painter';
import { ScreenAddress } from './screen_address';
import type { ScreenLocation } from './screen_address';
import { SnapshotQueries } from './snapshot_queries';
import { BottomBar } from './components/bottom_bar';
import { ConfirmSheet } from './components/confirm_sheet';
import { MacroSheet } from './components/macro_sheet';
import { MessageScreen } from './screens/message_screen';
import { DashboardScreen } from './screens/dashboard_screen';
import { NeedsYouScreen } from './screens/needs_you_screen';
import { PanesScreen } from './screens/panes_screen';
import { PaneScreen } from './screens/pane_screen';
import { LaunchersScreen } from './screens/launchers_screen';
import { WelcomeScreen } from './screens/welcome_screen';
import { VoiceInput } from './voice_input';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MobileApp — the page: the screen that is open, the refresh of the data, and the taps of the developer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The mobile website. It asks the computer for the state of the coding agents, draws one screen at a time, and
 * sends the answers, the prompts, and the stop keys of the developer back to the computer.
 */
export class MobileApp {
	/** The delay between two refreshes on a screen of the bottom bar, in milliseconds. */
	static readonly listRefreshMs = 4000;

	/** The delay between two refreshes on the screen of one pane, in milliseconds. */
	static readonly paneRefreshMs = 2500;

	/** The number of lines of the output of a pane that the page asks for. */
	static readonly outputLines = 300;

	/** The distance from the end of the output, in pixels, under which the developer is said to look at the end. */
	static readonly endToleranceInPixels = 24;

	/** The time that a message stays on the screen, in milliseconds. */
	static readonly toastMs = 3200;

	/** The element that holds the screen. */
	private readonly root: HTMLElement;

	/** The element that holds the message and the confirmation sheet. A new screen does not remove them. */
	private readonly overlay: HTMLElement;

	/** The screen that is open. */
	private screen: ScreenName = 'welcome';

	/** The screen of the bottom bar that is highlighted, and where the button Back of a pane goes. */
	private tab: TabName = 'welcome';

	/** The identifier of the pane that the screen of one pane shows, or null. */
	private paneId: string | null = null;

	/** The last answer of the method `state`, or null before the first answer, and after an unpaired answer. */
	private snapshot: Snapshot | null = null;

	/** True when the last call worked, false when it failed, null before the first call. */
	private isOnline: boolean | null = null;

	/** The end of the output of the pane that is open. */
	private output = '';

	/** The macros of the macro sheet that is open, or an empty list when no macro sheet is open. */
	private macros: MacroView[] = [];

	/** The last answer of the method `launchers`, or null before the first answer on the Launchers screen. */
	private launchers: LaunchersAnswer | null = null;

	/** The microphone that fills the field for a prompt. */
	private readonly voiceInput = new VoiceInput();

	/** The HTML that the root element holds now. The screen is drawn again only when the new HTML differs. */
	private renderedHtml = '';

	/** Names the screen that the root element shows. A new screen starts at the top. A refresh keeps the scroll. */
	private renderedKey = '';

	/** The timer of the next refresh, or null. */
	private timer: ReturnType<typeof setTimeout> | null = null;

	/** The timer that removes the message, or null. */
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	/** Answers the confirmation sheet that is open, or null when no sheet is open. */
	private confirmation: ((isConfirmed: boolean) => void) | null = null;

	/** Opens the screen that the address names, when the developer uses the buttons Back and Forward. */
	private readonly onPopState = (): void => {
		this._applyLocation(ScreenAddress.parse(window.location.hash));
		this._render();
		void this.refresh();
	};

	/** Refreshes when the page becomes visible again. */
	private readonly onVisibilityChange = (): void => {
		if (document.hidden === false) {
			void this.refresh();
		}
	};

	/**
	 * Creates the page. Nothing is drawn before `start`.
	 * @param root The element that holds the screen.
	 * @param overlay The element that holds the message and the confirmation sheet.
	 */
	constructor(root: HTMLElement, overlay: HTMLElement) {
		this.root = root;
		this.overlay = overlay;
	}

	/**
	 * Keeps the pairing key of the address, opens the screen that the address names, listens to the taps, and
	 * draws the first screen.
	 * @returns A promise that ends when the first refresh ends.
	 */
	async start(): Promise<void> {
		MobileApi.capturePairingKey();
		this._applyLocation(ScreenAddress.parse(window.location.hash));
		this._writeAddress(true);
		this.root.addEventListener('click', (event) => void this._onClick(event));
		this.overlay.addEventListener('click', (event) => void this._onClick(event));
		this.root.addEventListener('keydown', (event) => void this._onKeyDown(event));
		document.addEventListener('visibilitychange', this.onVisibilityChange);
		window.addEventListener('popstate', this.onPopState);
		await this.refresh();
	}

	/**
	 * Stops the page: no more refresh, and no more listener on the document and on the window.
	 */
	stop(): void {
		this._clearTimer();
		if (this.toastTimer !== null) {
			clearTimeout(this.toastTimer);
			this.toastTimer = null;
		}
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
		window.removeEventListener('popstate', this.onPopState);
	}

	/**
	 * Asks the computer for the state, and for the output of the open pane. Then it draws the screen again, and
	 * plans the next refresh unless the page is hidden.
	 * @returns A promise that ends when the screen is drawn.
	 */
	async refresh(): Promise<void> {
		this._clearTimer();
		if (MobileApi.pairingKey() === '') {
			this._render();
			return;
		}
		try {
			this.snapshot = await MobileApi.call<Snapshot>('state');
			this.isOnline = true;
			const openPaneId = this.paneId ?? '';
			const openAgent = SnapshotQueries.agentById(this.snapshot, openPaneId);
			if (this.screen === 'pane' && openAgent !== null) {
				const result = await MobileApi.call<CallResult>('read', {
					paneId: openAgent.paneId,
					lines: MobileApp.outputLines,
					ansi: true,
				});
				if (typeof result.text === 'string') {
					this.output = result.text;
				}
			}
			if (this.screen === 'launchers') {
				this.launchers = await MobileApi.call<LaunchersAnswer>('launchers');
			}
		} catch (error) {
			this.isOnline = false;
			if (error instanceof UnpairedError) {
				this.snapshot = null;
			}
		}
		this._render();
		if (document.hidden === false) {
			const delay = this.screen === 'pane' ? MobileApp.paneRefreshMs : MobileApp.listRefreshMs;
			this.timer = setTimeout(() => void this.refresh(), delay);
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Private methods
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	private _clearTimer(): void {
		if (this.timer !== null) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private _refreshSoon(delayMs: number): void {
		setTimeout(() => void this.refresh(), delayMs);
	}

	/**
	 * Tells if the developer types a prompt now. A new screen would remove the text that is typed.
	 * @returns True when the field for a prompt has the focus.
	 */
	private _isTyping(): boolean {
		const active = document.activeElement;
		if (this.voiceInput.isListening()) {
			return true;
		}
		return (
			this.screen === 'pane' &&
			active !== null &&
			active.tagName === 'TEXTAREA' &&
			this.root.contains(active)
		);
	}

	private _render(): void {
		if (this._isTyping()) {
			return;
		}
		if (this.screen === 'welcome') {
			this._show(WelcomeScreen.render(), 'welcome');
			return;
		}
		if (MobileApi.pairingKey() === '') {
			this._show(MessageScreen.pairing(), 'message');
			return;
		}
		if (this.snapshot === null) {
			this._show(MessageScreen.connecting(this.isOnline), 'message');
			return;
		}
		const screenHtmlContent = this._screenHtmlContent(this.snapshot) + BottomBar.render(this.tab);
		this._show(screenHtmlContent, `${this.screen}:${this.paneId ?? ''}`);
	}

	/**
	 * Puts the HTML of a screen in the root element, and keeps where the developer scrolled. A refresh with the
	 * same HTML changes nothing. A refresh of the same screen keeps the scroll of the page and of the output, and
	 * the output follows its end only when the developer already looks at the end. A new screen starts at the top,
	 * and its output starts at the end.
	 * @param htmlContent The HTML of the screen and of the bottom bar.
	 * @param key The name of the screen: two refreshes of the same screen have the same name.
	 */
	private _show(htmlContent: string, key: string): void {
		if (htmlContent === this.renderedHtml) {
			return;
		}
		const isSameScreen = key === this.renderedKey;
		const oldOutput = this.root.querySelector('.output');
		const oldMain = this.root.querySelector('main');
		const isAtEnd =
			oldOutput === null ||
			oldOutput.scrollHeight - oldOutput.scrollTop - oldOutput.clientHeight <=
				MobileApp.endToleranceInPixels;
		const outputTop = oldOutput?.scrollTop ?? 0;
		const mainTop = oldMain?.scrollTop ?? 0;
		this.root.innerHTML = htmlContent;
		this.renderedHtml = htmlContent;
		this.renderedKey = key;
		ColorPainter.paint(this.root);
		const output = this.root.querySelector('.output');
		if (output !== null) {
			output.scrollTop = isSameScreen && isAtEnd === false ? outputTop : output.scrollHeight;
		}
		const main = this.root.querySelector('main');
		if (main !== null && isSameScreen) {
			main.scrollTop = mainTop;
		}
	}

	private _screenHtmlContent(snapshot: Snapshot): string {
		if (this.screen === 'pane') {
			const agent = this.paneId === null ? null : SnapshotQueries.agentById(snapshot, this.paneId);
			return PaneScreen.render(agent, this.output, VoiceInput.isAvailable());
		}
		if (this.screen === 'panes') {
			return PanesScreen.render(snapshot, this.isOnline);
		}
		if (this.screen === 'launchers') {
			return LaunchersScreen.render(this.launchers, this.isOnline);
		}
		if (this.screen === 'needs_you') {
			return NeedsYouScreen.render(snapshot, this.isOnline);
		}
		return DashboardScreen.render(snapshot, this.isOnline);
	}

	/**
	 * Opens a screen, adds it to the history of the browser, and puts it in the address.
	 * @param tab The screen of the bottom bar to open, or the one that the pane came from.
	 * @param paneId The identifier of the pane to open, or null for the screen of the bottom bar.
	 */
	private _open(tab: TabName, paneId: string | null): void {
		this._applyLocation({
			tab,
			paneId,
		});
		this._writeAddress(false);
		this._render();
		void this.refresh();
	}

	private _applyLocation(location: ScreenLocation): void {
		this.voiceInput.stop();
		this._closeMacroSheet();
		this.tab = location.tab;
		this.screen = location.paneId === null ? location.tab : 'pane';
		this.paneId = location.paneId;
		this.output = '';
	}

	/**
	 * Puts the open screen in the address of the page.
	 * @param isReplace True to replace the entry of the history that is current, false to add a new entry.
	 */
	private _writeAddress(isReplace: boolean): void {
		const hash = ScreenAddress.format(this.tab, this.paneId);
		if (window.location.hash === hash) {
			return;
		}
		if (isReplace) {
			window.history.replaceState(null, '', hash);
		} else {
			window.history.pushState(null, '', hash);
		}
	}

	private async _onClick(event: Event): Promise<void> {
		const target = event.target;
		if (target instanceof Element === false) {
			return;
		}
		const element = target.closest<HTMLElement>('[data-action]');
		if (element === null) {
			return;
		}
		const action = element.dataset.action ?? '';
		const paneId = element.dataset.paneId ?? '';
		if (action === 'sheet-cancel') {
			if (target === element) {
				this._closeConfirmation(false);
			}
			return;
		}
		if (action === 'sheet-confirm') {
			this._closeConfirmation(true);
			return;
		}
		if (action === 'go') {
			this._open((element.dataset.screen ?? 'dashboard') as TabName, null);
		} else if (action === 'open-pane') {
			this._open(this.tab, paneId);
		} else if (action === 'back') {
			this._open(this.tab, null);
		} else if (action === 'refresh') {
			await this.refresh();
		} else if (action === 'answer') {
			if (await this._act('answer', { paneId, n: Number(element.dataset.n) })) {
				this._toast('Answer sent');
				this._refreshSoon(900);
			}
		} else if (action === 'deny') {
			if (await this._act('keys', { paneId, action: 'deny' })) {
				this._toast('Refused (Esc)');
			}
		} else if (action === 'interrupt') {
			if (await this._act('keys', { paneId, action: 'interrupt' })) {
				this._toast('Interrupted (Esc)');
			}
		} else if (action === 'send') {
			await this._sendPrompt(paneId);
		} else if (action === 'voice') {
			this._toggleVoice(element);
		} else if (action === 'open-macros') {
			await this._openMacroSheet();
		} else if (action === 'macro-sheet-close') {
			if (target === element || element.tagName === 'BUTTON') {
				this._closeMacroSheet();
			}
		} else if (action === 'insert-macro') {
			this._insertMacro(Number(element.dataset.index));
		} else if (action === 'run-launcher' || action === 'stop-launcher') {
			await this._launch(element, action === 'run-launcher' ? 'run' : 'stop');
		}
	}

	/**
	 * Asks the computer for the macros of the open pane, then opens the macro sheet.
	 */
	private async _openMacroSheet(): Promise<void> {
		if (this.paneId === null) {
			return;
		}
		try {
			const answer = await MobileApi.call<MacrosAnswer & CallResult>('macros', {
				paneId: this.paneId,
			});
			if (typeof answer.error === 'string') {
				this._toast(answer.error);
				return;
			}
			this._closeMacroSheet();
			this.macros = answer.macros;
			this.overlay.insertAdjacentHTML('beforeend', MacroSheet.render(this.macros));
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			this._toast(`No answer from the computer: ${reason}`);
		}
	}

	private _closeMacroSheet(): void {
		this.overlay.querySelector('.macro-sheet')?.remove();
		this.macros = [];
	}

	/**
	 * Writes the text of a macro into the field for a prompt, after the text that is already there, like the
	 * keyboard. Nothing is sent before the developer taps Send.
	 * @param index The place of the macro in the macro sheet.
	 */
	private _insertMacro(index: number): void {
		const macro = this.macros[index];
		this._closeMacroSheet();
		const field = this.root.querySelector<HTMLTextAreaElement>(`#${PaneScreen.promptFieldId}`);
		if (macro === undefined || field === null) {
			return;
		}
		const textBefore = field.value.trimEnd();
		field.value = textBefore === '' ? macro.text : `${textBefore} ${macro.text}`;
		field.focus();
	}

	/**
	 * Runs or stops a launcher on the computer.
	 * @param element The button that the developer tapped. It names the workspace and the launcher.
	 * @param launchAction `run` to run the command of the launcher, `stop` to send Ctrl+C to its tab.
	 */
	private async _launch(element: HTMLElement, launchAction: 'run' | 'stop'): Promise<void> {
		const params = {
			workspaceId: element.dataset.workspaceId ?? '',
			launcherId: element.dataset.launcherId ?? '',
			action: launchAction,
		};
		if (await this._act('launch', params)) {
			this._toast(launchAction === 'run' ? 'Launcher started' : 'Launcher stopped (Ctrl+C)');
			this._refreshSoon(1200);
		}
	}

	/**
	 * Starts or stops the microphone. The words go into the field for a prompt, after the text that is already
	 * there. The developer reads them, then taps Send.
	 * @param button The microphone button.
	 */
	private _toggleVoice(button: HTMLElement): void {
		if (this.voiceInput.isListening()) {
			this.voiceInput.stop();
			return;
		}
		const field = this.root.querySelector<HTMLTextAreaElement>(`#${PaneScreen.promptFieldId}`);
		if (field === null) {
			return;
		}
		const textBefore = field.value.trimEnd();
		button.classList.add('mic-button-listening');
		button.setAttribute('aria-pressed', 'true');
		this.voiceInput.start({
			onText: (text) => {
				field.value = textBefore === '' ? text : `${textBefore} ${text}`;
			},
			onError: (message) => this._toast(message),
			onEnd: () => {
				button.classList.remove('mic-button-listening');
				button.setAttribute('aria-pressed', 'false');
				field.focus();
			},
		});
	}

	/**
	 * Sends the prompt when the developer presses Cmd+Enter or Ctrl+Enter in the field for a prompt. A plain Enter
	 * and Shift+Enter keep adding a new line.
	 * @param event The key that the developer pressed.
	 */
	private async _onKeyDown(event: KeyboardEvent): Promise<void> {
		const isModified = event.metaKey || event.ctrlKey;
		const isSendKey = event.key === 'Enter' && isModified && event.isComposing === false;
		const target = event.target;
		const isPromptField = target instanceof HTMLTextAreaElement && target.id === PaneScreen.promptFieldId;
		if (isSendKey === false || isPromptField === false || this.paneId === null) {
			return;
		}
		event.preventDefault();
		await this._sendPrompt(this.paneId);
	}

	private async _sendPrompt(paneId: string): Promise<void> {
		const field = this.root.querySelector<HTMLTextAreaElement>(`#${PaneScreen.promptFieldId}`);
		if (field === null || field.value.trim() === '') {
			return;
		}
		if (await this._act('prompt', { paneId, text: field.value.trim() })) {
			field.value = '';
			field.blur();
			this._toast('Prompt sent');
			this._refreshSoon(800);
		}
	}

	/**
	 * Sends one call that changes something on the computer. A dangerous command goes through the confirmation
	 * sheet first.
	 * @param method The name of the method.
	 * @param params The parameters of the method.
	 * @returns True when the computer did what the call asked, false when it refused, failed, or the developer
	 * cancelled.
	 */
	private async _act(method: string, params: Record<string, unknown>): Promise<boolean> {
		try {
			let result = await MobileApi.call<CallResult>(method, params);
			if (result.confirm !== undefined) {
				const command = result.confirm.command;
				if ((await this._askConfirmation(result.confirm)) === false) {
					return false;
				}
				result = await MobileApi.call<CallResult>(method, {
					...params,
					confirmed: true,
					command,
				});
				if (result.confirm !== undefined) {
					this._toast('The command changed in the meantime: check it again');
					return false;
				}
			}
			if (typeof result.error === 'string') {
				this._toast(result.error);
				return false;
			}
			return true;
		} catch (error) {
			if (error instanceof UnpairedError) {
				this.snapshot = null;
				this._render();
			} else {
				const reason = error instanceof Error ? error.message : String(error);
				this._toast(`No answer from the computer: ${reason}`);
			}
			return false;
		}
	}

	private _askConfirmation(request: ConfirmRequest): Promise<boolean> {
		return new Promise((resolve) => {
			this.confirmation = resolve;
			this.overlay.insertAdjacentHTML('beforeend', ConfirmSheet.render(request));
		});
	}

	private _closeConfirmation(isConfirmed: boolean): void {
		this.overlay.querySelector('.sheet')?.remove();
		const answer = this.confirmation;
		this.confirmation = null;
		if (answer !== null) {
			answer(isConfirmed);
		}
	}

	private _toast(message: string): void {
		this.overlay.querySelector('.toast')?.remove();
		const toast = document.createElement('div');
		toast.className = 'toast';
		toast.setAttribute('role', 'status');
		toast.textContent = message;
		this.overlay.append(toast);
		if (this.toastTimer !== null) {
			clearTimeout(this.toastTimer);
		}
		this.toastTimer = setTimeout(() => toast.remove(), MobileApp.toastMs);
	}
}
