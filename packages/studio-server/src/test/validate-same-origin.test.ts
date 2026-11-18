import {expect, test} from 'bun:test';
import type {IncomingMessage} from 'node:http';
import {validateSameOrigin} from '../preview-server/validate-same-origin';

const makeRequest = ({
	host,
	origin,
	method = 'POST',
	localAddress = '127.0.0.1',
	headers = {},
}: {
	host: string | undefined;
	origin: string | undefined;
	method?: string;
	localAddress?: string;
	headers?: Record<string, string>;
}) => {
	return {
		method,
		headers: {host, origin, ...headers},
		socket: {localAddress},
	} as unknown as IncomingMessage;
};

test('accepts same-origin requests addressed to localhost', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({
				host: 'localhost:3000',
				origin: 'http://localhost:3000',
			}),
		),
	).not.toThrow();
});

test('accepts same-origin requests addressed to a loopback IP', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({
				host: '127.0.0.1:3000',
				origin: 'http://127.0.0.1:3000',
			}),
		),
	).not.toThrow();
});

test('rejects a DNS name that resolves to the loopback interface', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({
				host: 'attacker.example:3000',
				origin: 'http://attacker.example:3000',
			}),
		),
	).toThrow();
});

test('accepts a proxied request to a public host name on loopback', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({
				host: 'my-studio.example.com',
				origin: 'https://my-studio.example.com',
				headers: {
					'x-forwarded-host': 'my-studio.example.com',
					'x-forwarded-proto': 'https',
				},
			}),
		),
	).not.toThrow();
});

test('accepts a DNS name when the connection is not on loopback', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({
				host: 'my-studio.fly.dev',
				origin: 'https://my-studio.fly.dev',
				localAddress: '172.18.0.5',
			}),
		),
	).not.toThrow();
});

test('rejects cross-origin requests', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({
				host: 'localhost:3000',
				origin: 'http://attacker.example:3000',
			}),
		),
	).toThrow();
});

test('rejects state-changing requests without an Origin header', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({host: 'localhost:3000', origin: undefined}),
		),
	).toThrow();
});

test('accepts GET requests without an Origin header', () => {
	expect(() =>
		validateSameOrigin(
			makeRequest({host: 'localhost:3000', origin: undefined, method: 'GET'}),
		),
	).not.toThrow();
});
