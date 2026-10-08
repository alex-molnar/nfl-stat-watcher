import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyLanguage, languageStore } from '../../i18n';
import { inHungarian } from '../../test/render';
import { rosterBookmarklet } from './bookmarklet';

const DURATION = 40.44; // seconds, public/sync-tour.mp4
const seconds = (stamp: string) => { const [h, m, s] = stamp.split(':'); return Number(h) * 3600 + Number(m) * 60 + Number(s); };

function cues(file: string) {
  const text = readFileSync(file, 'utf8');
  expect(text.startsWith('WEBVTT\n')).toBe(true);
  return text.split(/\n\n+/).slice(1).filter(Boolean).map((block) => {
    const [id, timing, ...lines] = block.trim().split('\n');
    const match = /^(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})$/.exec(timing!);
    expect(match, `cue ${id} timing`).not.toBeNull();
    return { id, start: seconds(match![1]!), end: seconds(match![2]!), text: lines.join('\n') };
  });
}

describe.each(['en', 'hu'])('sync tour captions (%s)', (code) => {
  const list = cues(`public/captions/sync-tour.${code}.vtt`);
  it('has the 8 narration lines', () => {
    expect(list).toHaveLength(8);
    expect(list.every((cue) => cue.text.trim() !== '')).toBe(true);
  });
  it('has increasing, non-overlapping times inside the video', () => {
    list.forEach((cue, i) => {
      expect(cue.end).toBeGreaterThan(cue.start);
      expect(cue.end).toBeLessThanOrEqual(DURATION);
      if (i > 0) expect(cue.start).toBeGreaterThanOrEqual(list[i - 1]!.end);
    });
  });
});

it('both caption files time the same lines the same way', () => {
  const times = (code: string) => cues(`public/captions/sync-tour.${code}.vtt`).map((cue) => [cue.start, cue.end]);
  expect(times('hu')).toEqual(times('en'));
});

describe('roster bookmarklet language', () => {
  const code = () => decodeURIComponent(rosterBookmarklet('409479118', '2026').replace(/^javascript:/, ''));

  it('carries English texts, and is valid JavaScript', () => {
    expect(code()).toContain("alert('Stat Watch: lineups copied. Go back to Stat Watch and paste them.')");
    expect(code()).toContain("'ESPN answered '+r.status");
    expect(() => new Function(`return ${code()}`)).not.toThrow();
  });

  it('carries the site language in Hungarian, safely quoted, and is still valid JavaScript', async () => {
    await inHungarian();
    const hu = code();
    expect(hu).toContain('a felállások kimásolva');
    expect(hu).toContain("'Az ESPN ezt válaszolta: '+r.status");
    expect(hu).toContain("'A Stat Watch nem tudta beolvasni a ligát: '+e.message");
    expect(rosterBookmarklet('409479118', '2026')).not.toMatch(/[\n"' ]/);
    expect(() => new Function(`return ${hu}`)).not.toThrow();
    languageStore.set('en');
    await applyLanguage();
  });
});
