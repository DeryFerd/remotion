import type {IncomingMessage} from 'node:http';
import {isIP} from 'node:net';

const loopbackAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const parseHostname = (host: string) => {
	try {
		return new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '');
	} catch {
		return null;
	}
};

const isLocalHostname = (hostname: string) => {
	return (
		hostname === 'localhost' ||
		hostname.endsWith('.localhost') ||
		isIP(hostname) !== 0
	);
};

// A DNS rebinding page controls both the Origin and the Host header, so the
// same-origin comparison alone cannot tell it apart from the Studio UI.
// Requests that arrive on a loopback interface must address Studio by a local
// name; connections to other interfaces keep working as before.
// Reverse proxies that forward to loopback (for example a TLS terminator on the
// same host) keep working because a browser cannot attach these headers to a
// cross-site request without a preflight, which this server does not approve.
const forwardedHeaders = [
	'x-forwarded-host',
	'x-forwarded-proto',
	'x-forwarded-for',
];

const assertLoopbackRequestUsesLocalHost = (
	req: IncomingMessage,
	host: string,
) => {
	const localAddress = req.socket?.localAddress;
	if (
		typeof localAddress !== 'string' ||
		!loopbackAddresses.has(localAddress)
	) {
		return;
	}

	if (forwardedHeaders.some((header) => req.headers[header] !== undefined)) {
		return;
	}

	const hostname = parseHostname(host);
	if (hostname === null || !isLocalHostname(hostname)) {
		throw new Error('Request to a non-local host name is not allowed');
	}
};

export const validateSameOrigin = (req: IncomingMessage): void => {
	const {origin, host} = req.headers;

	if (typeof origin !== 'string') {
		if (req.method === 'GET' || req.method === 'HEAD') {
			return;
		}

		throw new Error('Request without Origin header not allowed');
	}

	if (typeof host !== 'string') {
		throw new Error('Request without Host header not allowed');
	}

	assertLoopbackRequestUsesLocalHost(req, host);

	let originUrl: URL;
	try {
		originUrl = new URL(origin);
	} catch {
		throw new Error('Request from different origin not allowed');
	}

	if (
		originUrl.origin !== `http://${host}` &&
		originUrl.origin !== `https://${host}`
	) {
		throw new Error('Request from different origin not allowed');
	}
};
