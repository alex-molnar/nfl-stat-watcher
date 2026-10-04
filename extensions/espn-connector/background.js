import { sanitizeSettings } from './sanitize.js';

const CHANNEL = 'stat-watch-espn-connector-v1';
const ESPN_TAB = 'https://fantasy.espn.com/*';
const API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons';
const MAX_BYTES = 1_000_000;
const allowedPatterns = chrome.runtime.getManifest().externally_connectable?.matches ?? [];
const activeRequests = new Map();

function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    return allowedPatterns.some((pattern) => {
      const match = /^([a-z]+):\/\/([^/]+)\/\*/i.exec(pattern);
      return match && url.origin === `${match[1]}://${match[2]}`;
    });
  } catch { return false; }
}

function validSender(sender) {
  if (!sender.origin || !sender.url) return false;
  try { return new URL(sender.url).origin === sender.origin && isAllowedOrigin(sender.origin); }
  catch { return false; }
}

function validRequest(request) {
  return request?.channel === CHANNEL && request.action === 'load-settings'
    && typeof request.leagueId === 'string' && /^\d{1,20}$/.test(request.leagueId)
    && typeof request.season === 'string' && /^\d{4}$/.test(request.season)
    && typeof request.requestId === 'string' && request.requestId.length <= 80
    && typeof request.nonce === 'string' && /^[\w-]{16,80}$/.test(request.nonce);
}

async function waitForComplete(tabId) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === 'complete') return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('page-timeout')), 30_000);
    const listener = (changedTabId, changeInfo) => { if (changedTabId === tabId && changeInfo.status === 'complete') finish(); };
    function finish(error) {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      if (error) reject(error); else resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => { if (tab.status === 'complete') finish(); }, finish);
  });
}

async function getEspnTab(leagueId, season) {
  const tabs = await chrome.tabs.query({ url: ESPN_TAB });
  let tab = tabs.find((candidate) => candidate.id !== undefined);
  if (!tab) tab = await chrome.tabs.create({ url: `https://fantasy.espn.com/football/league?leagueId=${leagueId}&seasonId=${season}`, active: true });
  if (!tab.id) throw new Error('tab-unavailable');
  await waitForComplete(tab.id);
}

async function readLimitedText(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return new TextEncoder().encode(text).byteLength <= MAX_BYTES ? text : null;
  }
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function loadSettings(leagueId, season, controller) {
  await getEspnTab(leagueId, season);
  if (controller.signal.aborted) return { ok: false, status: 'connector-error' };
  // Extension host permission bypasses page CORS. Browser credentials are used
  // for the request but are never read, stored, or returned to the website.
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API}/${season}/segments/0/leagues/${leagueId}?view=mSettings`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
    if (response.status === 401 || response.status === 403) return { ok: false, status: 'access-denied' };
    if (response.status === 404) return { ok: false, status: 'not-found' };
    if (response.status === 429) return { ok: false, status: 'rate-limited' };
    if (!response.ok) return { ok: false, status: 'server-error' };
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_BYTES) return { ok: false, status: 'too-large' };
    const text = await readLimitedText(response);
    if (text === null) return { ok: false, status: 'too-large' };
    let body;
    try { body = JSON.parse(text); } catch { return { ok: false, status: 'malformed' }; }
    return sanitizeSettings(body, leagueId, season);
  } finally { clearTimeout(timer); }
}

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request?.channel === CHANNEL && request.action === 'cancel-settings'
    && typeof request.requestId === 'string' && typeof request.nonce === 'string'
    && validSender(sender)) {
    const pending = activeRequests.get(request.requestId);
    if (pending?.nonce === request.nonce && pending.origin === sender.origin) pending.controller.abort();
    sendResponse({ ok: true });
    return false;
  }
  if (!validRequest(request) || !validSender(sender)) { sendResponse({ ok: false, status: 'rejected' }); return false; }
  const controller = new AbortController();
  activeRequests.set(request.requestId, { nonce: request.nonce, origin: sender.origin, controller });
  loadSettings(request.leagueId, request.season, controller).then(
    (result) => sendResponse({ ...result, requestId: request.requestId, nonce: request.nonce, leagueId: request.leagueId, season: request.season }),
    () => sendResponse({ ok: false, status: 'connector-error', requestId: request.requestId, nonce: request.nonce, leagueId: request.leagueId, season: request.season }),
  ).finally(() => activeRequests.delete(request.requestId));
  return true;
});
