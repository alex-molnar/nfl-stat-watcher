/** Distinct, mid-tone colours that read on both themes; the league tag picks black or white text for each. */
export const LEAGUE_COLORS = [
  '#2563EB', '#E11D48', '#059669', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
] as const;

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

/** The first palette colour no one uses yet; once all are taken, the palette starts over from the least used. */
export function nextLeagueColor(taken: (string | undefined)[]): string {
  const used = taken.filter(isHexColor).map((color) => color.toLowerCase());
  const free = LEAGUE_COLORS.find((color) => !used.includes(color.toLowerCase()));
  if (free) return free;
  const count = (color: string) => used.filter((u) => u === color.toLowerCase()).length;
  return [...LEAGUE_COLORS].sort((a, b) => count(a) - count(b))[0]!;
}
