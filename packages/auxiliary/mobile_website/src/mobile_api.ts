///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MobileApi — the pairing key, and the calls to the mobile server
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The error of a call that the mobile server refused because the pairing key is missing or wrong.
 */
export class UnpairedError extends Error {
	constructor() {
		super('unpaired');
		this.name = 'UnpairedError';
	}
}

/**
 * Keeps the pairing key of this phone, and sends the calls of the page to the mobile server.
 */
export class MobileApi {
	/**
	 * The name under which the phone keeps the pairing key. It stays the same as in the first mobile page, so a
	 * phone that is already paired stays paired.
	 */
	static readonly storageKey = 'hd-token';

	/** The header that carries the pairing key. */
	static readonly keyHeader = 'x-herdr-token';

	/**
	 * Takes the pairing key from the address of the page, keeps it, and removes it from the address. The QR code
	 * puts the key after "#", the part of an address that a browser never sends to a server.
	 */
	static capturePairingKey(): void {
		const match = /[#&]t=([0-9a-f]{64})/.exec(window.location.hash);
		if (match === null) {
			return;
		}
		try {
			window.localStorage.setItem(MobileApi.storageKey, match[1]);
		} catch {
			// A phone that refuses to keep data stays unpaired: the page asks for the QR code again.
		}
		window.history.replaceState(null, '', window.location.pathname);
	}

	/**
	 * Gives the pairing key of this phone.
	 * @returns The pairing key, or an empty text when this phone is not paired.
	 */
	static pairingKey(): string {
		try {
			return window.localStorage.getItem(MobileApi.storageKey) ?? '';
		} catch {
			return '';
		}
	}

	/**
	 * Forgets the pairing key, for example after the computer revoked it.
	 */
	static forgetPairingKey(): void {
		try {
			window.localStorage.removeItem(MobileApi.storageKey);
		} catch {
			// Nothing was kept.
		}
	}

	/**
	 * Sends one call to the mobile server.
	 * @param method The name of the method. The mobile server accepts only a closed list of names.
	 * @param params The parameters of the method.
	 * @returns The answer of the computer.
	 * @throws UnpairedError when the mobile server refuses the pairing key.
	 * @throws Error with the text of the server when the call fails for another reason.
	 */
	static async call<Answer>(method: string, params: Record<string, unknown> = {}): Promise<Answer> {
		const response = await fetch('/api', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				[MobileApi.keyHeader]: MobileApi.pairingKey(),
			},
			body: JSON.stringify({
				method,
				params,
			}),
		});
		if (response.status === 401) {
			MobileApi.forgetPairingKey();
			throw new UnpairedError();
		}
		if (response.ok === false) {
			throw new Error(await response.text());
		}
		return (await response.json()) as Answer;
	}
}
