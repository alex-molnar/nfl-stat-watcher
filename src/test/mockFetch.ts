import { vi } from 'vitest';

export const status = (code: number) => ({ __status: code });

/** Routes fetch by URL substring, first match wins. Unmatched URLs return 404. */
export function mockFetch(routes: Record<string, unknown>) {
  const f = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (key === undefined) return new Response('not found', { status: 404 });
    const body = routes[key];
    if (typeof body === 'object' && body !== null && '__status' in body) {
      return new Response('error', { status: (body as { __status: number }).__status });
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', f);
  return f;
}
