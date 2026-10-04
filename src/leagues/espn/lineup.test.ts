import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LineupError, parseLeagueLineups, readLineups } from './lineup';

const raw = readFileSync('src/test/fixtures/espn-fantasy/public-lineups-1900128084-2026.json', 'utf8');
const json = JSON.parse(raw) as { teams: { id: number; roster: { entries: { lineupSlotId: number }[] } }[] };

describe('parseLeagueLineups', () => {
  const lineups = parseLeagueLineups(json, '1900128084', '2026');

  it('keeps only starting slots, not the bench or injured reserve', () => {
    const team = json.teams[0]!;
    const bench = team.roster.entries.filter((e) => e.lineupSlotId === 20 || e.lineupSlotId === 21).length;
    expect(bench).toBeGreaterThan(0);
    expect(lineups.starters[String(team.id)]).toHaveLength(team.roster.entries.length - bench);
    expect(lineups.starters['1']!.map((s) => s.name)).not.toContain('Alvin Kamara');
  });

  it('follows a D/ST by NFL team id and a player by athlete id', () => {
    const all = Object.values(lineups.starters).flat();
    const dst = all.find((s) => s.kind === 'defense')!;
    expect(dst).toMatchObject({ position: 'D/ST', espnId: dst.nflTeamId });
    expect(all.find((s) => s.name === 'Christian McCaffrey')).toMatchObject({ kind: 'player', espnId: '3117251', nflTeamId: '25', position: 'RB' });
  });

  it('pairs the two teams of each matchup in both directions', () => {
    expect(lineups.opponentOf['9']).toBe('7');
    expect(lineups.opponentOf['7']).toBe('9');
  });

  it('refuses rosters of another league or season, and malformed input', () => {
    expect(() => parseLeagueLineups(json, '1', '2026')).toThrow('different league');
    expect(() => parseLeagueLineups(json, '1900128084', '2025')).toThrow('different season');
    expect(() => parseLeagueLineups({ id: 1 }, '1', '2026')).toThrow(LineupError);
    expect(() => readLineups('nope', '1', '2026')).toThrow('not valid JSON');
  });
});
