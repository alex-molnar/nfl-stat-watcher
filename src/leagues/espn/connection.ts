import { i18n } from '../../i18n';

const CONNECTOR_CHANNEL = 'stat-watch-espn-connector-v1';
const CONNECT_TIMEOUT_MS = 120_000;

interface ConnectorReply {
  ok: boolean;
  payload?: unknown;
  status?: 'access-denied' | 'not-found' | 'rate-limited' | 'server-error' | 'malformed' | 'too-large' | 'connector-error';
  message?: string;
  leagueId?: string;
  season?: string;
  requestId?: string;
  nonce?: string;
}

function connectorId(): string | undefined {
  const value = import.meta.env.VITE_ESPN_CONNECTOR_ID;
  return typeof value === 'string' && /^[a-p]{32}$/.test(value) ? value : undefined;
}

function runtimeSendMessage(id: string, request: Record<string, string>): Promise<ConnectorReply | null> {
  return new Promise((resolve) => {
    const runtime = (globalThis as typeof globalThis & {
      chrome?: { runtime?: { sendMessage?: (extensionId: string, message: unknown, callback: (reply?: ConnectorReply) => void) => void; lastError?: { message?: string } } };
    }).chrome?.runtime;
    if (!runtime?.sendMessage) return resolve(null);
    const timeout = setTimeout(() => resolve(null), CONNECT_TIMEOUT_MS);
    try {
      runtime.sendMessage(id, request, (reply) => {
        clearTimeout(timeout);
        resolve(runtime.lastError || !reply ? null : reply);
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

export async function loadSettingsWithBrowserSession(
  leagueId: string,
  season: string,
  signal?: AbortSignal,
): Promise<unknown | null> {
  const id = connectorId();
  if (!id || signal?.aborted) return null;
  const requestId = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  let abortHandler: (() => void) | undefined;
  const abort = new Promise<null>((resolve) => {
    abortHandler = () => {
      void runtimeSendMessage(id, { channel: CONNECTOR_CHANNEL, action: 'cancel-settings', requestId, nonce });
      resolve(null);
    };
    signal?.addEventListener('abort', abortHandler, { once: true });
  });
  const request = runtimeSendMessage(id, {
    channel: CONNECTOR_CHANNEL,
    action: 'load-settings',
    leagueId,
    season,
    requestId,
    nonce,
  });
  const reply = signal ? await Promise.race([request, abort]) : await request;
  if (abortHandler) signal?.removeEventListener('abort', abortHandler);
  if (reply?.status === 'access-denied') {
    throw new Error(i18n.t(($) => $.leagues.errors.espn.deniedCheck));
  }
  if (reply && reply.ok !== true && reply.status) throw new Error(i18n.t(($) => $.leagues.errors.espn.couldNotLoad, { status: reply.status }));
  if (!reply || reply.ok !== true || reply.requestId !== requestId || reply.nonce !== nonce || reply.leagueId !== leagueId || reply.season !== season) return null;
  return reply.payload ?? null;
}

export function isConnectorConfigured(): boolean {
  return connectorId() !== undefined;
}
