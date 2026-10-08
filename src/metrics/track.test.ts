import { afterEach, describe, expect, it, vi } from 'vitest';
import { countingAllowed, track, trackBeat, trackVital } from './track';

function browser(overrides: Record<string, unknown> = {}) {
  const sendBeacon = vi.fn(() => true);
  vi.stubGlobal('navigator', { sendBeacon, doNotTrack: null, ...overrides });
  return sendBeacon;
}

describe('track', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does nothing in development and tests, so nothing is counted from there', () => {
    const sendBeacon = browser();
    track('visit');
    expect(countingAllowed()).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  describe('in production', () => {
    it('sends an event to /api/e as JSON, with its labels', () => {
      vi.stubEnv('PROD', true);
      const sendBeacon = browser();
      track('sync', { side: 'mine', leagues: 'one' });
      expect(sendBeacon).toHaveBeenCalledWith('/api/e', JSON.stringify({ e: 'sync', l: { side: 'mine', leagues: 'one' } }));
    });

    it('sends an event with no labels as just its name', () => {
      vi.stubEnv('PROD', true);
      const sendBeacon = browser();
      track('visit');
      expect(sendBeacon).toHaveBeenCalledWith('/api/e', '{"e":"visit"}');
    });

    it('sends a web vital with its value and a heartbeat with only the tab id', () => {
      vi.stubEnv('PROD', true);
      const sendBeacon = browser();
      trackVital('LCP', 1800);
      trackBeat('3f2c9a1e-0000');
      expect(sendBeacon).toHaveBeenNthCalledWith(1, '/api/e', '{"e":"vital","l":{"name":"LCP"},"v":1800}');
      expect(sendBeacon).toHaveBeenNthCalledWith(2, '/api/e', '{"e":"beat","id":"3f2c9a1e-0000"}');
    });

    it('falls back to a keepalive fetch when the browser refuses or lacks sendBeacon', () => {
      vi.stubEnv('PROD', true);
      const fetch = vi.fn(async () => new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetch);
      browser({ sendBeacon: vi.fn(() => false) });
      track('visit');
      browser({ sendBeacon: undefined });
      track('visit');
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith('/api/e', { method: 'POST', body: '{"e":"visit"}', keepalive: true });
    });

    it('never lets a failed request reach the app', async () => {
      vi.stubEnv('PROD', true);
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
      browser({ sendBeacon: undefined });
      expect(() => track('visit')).not.toThrow();
      await Promise.resolve(); // an unhandled rejection would fail the run here
    });

    it.each([
      ['Do Not Track', { doNotTrack: '1' }],
      ['Global Privacy Control', { globalPrivacyControl: true }],
    ])('sends nothing when the browser says %s', (_name, flags) => {
      vi.stubEnv('PROD', true);
      const sendBeacon = browser(flags);
      track('visit');
      trackBeat('3f2c9a1e-0000');
      expect(countingAllowed()).toBe(false);
      expect(sendBeacon).not.toHaveBeenCalled();
    });
  });
});
