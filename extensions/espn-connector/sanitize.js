const MAX_BYTES = 1_000_000;

function numericMap(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 300) return undefined;
  const result = {};
  for (const [key, points] of Object.entries(value)) {
    if (!/^\d{1,4}$/.test(key) || typeof points !== 'number' || !Number.isFinite(points)) return undefined;
    result[key] = points;
  }
  return result;
}

function optionalFinite(value) {
  if (value == null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeItem(item) {
  if (!item || typeof item !== 'object' || !Number.isInteger(item.statId) || item.statId < 0 || typeof item.points !== 'number' || !Number.isFinite(item.points)) return null;
  if (item.isActive != null && typeof item.isActive !== 'boolean') return null;
  if (item.isDisabled != null && typeof item.isDisabled !== 'boolean') return null;
  const pointsOverrides = numericMap(item.pointsOverrides);
  const pointsOverridesByPosition = numericMap(item.pointsOverridesByPosition);
  const pointsByDistance = numericMap(item.pointsByDistance);
  const scoringPeriodId = optionalFinite(item.scoringPeriodId);
  const statOffset = optionalFinite(item.statOffset);
  const statPeriodId = optionalFinite(item.statPeriodId);
  if ([pointsOverrides, pointsOverridesByPosition, pointsByDistance, scoringPeriodId, statOffset, statPeriodId].includes(undefined)) return null;
  return {
    statId: item.statId,
    points: item.points,
    pointsOverrides,
    pointsOverridesByPosition,
    isActive: item.isActive ?? null,
    isDisabled: item.isDisabled ?? null,
    scoringPeriodId,
    statOffset,
    statPeriodId,
    pointsByDistance,
  };
}

export function sanitizeSettings(body, leagueId, season) {
  const settings = body?.settings;
  const sourceItems = settings?.scoringSettings?.scoringItems;
  const slots = settings?.rosterSettings?.lineupSlotCounts;
  if (String(body?.id) !== leagueId || String(body?.seasonId) !== season || !Array.isArray(sourceItems) || sourceItems.length > 300 || !slots || typeof slots !== 'object' || Array.isArray(slots) || Object.keys(slots).length > 300) {
    return { ok: false, status: 'malformed' };
  }
  const scoringItems = sourceItems.map(safeItem);
  if (scoringItems.some((item) => item === null)) return { ok: false, status: 'malformed' };
  const lineupSlotCounts = {};
  for (const [key, count] of Object.entries(slots)) {
    if (!/^\d{1,4}$/.test(key) || !Number.isInteger(count) || count < 0) return { ok: false, status: 'malformed' };
    lineupSlotCounts[key] = count;
  }
  const payload = { id: body.id, seasonId: body.seasonId, settings: {
    name: typeof settings.name === 'string' ? settings.name.slice(0, 120) : '',
    scoringSettings: { scoringItems }, rosterSettings: { lineupSlotCounts },
  } };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_BYTES) return { ok: false, status: 'too-large' };
  return { ok: true, payload };
}
