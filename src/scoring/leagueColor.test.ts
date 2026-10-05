import { describe, expect, it } from 'vitest';
import { LEAGUE_COLORS, isHexColor, nextLeagueColor } from './leagueColor';

describe('league colours', () => {
  it('starts with the first colour and hands out the next unused one', () => {
    expect(nextLeagueColor([])).toBe(LEAGUE_COLORS[0]);
    expect(nextLeagueColor([LEAGUE_COLORS[0]])).toBe(LEAGUE_COLORS[1]);
    expect(nextLeagueColor([LEAGUE_COLORS[1]])).toBe(LEAGUE_COLORS[0]); // fills the gap
    expect(nextLeagueColor([LEAGUE_COLORS[0].toLowerCase(), undefined, 'nope'])).toBe(LEAGUE_COLORS[1]); // case and junk do not matter
  });

  it('starts the palette over from the least used colour once every one is taken', () => {
    const all = [...LEAGUE_COLORS];
    expect(nextLeagueColor(all)).toBe(LEAGUE_COLORS[0]);
    expect(nextLeagueColor([...all, LEAGUE_COLORS[0]])).toBe(LEAGUE_COLORS[1]);
  });

  it('accepts only #rrggbb', () => {
    expect(isHexColor('#a1B2c3')).toBe(true);
    for (const bad of ['red', '#fff', '#12345g', '123456', 12, null, undefined, '#1234567']) expect(isHexColor(bad)).toBe(false);
  });
});
