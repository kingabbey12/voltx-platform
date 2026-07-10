import { createHmac } from 'node:crypto';

export function jsonFetchResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

export function binaryFetchResponse(
  status: number,
  buffer: Buffer,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    body: buffer,
    arrayBuffer: () =>
      Promise.resolve(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      ),
  };
}

export function textFetchResponse(status: number, text: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/plain' }),
    text: () => Promise.resolve(text),
  };
}

type FetchResponder = (url: string, init?: RequestInit) => unknown;

interface FetchRoute {
  matcher: (url: string, init?: RequestInit) => boolean;
  responder: FetchResponder;
}

/**
 * A URL-routed `global.fetch` replacement for e2e tests that need to mock
 * several distinct outbound calls in one flow (e.g. OAuth token exchange
 * followed by a resolveAccountIdentity call, or a poll's list-then-get
 * sequence) — plain `jest.fn().mockResolvedValue(...)` only works when a
 * flow makes exactly one kind of call, which none of the comms channel
 * connect/send/poll flows do.
 */
export function createRoutedFetchMock(): {
  fetchMock: typeof fetch;
  on(
    matcher: string | RegExp | ((url: string, init?: RequestInit) => boolean),
    responder: FetchResponder,
  ): void;
} {
  const routes: FetchRoute[] = [];
  const fetchMock = jest.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const route = routes.find((candidate) => candidate.matcher(url, init));
    if (!route) {
      throw new Error(`comms-test.helper: no fetch route matched ${init?.method ?? 'GET'} ${url}`);
    }
    return Promise.resolve(route.responder(url, init));
  });

  return {
    fetchMock: fetchMock as unknown as typeof fetch,
    on(matcher, responder) {
      const matchFn =
        typeof matcher === 'function'
          ? matcher
          : typeof matcher === 'string'
            ? (url: string) => url.includes(matcher)
            : (url: string) => matcher.test(url);
      routes.push({ matcher: matchFn, responder });
    },
  };
}

export function signSlackPayload(
  rawBody: string,
  secret: string,
  timestamp: string = String(Math.floor(Date.now() / 1000)),
): { timestamp: string; signature: string } {
  const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  return { timestamp, signature };
}

export function signWhatsAppPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/** Recreates Twilio's own request-signing scheme (see twilio-signature.util.ts) so tests can produce a signature the server will accept. */
export function signTwilioRequest(fullUrl: string, rawFormBody: string, authToken: string): string {
  const params = new URLSearchParams(rawFormBody);
  const sortedKeys = Array.from(params.keys()).sort();
  let data = fullUrl;
  for (const key of sortedKeys) {
    data += key + (params.get(key) ?? '');
  }
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}
