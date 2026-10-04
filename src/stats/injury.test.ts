import { describe, expect, it } from 'vitest';
import { injuryLabel, injuryTone, isOut } from './injury';

describe('injury designations', () => {
  it('treats out, injured reserve and suspensions as out, and nothing else', () => {
    for (const status of ['Out', 'out', 'Injured Reserve', 'IR', 'Suspension', 'PUP']) expect(isOut({ status })).toBe(true);
    for (const status of ['Questionable', 'Doubtful', 'Day-To-Day', 'Probable']) expect(isOut({ status })).toBe(false);
    expect(isOut(undefined)).toBe(false);
  });

  it('maps a status to a tone and adds the injury to the label when ESPN names it', () => {
    expect(injuryTone({ status: 'Out' })).toBe('out');
    expect(injuryTone({ status: 'Doubtful' })).toBe('doubtful');
    expect(injuryTone({ status: 'Questionable' })).toBe('questionable');
    expect(injuryTone({ status: 'Day-To-Day' })).toBe('questionable');
    expect(injuryTone({ status: 'Probable' })).toBe('other');
    expect(injuryLabel({ status: 'Questionable', type: 'Hamstring' })).toBe('Questionable · Hamstring');
    expect(injuryLabel({ status: 'Out' })).toBe('Out');
  });
});
