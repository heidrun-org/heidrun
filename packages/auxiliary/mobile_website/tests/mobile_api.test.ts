import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileApi, UnpairedError } from '../src/mobile_api';
import { FakeMac } from './fake_mac';

const otherKey = 'b'.repeat(64);

describe('MobileApi pairing key', () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.history.replaceState(null, '', '/');
	});

	it('keeps the key of the address, and removes the key from the address', () => {
		window.history.replaceState(null, '', `/#t=${FakeMac.key}`);
		MobileApi.capturePairingKey();
		expect(window.localStorage.getItem('hd-token')).toBe(FakeMac.key);
		expect(window.location.hash).toBe('');
	});

	it('finds the key when it follows another part of the address', () => {
		window.history.replaceState(null, '', `/#x=1&t=${FakeMac.key}`);
		MobileApi.capturePairingKey();
		expect(MobileApi.pairingKey()).toBe(FakeMac.key);
	});

	it('ignores a key that is too short or that has other characters than hexadecimal digits', () => {
		window.history.replaceState(null, '', '/#t=abc');
		MobileApi.capturePairingKey();
		window.history.replaceState(null, '', `/#t=${'z'.repeat(64)}`);
		MobileApi.capturePairingKey();
		expect(MobileApi.pairingKey()).toBe('');
	});

	it('gives an empty text when the phone refuses to keep data', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied');
		});
		expect(MobileApi.pairingKey()).toBe('');
	});

	it('forgets the key', () => {
		window.localStorage.setItem('hd-token', FakeMac.key);
		MobileApi.forgetPairingKey();
		expect(MobileApi.pairingKey()).toBe('');
	});
});

describe('MobileApi call', () => {
	beforeEach(() => {
		window.localStorage.clear();
		window.localStorage.setItem('hd-token', FakeMac.key);
	});

	it('sends the method, the parameters, and the pairing key in the header', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([], []));
		mac.install();
		const answer = await MobileApi.call<{ ok: boolean }>('keys', {
			paneId: 'p-1',
			action: 'deny',
		});
		expect(answer).toEqual({ ok: true });
		expect(mac.calls).toEqual([
			{
				method: 'keys',
				params: {
					paneId: 'p-1',
					action: 'deny',
				},
				key: FakeMac.key,
			},
		]);
	});

	it('throws UnpairedError and forgets the key when the server refuses the key', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([], []));
		mac.acceptedKey = otherKey;
		mac.install();
		await expect(MobileApi.call('state')).rejects.toBeInstanceOf(UnpairedError);
		expect(MobileApi.pairingKey()).toBe('');
	});

	it('throws an error with the text of the server when the call fails for another reason', async () => {
		vi.stubGlobal('fetch', async () => new Response('too large', {
			status: 413,
		}));
		await expect(MobileApi.call('prompt')).rejects.toThrow('too large');
		expect(MobileApi.pairingKey()).toBe(FakeMac.key);
	});

	it('lets the error of the network pass, and keeps the key', async () => {
		const mac = new FakeMac(FakeMac.snapshotOf([], []));
		mac.isDown = true;
		mac.install();
		await expect(MobileApi.call('state')).rejects.toThrow('Failed to fetch');
		expect(MobileApi.pairingKey()).toBe(FakeMac.key);
	});
});
